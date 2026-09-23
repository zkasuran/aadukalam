import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ClientWalletProvider } from "@/components/solana/ClientWalletProvider";
import { SiteNav } from "@/components/nav/SiteNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aadukalam",
  description:
    "The arena that never closes. An honest neobrokerage for tokenized stocks on Solana.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ClientWalletProvider>
          <SiteNav />
          <main>{children}</main>
        </ClientWalletProvider>
      </body>
    </html>
  );
}
