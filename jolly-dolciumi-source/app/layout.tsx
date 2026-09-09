import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jolly Dolciumi · Scegli dolce",
  description: "Caramelle, cioccolato e sorprese da condividere.",
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
    <html lang="it">
      <body className="antialiased">
        <script src="/config.js" />
        {children}
      </body>
    </html>
  );
}
