import {getRuntimeEnv} from "./runtime-env";

type LimitKind="branches"|"users"|"terminals"|"products";
const definitions:Record<LimitKind,{column:string;table:string;where:string}>={
  branches:{column:"max_branches",table:"branches",where:"tenant_id=?"},
  users:{column:"max_users",table:"app_users",where:"tenant_id=? AND active=1"},
  terminals:{column:"max_terminals",table:"terminals",where:"tenant_id=? AND status!='blocked'"},
  products:{column:"max_products",table:"products",where:"tenant_id=? AND active=1"},
};
export async function checkSubscriptionLimit(tenantId:string,kind:LimitKind){
  const d=getRuntimeEnv().DB,definition=definitions[kind],subscription=await d.prepare(`SELECT s.status,p.${definition.column} maximum,s.trial_ends_at trialEndsAt FROM tenant_subscriptions s JOIN saas_plans p ON p.id=s.plan_id WHERE s.tenant_id=?`).bind(tenantId).first<{status:string;maximum:number;trialEndsAt:string|null}>();
  if(!subscription)return {allowed:false,error:"La empresa no tiene una suscripción configurada"};
  if(["suspended","cancelled"].includes(subscription.status))return {allowed:false,error:"La suscripción no permite crear nuevos recursos"};
  if(subscription.status==="trial"&&subscription.trialEndsAt&&new Date(subscription.trialEndsAt)<new Date())return {allowed:false,error:"El periodo de prueba terminó"};
  const usage=await d.prepare(`SELECT COUNT(*) count FROM ${definition.table} WHERE ${definition.where}`).bind(tenantId).first<{count:number}>();
  return Number(usage?.count||0)<subscription.maximum?{allowed:true}:{allowed:false,error:`Límite del plan alcanzado: ${subscription.maximum} ${kind}`};
}
