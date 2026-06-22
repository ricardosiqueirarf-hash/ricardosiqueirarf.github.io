import "./globals.css";
import "./dashboard.css";
import "./dashboard-nav.css";
import "./loading-message.css";
import "./global-door-3d.css";
import "./reference-landing.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ANODIZA",
  description: "Sistema SaaS para lojas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
