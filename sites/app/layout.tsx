import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manto de Palpites",
  description: "A tradição entra em campo. Palpites da torcida do Flamengo.",
  icons: {
    icon: [{url:"/favicon-mp-v1-32.png",sizes:"32x32",type:"image/png"},{url:"/favicon-mp-v1-16.png",sizes:"16x16",type:"image/png"}],
    shortcut: "/favicon-mp-v1.ico",
    apple: "/favicon-mp-v1-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
