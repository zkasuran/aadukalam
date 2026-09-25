# Aadukalam

The arena that never closes. One honest neobrokerage for tokenized stocks on Solana, built for the Stocklana hackathon. "Aadukalam" is Tamil for the arena, the ground where the contest is fought. Regular brokerages shut at 4pm and go dark on weekends. Tokenized stocks trade around the clock, so the account that holds them should too.

Ten modules under four pillars, on one wallet session and one design system.

## The four pillars, ten modules

| Pillar | Module | Route | What it does |
| --- | --- | --- | --- |
| KNOW | Fine Print | `/know/fineprint` | Reads your wallet and says in plain English what each holding is: real or synthetic, voting rights, dividend path, redemption, backing quality. |
| KNOW | Receipt | `/know/receipt` | Scores whether a pre-IPO token is really backed. Keeps Tessera and PreStocks side by side without merging them, so the proof asymmetry shows. |
| KNOW | TruePrice | `/know/trueprice` | A 24/7 fair value. Sits the on-chain DEX price next to a Pyth reference and flags the premium or discount while the exchange is shut. |
| GROW | Conviction | `/grow/conviction` | One-tap thematic baskets that rebalance on a rule, executed as Jupiter swaps the user signs. |
| GROW | Leash | `/grow/leash` | A chat agent that proposes trades inside hard limits you set. A pure code gate enforces the guardrail before any transaction is built. |
| GROW | Paycheck | `/grow/paycheck` | Turns the silent xStocks dividend rebase into real USDC you can watch land, through an on-chain vault. |
| USE | Swipe | `/use/swipe` | Spend against your portfolio at checkout by borrowing on Kamino, so no share is sold and no taxable disposal happens. |
| USE | Nightguard | `/use/nightguard` | An off-hours liquidation shield. Tracks the buffer to liquidation and the market clock so an overnight wick does not catch you asleep. |
| PLAY | The Call | `/play/thecall` | A prediction market on stock outcomes, settled on-chain by Pyth as the authority rather than a display feed. |
| Companion | Opening Bell | `/opening-bell` | An equity-tuned launchpad on Meteora DBC with three presets. A separate issuer-facing surface, kept out of the consumer pitch. |

## Architecture

A pnpm and Turborepo monorepo.

```
apps/web         Next.js 14 App Router, TypeScript, Tailwind, shadcn/ui, wallet-adapter
packages/sdk     @aadukalam/sdk    shared client logic, one namespace per module
packages/data    @aadukalam/data   token and issuer-rights registry
anchor/          Anchor workspace: programs/paycheck, programs/thecall (devnet)
```

Module UIs live under `apps/web/src/app/<pillar>/<module>/`, the API routes under `apps/web/src/app/api/<module>/`.

### One web3 base, Kamino walled off

The base stack is `@solana/web3.js` 1.x with `@coral-xyz/anchor` 0.32.1, because that is what wallet-adapter and the Anchor TypeScript client speak. Kamino's `@kamino-finance/klend-sdk` v12 runs on `@solana/kit` (web3 v2), so every Kamino call is isolated behind server routes under `apps/web/src/app/api/kamino/*` that import kit locally and return plain JSON or a base64 transaction. klend-sdk is never imported into a client component. Swipe and Nightguard call those routes. The v1 and v2 worlds never meet in the client bundle.

### On-chain programs (devnet)

Two Anchor programs, configured for devnet:

| Program | Program id | Instructions |
| --- | --- | --- |
| paycheck (dividend vault) | `9DAHUC1KQUsBMB9cQk8EdVZfKAhVukLhUsyuQYZBLgAy` | `initialize`, `deposit`, `record_rebase`, `claim` |
| thecall (Pyth-settled market) | `83f9z9RHjyvFSbcvWQixNq13vXiu35baFiDtqvG8q7LY` | `create_market`, `bet`, `resolve`, `claim` |

`anchor build` passes and all 8 program tests run green on a local validator with staged Pyth price accounts. The Call reads a real `PriceUpdateV2` account on-chain to resolve.

## Integrations

Real SDKs and APIs, not mocks.

