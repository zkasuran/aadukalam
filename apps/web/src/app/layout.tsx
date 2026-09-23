import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

import { ClientWalletProvider } from "@/components/solana/ClientWalletProvider";
import { SiteNav } from "@/components/nav/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { AuroraBackground } from "@/components/site/AuroraBackground";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aadukalam, the arena that never closes",
  description:
    "An honest neobrokerage for tokenized stocks on Solana. Spend, borrow, earn and bet on your stocks around the clock, on one app that tells you exactly what you hold.",
  openGraph: {
    title: "Aadukalam, the arena that never closes",
    description:
      "One honest neobrokerage for tokenized stocks on Solana. Ten modules, open 24/7.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AuroraBackground />
        <ClientWalletProvider>
          <SiteNav />
          <main className="relative z-10">{children}</main>
          <SiteFooter />
        </ClientWalletProvider>
      </body>
    </html>
  );
}
