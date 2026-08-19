import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS360 Prototipo",
  description: "Prototipo navegable del sistema POS360 para ventas, inventarios y gestión comercial.",
  manifest: "/manifest.webmanifest",
  themeColor: "#102d42",
  other: {
    "codex-preview": "development",
  },
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
