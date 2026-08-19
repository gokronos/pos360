import { getRuntimeEnv } from "./runtime-env";
export const DEFAULT_TENANT="tenant_demo";
export const roleModules:Record<string,string[]>={owner:["dashboard","pos","inventory","purchases","customers","reports","settings","saas"],admin:["dashboard","pos","inventory","purchases","customers","reports","settings"],cashier:["dashboard","pos","customers"],warehouse:["dashboard","inventory","purchases"],accountant:["dashboard","purchases","customers","reports"]};
type AccessUser={id:string;email:string;displayName:string;role:string;active:number;tenantId:string;branchId:string;modules:string[]};
const emailOf=(req:Request)=>req.headers.get("oai-authenticated-user-email")||"preview@pos360.local";

export async function getAccess(req:Request,tenantId?:string){
 const d=getRuntimeEnv().DB,email=emailOf(req),wanted=tenantId||req.headers.get("x-pos360-tenant-id")?.trim()||null;
 const user=await d.prepare(`SELECT id,email,display_name displayName,role,active,tenant_id tenantId FROM app_users
  WHERE email=? AND active=1 AND (? IS NULL OR tenant_id=?)
  ORDER BY CASE WHEN tenant_id=? THEN 0 ELSE 1 END,created_at LIMIT 1`).bind(email,wanted,wanted,DEFAULT_TENANT).first<Omit<AccessUser,"branchId"|"modules">>();
 if(!user)return null;
 const wantedBranch=req.headers.get("x-pos360-branch-id")?.trim()||null;
 const branch=await d.prepare(`SELECT b.id FROM branches b WHERE b.tenant_id=? AND (? IS NULL OR b.id=?)
  AND (NOT EXISTS(SELECT 1 FROM user_branch_access x WHERE x.user_id=?) OR EXISTS(SELECT 1 FROM user_branch_access x WHERE x.user_id=? AND x.branch_id=b.id))
  ORDER BY b.created_at LIMIT 1`).bind(user.tenantId,wantedBranch,wantedBranch,user.id,user.id).first<{id:string}>();
 if(!branch)return null;
 return {...user,branchId:branch.id,modules:roleModules[user.role]||[]};
}
export async function requireAccess(req:Request,moduleName:string,tenantId=DEFAULT_TENANT){const user=await getAccess(req,tenantId);if(!user)return {error:Response.json({error:"Usuario sin acceso a la empresa o sede solicitada"},{status:403})};if(!user.modules.includes(moduleName))return {error:Response.json({error:`Su rol no tiene permiso para ${moduleName}`},{status:403})};return {user};}
