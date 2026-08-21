import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pos360.imagenplus.co"),
  title: {default:"POS360 | Software POS, inventario y gestión comercial",template:"%s | POS360"},
  description: "Software POS para tiendas, supermercados, droguerías y ferreterías. Controle ventas, inventario, compras, caja, cartera y reportes desde un solo lugar.",
  keywords:["software POS Colombia","sistema POS","inventario","punto de venta","software para tiendas","POS360"],
  alternates:{canonical:"/"},
  openGraph:{title:"POS360 | Controle su negocio desde un solo lugar",description:"Ventas, inventario, compras, caja, clientes y reportes conectados.",url:"https://pos360.imagenplus.co",siteName:"POS360",locale:"es_CO",type:"website"},
  robots:{index:true,follow:true},
  manifest: "/manifest.webmanifest",
  themeColor: "#102d42",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
