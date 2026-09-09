import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Davide · Player One",
  description: "Pokémon, gaming, Serie A e street style. Quattro passioni, un universo: quello di Davide.",
  icons: {
    icon: "/davide-logo.svg",
    shortcut: "/davide-logo.svg",
    apple: "/davide-icon.png",
  },
  manifest: "/davide.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        <Script src="/config.js" strategy="beforeInteractive" />
        <Script src="/register-sw.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
