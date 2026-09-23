# DATA-SOURCES.md

Every external data feed Aadukalam reads, what it pulls, how it is used and the terms posture.
The app fetches all of this live per request and renders it. It does not store, republish, or
redistribute any provider's data, so no redistribution grant is relied on. Where a provider
publishes explicit terms we follow them, where an endpoint is public with no stated grant we use
it read-only and say so here rather than assuming permission we do not have.

## Pyth (Hermes price service)
- Pulls: latest price updates and price-feed metadata for equity, xStock and Ondo feeds.
- Used by: TruePrice, Nightguard, The Call (display) and The Call on-chain settlement.
- Terms: the live price endpoints are key-gated (Pyth Pro) since 2026-08-26. We read them
  server-side with a key the operator supplies, never in the browser. Feed-id metadata is free.
  Used read-only, no price data is republished.

## Jupiter (swap and price API)
- Pulls: quotes, swap transactions to be signed by the user and token prices including the
  underlying-equity reference each xStock carries.
- Used by: Conviction, Swipe, TruePrice, Leash.
- Terms: public API, keyless lite tier or a keyed tier. We call it server-side through a proxy.
  Swap transactions are returned unsigned and signed by the user's own wallet. Read-only use of
  price data, nothing republished.

## Kamino (klend, on-chain plus public API)
- Pulls: market, reserve and obligation state, then builds borrow, repay or withdraw transactions.
- Used by: Swipe, Nightguard.
- Terms: on-chain state is public. The SDK is MIT. Every transaction is returned unsigned for the
  user to sign. We move no funds.

## Meteora (Dynamic Bonding Curve SDK, on-chain)
- Pulls: builds launch configs and pool transactions, quotes the curve off-chain.
- Used by: Opening Bell.
- Terms: on-chain program, MIT SDK. Pool creation is a user-signed transaction.

## Tessera and PreStocks (pre-IPO REST APIs)
- Pulls: token lists, prices, mark and implied valuations, plus for Tessera the backing-proof
  references (Chainlink Proof-of-Reserve pages, custody, audit id).
- Used by: Receipt.
- Terms: public REST endpoints. Used read-only to display each token's own disclosures and to
  compute premium, discount and implied valuation from the fields the APIs return. The two
  providers are kept separate and never merged. No data is republished beyond live display.

## MiniMax (model API)
- Pulls: chat completions with tool calls for the Leash agent.
- Used by: Leash.
- Terms: accessed server-side with the operator's key. Prompts and tool results are the app's own.

## Token registry (packages/data/tokens.json)
- 58 tokenized-stock mints verified on-chain as Token-2022, with issuer rights compiled from each
  issuer's own public documentation. Provenance is recorded in the build notes. No mint is invented.
- Rights and backing text summarize each issuer's public disclosures and are labeled as such in
  Fine Print, not presented as legal advice.
