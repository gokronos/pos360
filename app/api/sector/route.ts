import { randomUUID } from "node:crypto";
import { requireAccess } from "../../../db/authz";
import { inventoryMovement, negativeStockAllowed, resolveWarehouse } from "../../../db/inventory";
import { parseMoney } from "../../../db/money";
import { getRuntimeEnv } from "../../../db/runtime-env";

const sectorFeature: Record<string,string>={pharmacy:"pharmacy",hardware:"hardware",retail:"supermarket",restaurant:"quick_store",fashion:"quick_store",services:"quick_store",other:"quick_store"};
const validEan13=(code:string)=>/^\d{13}$/.test(code)&&Number(code[12])===(10-(code.slice(0,12).split("").reduce((sum,digit,index)=>sum+Number(digit)*(index%2?3:1),0)%10))%10;

export async function GET(req:Request){
  const access=await requireAccess(req,"dashboard");if(access.error)return access.error;
  const d=getRuntimeEnv().DB,T=access.user.tenantId,url=new URL(req.url),code=url.searchParams.get("scaleCode");
  const settings=await d.prepare("SELECT sector,currency FROM business_settings WHERE tenant_id=?").bind(T).first<{sector:string;currency:string}>();
  const sector=settings?.sector||"retail";
  if(code){
    if(sector!=="retail"||!validEan13(code))return Response.json({error:"Código de báscula inválido"},{status:400});
    const scale=await d.prepare("SELECT s.product_id productId,s.mode,s.decimals,p.name,p.price_minor priceMinor FROM scale_codes s JOIN products p ON p.id=s.product_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=? AND s.active=1 AND ? LIKE s.prefix||s.plu||'%' ORDER BY length(s.prefix||s.plu) DESC LIMIT 1").bind(T,code).first<{productId:string;mode:string;decimals:number;name:string;priceMinor:number}>();
    if(!scale)return Response.json({error:"PLU de báscula no configurado"},{status:404});
    const encoded=Number(code.slice(7,12)),quantity=scale.mode==="weight"?encoded/(10**scale.decimals):(encoded/100)/(scale.priceMinor/100);
    if(!Number.isFinite(quantity)||quantity<=0)return Response.json({error:"Peso o precio inválido"},{status:400});
    return Response.json({scale:{productId:scale.productId,name:scale.name,quantity:Number(quantity.toFixed(6)),mode:scale.mode}});
  }
  const [features,products,lots,scales,promotions,combos,orders,credits,pharmacyRules]=await Promise.all([
    d.prepare("SELECT feature_key featureKey,enabled,config FROM sector_features WHERE tenant_id=? ORDER BY feature_key").bind(T).all(),
    d.prepare("SELECT id,name,sku,price_minor priceMinor,special_fields specialFields FROM products WHERE tenant_id=? AND active=1 ORDER BY name").bind(T).all(),
    d.prepare("SELECT l.id,l.lot_number lotNumber,l.expiration_date expirationDate,l.quantity,p.name productName,CAST(julianday(l.expiration_date)-julianday('now') AS INTEGER) daysToExpire FROM product_lots l JOIN products p ON p.id=l.product_id WHERE l.tenant_id=? AND l.quantity>0 ORDER BY COALESCE(l.expiration_date,'9999-12-31'),l.created_at").bind(T).all(),
    d.prepare("SELECT s.id,s.product_id productId,s.prefix,s.plu,s.mode,s.decimals,s.active,p.name productName FROM scale_codes s JOIN products p ON p.id=s.product_id WHERE s.tenant_id=? ORDER BY p.name").bind(T).all(),
    d.prepare("SELECT x.id,x.name,x.product_id productId,p.name productName,x.type,x.value_minor valueMinor,x.minimum_quantity minimumQuantity,x.starts_at startsAt,x.ends_at endsAt,x.active FROM sector_promotions x JOIN products p ON p.id=x.product_id WHERE x.tenant_id=? ORDER BY x.ends_at DESC").bind(T).all(),
    d.prepare("SELECT c.id,c.name,c.product_id productId,p.name productName,c.active,(SELECT COUNT(*) FROM sector_combo_items i WHERE i.combo_id=c.id) itemCount FROM sector_combos c JOIN products p ON p.id=c.product_id WHERE c.tenant_id=? ORDER BY c.name").bind(T).all(),
    d.prepare("SELECT x.id,x.number,x.document_type documentType,x.payload,x.status,COALESCE((SELECT SUM(l.quantity) FROM hardware_dispatch_lines l JOIN hardware_dispatches h ON h.id=l.dispatch_id WHERE h.draft_id=x.id),0) dispatchedUnits FROM pos_drafts x WHERE x.tenant_id=? AND x.document_type IN ('quote','order') ORDER BY x.created_at DESC LIMIT 30").bind(T).all(),
    d.prepare("SELECT COUNT(*) customers,COALESCE(SUM(balance_minor),0) balanceMinor,COALESCE(SUM(CASE WHEN due_date<date('now') AND balance_minor>0 THEN balance_minor ELSE 0 END),0) overdueMinor FROM receivables WHERE tenant_id=? AND balance_minor>0").bind(T).first(),
    d.prepare("SELECT product_id productId,units_per_package unitsPerPackage,fraction_unit fractionUnit,fraction_price_minor fractionPriceMinor,fractionation_enabled fractionationEnabled,requires_lot requiresLot FROM pharmacy_product_settings WHERE tenant_id=?").bind(T).all(),
  ]);
  return Response.json({sector,feature:sectorFeature[sector]||"quick_store",currency:settings?.currency||"COP",features:features.results,products:products.results,lots:lots.results,scales:scales.results,promotions:promotions.results,combos:combos.results,orders:orders.results,credits,pharmacyRules:pharmacyRules.results});
}

