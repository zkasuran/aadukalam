"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// ssr: false is legal here because this file is a client component. It keeps all
// browser-only wallet code out of the server render, which stops the hydration
// and "window is not defined" errors.
const WalletContextProvider = dynamic(
  () => import("./WalletContextProvider").then((m) => m.WalletContextProvider),
  { ssr: false }
);

export function ClientWalletProvider({ children }: { children: ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}
