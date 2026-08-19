type RuntimeEnv = { DB: D1Database };
declare global {
  var __POS360_ENV__: RuntimeEnv | undefined;
}
export function setRuntimeEnv(env: RuntimeEnv) {
  globalThis.__POS360_ENV__ = env;
}
export function getRuntimeEnv(): RuntimeEnv {
  if (!globalThis.__POS360_ENV__?.DB)
    throw new Error("La base de datos POS360 no está disponible.");
  return globalThis.__POS360_ENV__;
}
