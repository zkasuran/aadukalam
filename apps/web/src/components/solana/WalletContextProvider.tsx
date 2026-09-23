"use client";

import { ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { Buffer } from "buffer";

import { getRpcEndpoint } from "@/lib/rpc";

// wallet-adapter-react-ui ships its own stylesheet. Import it once here.
import "@solana/wallet-adapter-react-ui/styles.css";

// web3.js 1.x and some wallet libs assume a Node Buffer global in the browser.
if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => getRpcEndpoint(), []);

  // Phantom and Solflare, plus any Wallet Standard wallet the browser exposes.
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
