import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");

test("public home explains the complete POS360 offer",async()=>{
  const page=await read("../app/page.tsx");
  for(const text of ["Punto de venta","Inventario y kardex","Compras y proveedores","Clientes y cartera","Caja y terminales","Reportes reales","Facturación electrónica","Operación offline","$60.000","15 días","Preguntas frecuentes","WhatsApp"])assert.match(page,new RegExp(text.replace("$","\\$")));
});
test("public calls to action never bypass protected application",async()=>{
  const [home,login,register,app]=await Promise.all([read("../app/page.tsx"),read("../app/login/page.tsx"),read("../app/registro/page.tsx"),read("../app/app/page.tsx")]);
  assert.match(home,/href="\/registro"/);assert.match(home,/href="\/login"/);assert.match(login,/Inicio de sesión seguro/);assert.match(register,/verificación de correo/);assert.match(app,/BusinessApp/);
});
test("downloads remain disabled until signed builds exist",async()=>{const home=await read("../app/page.tsx");assert.match(home,/button disabled/);assert.match(home,/versión firmada/)});
test("SEO identifies POS360 as commercial software",async()=>{const layout=await read("../app/layout.tsx");assert.match(layout,/software POS Colombia/);assert.match(layout,/https:\/\/pos360\.imagenplus\.co/);assert.match(layout,/robots:\{index:true,follow:true\}/)});