- Pyth: fair value for TruePrice, Nightguard and The Call. Read straight off Solana mainnet, no API key. Pyth keeps sponsored price-feed accounts live on-chain, so a server proxy derives each feed's PDA under the push-oracle program and reads the `PriceUpdateV2` account over RPC. The Hermes HTTP price service was put behind a paid key in the August 2026 Pyth Core upgrade; the on-chain feeds stay permissionless. A `PYTH_API_KEY` can switch on the keyed Hermes path but is not required. A token with no live equity feed falls back to the Jupiter underlying-equity reference.
- Jupiter swap API: quotes and swaps for Conviction, Leash and Swipe.
- Kamino klend v12: borrow quotes and liquidation health for Swipe and Nightguard, isolated on `@solana/kit` behind the server routes above.
- Meteora DBC SDK: three equity-tuned launch presets for Opening Bell.
- Tessera and PreStocks APIs: the pre-IPO backing data behind Receipt, kept as separate providers so their proof asymmetry is visible.
- MiniMax M3: the Leash agent, server-side only, with tool calling for price, quote and propose-trade.

The token layer is a 58-token registry, every entry a verified Token-2022 mint, each carrying its issuer rights, theme tags and a Pyth feed id where one exists.

## Run it

Requires Node 22 and pnpm 11.

```bash
pnpm install
pnpm dev         # run the web app
pnpm build       # build every package (10 module routes, 12 API routes)
pnpm typecheck
pnpm lint
pnpm test        # 171 unit tests
```

The Anchor programs build and test from the `anchor/` workspace:

```bash
cd anchor
pnpm install
anchor build
anchor test      # 8 program tests, local validator with staged Pyth accounts
```

## Environment

Copy `.env.example` to `.env.local` and fill what you need. The app runs with defaults and no secrets, in fallback mode.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC_MAINNET` | Mainnet RPC for third-party protocol reads (Jupiter, Kamino, balances). |
| `NEXT_PUBLIC_SOLANA_RPC_DEVNET` | Devnet RPC for our programs. |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Active cluster, `devnet` by default. |
| `NEXT_PUBLIC_PYTH_HERMES` | Pyth Hermes base URL. |
| `PYTH_API_KEY` | Optional. Switches on the keyed Hermes price path. Unset reads Pyth on-chain from Solana mainnet, no key. |
| `JUPITER_API_BASE` | Jupiter API base. The keyless lite tier needs no key. |
| `JUPITER_API_KEY` | Optional key for the paid Jupiter tier. |
| `MINIMAX_API_BASE` | MiniMax OpenAI-compatible base URL, server-side. |
| `MINIMAX_API_KEY` | MiniMax key for the Leash agent, server-side only. |
| `MINIMAX_MODEL` | Model id, `MiniMax-M3` by default. |
| `ANCHOR_WALLET` | Devnet deployer keypair path, devnet SOL only. |

## Real vs simulated

No funds move from the app. Our programs run on devnet. Every third-party execution is a transaction the app builds and the user signs with their own wallet.

Real:
- On-chain balances read over RPC (Fine Print).
- Jupiter quotes and swaps the user signs (Conviction, Leash, Swipe).
- Kamino market, reserve and obligation reads plus the built borrow transaction (Swipe, Nightguard).
- Pyth 24/7 fair value read on-chain from Solana mainnet, keyless (TruePrice), the Jupiter equity reference as a fallback.
- Tessera and PreStocks backing data (Receipt).
- The MiniMax tool-calling agent (Leash).
- Meteora DBC pool configuration and curve math (Opening Bell).
- The two Anchor programs, tested through their full lifecycle on a local validator.

Labeled as modeled on-screen:
- Paycheck's rebase is a devnet stand-in for the mainnet xStocks rebase mechanism, using a test token whose supply we can bump.
- The off-hours fair value is a model built on the last equity print plus the live feed, marked as such.
- The keepers (Paycheck stream, Nightguard deleverage, Conviction rebalance) are shown as armed policies. No unattended signing happens here.
- The Call settles against a staged Pyth price update in tests, paid in devnet USDC.

A price that could not be fetched shows "no live price", never a fake one.

## Licence and AI disclosure

Licence: Source-Available No-Derivatives 1.0 (SPDX `LicenseRef-zkasuran-SAND-1.0`). See `LICENSE`. This is a competition entry, not a contribution, so the outbound licence is source-available and no-derivatives. Third-party SDKs keep their own licences.

Built with Claude (Anthropic). The design, review and verification were done by the author. Verified before shipping: 171 unit tests, a full production build across 10 module routes and 12 API routes, plus `anchor build` and 8 program tests.
