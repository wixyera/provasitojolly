import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jolly Dolciumi · Tutto il buono in un solo posto",
  description: "Dolci, snack, patatine, cioccolato, bibite e attrezzature per gelati e granite.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.webmanifest",
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
