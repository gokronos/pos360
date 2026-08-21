export function requestIdentityEmail(req:Request):string|null{
  const host=new URL(req.url).hostname;
  const local=host==="localhost"||host==="127.0.0.1"||host==="::1"||host.endsWith(".local");
  if(!local)return null;
  return req.headers.get("oai-authenticated-user-email")||"preview@pos360.local";
}

export function requestIdentityName(req:Request):string{
  const raw=req.headers.get("oai-authenticated-user-full-name");
  if(!raw)return "Administrador local POS360";
  try{return decodeURIComponent(raw)}catch{return "Administrador local POS360"}
}
