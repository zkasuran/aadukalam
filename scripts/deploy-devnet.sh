#!/usr/bin/env bash
# Deploy both Aadukalam programs to devnet. Needs the deployer funded first.
# Fund: solana airdrop 2 <deployer> --url devnet  (or faucet.solana.com), ~4 SOL total.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="$ROOT/.devnet-keypair.json"
PUB="$(solana-keygen pubkey "$KEY")"
echo "deployer: $PUB"
echo "balance:  $(solana balance "$PUB" --url https://api.devnet.solana.com)"
cd "$ROOT/anchor"
anchor build
anchor deploy --provider.cluster devnet --provider.wallet "$KEY"
echo "paycheck: $(solana address -k target/deploy/paycheck-keypair.json)"
echo "thecall:  $(solana address -k target/deploy/thecall-keypair.json)"
echo "Set NEXT_PUBLIC_SOLANA_CLUSTER=devnet and a real NEXT_PUBLIC_SOLANA_RPC_DEVNET in the web env."
