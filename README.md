# Aadukalam

The arena that never closes. A tokenized-stocks super-app on Solana, built for the
Stocklana hackathon. Nine modules under four pillars, one honest neobrokerage.

- KNOW: Fine Print, Receipt, TruePrice
- GROW: Conviction, Leash, Paycheck
- USE: Swipe, Nightguard
- PLAY: The Call
- Companion: Opening Bell (Meteora DBC launchpad)

## Layout

- `apps/web` Next.js 14 App Router frontend with the Solana wallet adapter.
- `packages/sdk` shared TypeScript SDK.
- `packages/data` token and issuer-rights registry.
- `anchor` Anchor workspace with the on-chain programs (devnet).

## Develop

```bash
pnpm install
pnpm dev            # run the web app
pnpm build          # build every JS package
pnpm typecheck
pnpm lint
pnpm test

cd anchor
pnpm install
anchor build        # build the programs
```

## Notes

Our programs deploy to devnet and move no real funds. Third-party protocol calls
are wallet actions the user signs, or mainnet read-only quotes. See `.env.example`
for the runtime configuration.

Licence: source-available, no derivatives (SPDX `LicenseRef-zkasuran-SAND-1.0`).
Third-party SDKs keep their own licences, named in NOTICE.