type Body={action?:string;featureKey?:string;enabled?:boolean;config?:unknown;productId?:string;unitsPerPackage?:number;fractionUnit?:string;fractionPrice?:number;requiresLot?:boolean;prefix?:string;plu?:string;mode?:string;decimals?:number;name?:string;type?:string;value?:number;minimumQuantity?:number;startsAt?:string;endsAt?:string;comboProductId?:string;items?:{productId:string;quantity:number}[];draftId?:string;dispatchItems?:{productId:string;quantity:number}[];notes?:string};
export async function POST(req:Request){
  const access=await requireAccess(req,"dashboard","create");if(access.error)return access.error;
  const p=(await req.json()) as Body,d=getRuntimeEnv().DB,T=access.user.tenantId,B=access.user.branchId,user=access.user.id;
  const settings=await d.prepare("SELECT sector FROM business_settings WHERE tenant_id=?").bind(T).first<{sector:string}>(),feature=sectorFeature[settings?.sector||"retail"]||"quick_store";
  const ownsProduct=async(id?:string)=>Boolean(id&&await d.prepare("SELECT id FROM products WHERE id=? AND tenant_id=? AND active=1").bind(id,T).first());
  try{
    if(p.action==="feature"){
      if(!["owner","admin"].includes(access.user.role))return Response.json({error:"Solo administración puede cambiar funciones"},{status:403});
      if(p.featureKey!==feature)return Response.json({error:"La función no corresponde al sector activo"},{status:400});
      await d.prepare("INSERT INTO sector_features(id,tenant_id,feature_key,enabled,config,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(tenant_id,feature_key) DO UPDATE SET enabled=excluded.enabled,config=excluded.config,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP").bind(randomUUID(),T,feature,p.enabled===false?0:1,JSON.stringify(p.config||{}),user).run();return Response.json({updated:true});
    }
    const enabled=await d.prepare("SELECT enabled FROM sector_features WHERE tenant_id=? AND feature_key=?").bind(T,feature).first<{enabled:number}>();
    if(enabled&& !enabled.enabled)return Response.json({error:"Las funciones del sector están desactivadas"},{status:409});
    if(p.action==="pharmacyProduct"){
      if(feature!=="pharmacy"||!await ownsProduct(p.productId))return Response.json({error:"Producto o sector inválido"},{status:400});
      const price=parseMoney(p.fractionPrice||0);await d.prepare("INSERT INTO pharmacy_product_settings(id,tenant_id,product_id,units_per_package,fraction_unit,fraction_price_minor,fractionation_enabled,requires_lot) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,product_id) DO UPDATE SET units_per_package=excluded.units_per_package,fraction_unit=excluded.fraction_unit,fraction_price_minor=excluded.fraction_price_minor,fractionation_enabled=excluded.fractionation_enabled,requires_lot=excluded.requires_lot,updated_at=CURRENT_TIMESTAMP").bind(randomUUID(),T,p.productId,Math.max(1,Number(p.unitsPerPackage||1)),p.fractionUnit?.trim()||"unidad",price,Number(p.unitsPerPackage||1)>1?1:0,p.requiresLot===false?0:1).run();return Response.json({updated:true});
    }
    if(p.action==="scale"){
      if(feature!=="supermarket"||!await ownsProduct(p.productId)||!/^\d{2}$/.test(p.prefix||"")||!/^\d{5}$/.test(p.plu||"")||!["weight","price"].includes(p.mode||""))return Response.json({error:"Configure producto, prefijo de 2 dígitos, PLU de 5 y modo"},{status:400});
      const id=randomUUID();await d.prepare("INSERT INTO scale_codes(id,tenant_id,product_id,prefix,plu,mode,decimals) VALUES(?,?,?,?,?,?,?)").bind(id,T,p.productId,p.prefix,p.plu,p.mode,Math.min(4,Math.max(0,Number(p.decimals??3)))).run();return Response.json({id},{status:201});
    }
    if(p.action==="promotion"){
      if(feature!=="supermarket"||!await ownsProduct(p.productId)||!p.name?.trim()||!["percent","fixed_price"].includes(p.type||"")||!p.startsAt||!p.endsAt||p.endsAt<p.startsAt)return Response.json({error:"Promoción inválida"},{status:400});
      const value=p.type==="percent"?Math.round(Math.min(100,Math.max(0,Number(p.value||0)))*100):parseMoney(p.value||0),id=randomUUID(),startsAt=p.startsAt.length===10?`${p.startsAt} 00:00:00`:p.startsAt,endsAt=p.endsAt.length===10?`${p.endsAt} 23:59:59`:p.endsAt;await d.prepare("INSERT INTO sector_promotions(id,tenant_id,name,product_id,type,value_minor,minimum_quantity,starts_at,ends_at,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(id,T,p.name.trim(),p.productId,p.type,value,Math.max(0.000001,Number(p.minimumQuantity||1)),startsAt,endsAt,user).run();return Response.json({id},{status:201});
    }
    if(p.action==="combo"){
      if(feature!=="supermarket"||!await ownsProduct(p.comboProductId)||!p.name?.trim()||!p.items?.length)return Response.json({error:"Combo incompleto"},{status:400});
      if((await Promise.all(p.items.map(x=>ownsProduct(x.productId)))).some(x=>!x)||p.items.some(x=>x.productId===p.comboProductId||Number(x.quantity)<=0))return Response.json({error:"Los componentes del combo son inválidos"},{status:400});
      const id=randomUUID();await d.batch([d.prepare("INSERT INTO sector_combos(id,tenant_id,product_id,name) VALUES(?,?,?,?)").bind(id,T,p.comboProductId,p.name.trim()),...p.items.map(x=>d.prepare("INSERT INTO sector_combo_items(id,combo_id,product_id,quantity) VALUES(?,?,?,?)").bind(randomUUID(),id,x.productId,Number(x.quantity)))]);return Response.json({id},{status:201});
    }
    if(p.action==="dispatch"){
      if(feature!=="hardware"||!["owner","admin","supervisor","warehouse"].includes(access.user.role)||!p.draftId||!p.dispatchItems?.length)return Response.json({error:"Despacho no autorizado o incompleto"},{status:403});
      const draft=await d.prepare("SELECT id,payload FROM pos_drafts WHERE id=? AND tenant_id=? AND branch_id=? AND document_type IN ('quote','order') AND status IN ('open','partial')").bind(p.draftId,T,B).first<{id:string;payload:string}>();if(!draft)return Response.json({error:"Pedido no disponible"},{status:404});
      const ordered=JSON.parse(draft.payload) as {productId:string;quantity:number}[],warehouse=await resolveWarehouse(T,B),id=randomUUID(),number=`DES-${Date.now().toString().slice(-7)}`,statements=[];
      for(const item of p.dispatchItems){const max=ordered.filter(x=>x.productId===item.productId).reduce((s,x)=>s+Number(x.quantity),0),prior=await d.prepare("SELECT COALESCE(SUM(l.quantity),0) total FROM hardware_dispatch_lines l JOIN hardware_dispatches h ON h.id=l.dispatch_id WHERE h.draft_id=? AND l.product_id=?").bind(draft.id,item.productId).first<{total:number}>(),qty=Number(item.quantity);if(!await ownsProduct(item.productId)||qty<=0||Number(prior?.total||0)+qty>max)return Response.json({error:"El despacho supera la cantidad pendiente"},{status:409});const movement=await inventoryMovement({tenantId:T,branchId:B,warehouseId:warehouse.id,productId:item.productId,userId:user,movementType:"partial_dispatch",quantity:-qty,reason:p.notes?.trim()||`Despacho ${number}`,reference:number,sourceType:"hardware_dispatch",sourceId:id,allowNegative:await negativeStockAllowed(T)});statements.push(d.prepare("INSERT INTO hardware_dispatch_lines(id,dispatch_id,product_id,quantity) VALUES(?,?,?,?)").bind(randomUUID(),id,item.productId,qty),...movement.statements)}
      statements.unshift(d.prepare("INSERT INTO hardware_dispatches(id,tenant_id,branch_id,draft_id,number,notes,dispatched_by) VALUES(?,?,?,?,?,?,?)").bind(id,T,B,draft.id,number,p.notes||null,user));await d.batch(statements);return Response.json({id,number},{status:201});
    }
    return Response.json({error:"Acción sectorial inválida"},{status:400});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"No fue posible guardar la función sectorial"},{status:409})}
}
