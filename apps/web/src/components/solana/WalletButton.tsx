"use client";

import dynamic from "next/dynamic";

// WalletMultiButton renders a different label on server than client, so load it
// dynamically with ssr: false to avoid the hydration mismatch.
export const WalletButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);
