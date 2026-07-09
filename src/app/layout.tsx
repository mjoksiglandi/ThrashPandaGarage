import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trashpanda Garage",
  description: "Photo, props, FX and weird builds.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
