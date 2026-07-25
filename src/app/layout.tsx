import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trashpanda Garage",
  description: "Photography, portraits, cosplay and editorial scenes.",
  icons: {
    icon: "/logo_hex.ico",
    shortcut: "/logo_hex.ico",
    apple: "/logo_hex_transparent.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
