"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { ShieldCheck } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { claim, deposit, initialize, recordRebase } from "../_lib/actions";
import { USDC_DECIMALS } from "../_lib/constants";
import {
  PAYCHECK_PROGRAM_ID,
  describeError,
  fetchConfig,
  fetchMintDecimals,
  fetchPosition,
  getDevnetConnection,
  getPaycheckProgram,
  getReadonlyProgram,
  isProgramDeployed,
  toPublicKey,
} from "../_lib/program";
import type {
  ActionResult,
  ConfigView,
  DeployStatus,
  PositionView,
  RebaseEntry,
} from "../_lib/types";
import { DepositCard } from "./DepositCard";
import { KeeperPanel } from "./KeeperPanel";
import { PositionPanel } from "./PositionPanel";
import { ProgramStatusBanner } from "./ProgramStatusBanner";
import { RebaseHistory } from "./RebaseHistory";

// The Paycheck client. One devnet connection, one anchor program per action, with
// every write signed by the connected wallet. It first checks the program is
// deployed, then reads config and the holder position, then drives deposit,
// record_rebase and claim. Nothing is signed or held server-side.
export function PaycheckDashboard() {
  const wallet = useAnchorWallet();
  const { publicKey, connected } = useWallet();
  const connection = useMemo(() => getDevnetConnection(), []);

  const [deployStatus, setDeployStatus] = useState<DeployStatus>("checking");
  const [config, setConfig] = useState<ConfigView | null>(null);
  const [position, setPosition] = useState<PositionView | null>(null);
  const [stockMint, setStockMint] = useState("");
  const [stockDecimals, setStockDecimals] = useState<number | null>(null);
  const [stockMintValid, setStockMintValid] = useState(false);
  const [rebaseLog, setRebaseLog] = useState<RebaseEntry[]>([]);

  const [refreshing, setRefreshing] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [initBusy, setInitBusy] = useState(false);
  const [rebaseBusy, setRebaseBusy] = useState(false);

  const [depositResult, setDepositResult] = useState<ActionResult | null>(null);
  const [claimResult, setClaimResult] = useState<ActionResult | null>(null);
  const [initResult, setInitResult] = useState<ActionResult | null>(null);
  const [rebaseResult, setRebaseResult] = useState<ActionResult | null>(null);

  const walletPubkey = publicKey?.toBase58() ?? null;

  const checkDeployment = useCallback(async () => {
    setDeployStatus("checking");
    try {
      const deployed = await isProgramDeployed(connection);
      if (!deployed) {
        setDeployStatus("absent");
        setConfig(null);
        return;
      }
      setDeployStatus("deployed");
      setConfig(await fetchConfig(getReadonlyProgram(connection)));
    } catch {
      setDeployStatus("error");
    }
  }, [connection]);

  useEffect(() => {
    checkDeployment();
  }, [checkDeployment]);

  // Resolve the stock mint decimals from chain as the address is typed.
  useEffect(() => {
    let alive = true;
    const pk = toPublicKey(stockMint);
    setStockMintValid(pk != null);
    if (!pk) {
      setStockDecimals(null);
      return;
    }
    (async () => {
      const decimals = await fetchMintDecimals(connection, pk);
      if (alive) setStockDecimals(decimals);
    })();
    return () => {
      alive = false;
    };
  }, [stockMint, connection]);

  const loadPosition = useCallback(async () => {
    const stockPk = toPublicKey(stockMint);
    if (deployStatus !== "deployed" || !publicKey || !stockPk) {
      setPosition(null);
      return;
    }
    const program = getReadonlyProgram(connection);
    setPosition(await fetchPosition(program, publicKey, stockPk));
  }, [connection, deployStatus, publicKey, stockMint]);

  useEffect(() => {
    loadPosition();
  }, [loadPosition]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (deployStatus === "deployed") {
        setConfig(await fetchConfig(getReadonlyProgram(connection)));
      }
      await loadPosition();
    } finally {
      setRefreshing(false);
    }
  }, [connection, deployStatus, loadPosition]);

  const handleDeposit = useCallback(
    async (amountBaseUnits: bigint) => {
      const stockPk = toPublicKey(stockMint);
      if (!wallet || !publicKey || !stockPk) return;
      setDepositBusy(true);
      setDepositResult(null);
      try {
        const program = getPaycheckProgram(connection, wallet);
        const sig = await deposit(program, publicKey, stockPk, amountBaseUnits);
        setDepositResult({ ok: true, signature: sig });
        await refresh();
      } catch (err) {
        setDepositResult({ ok: false, error: describeError(err) });
      } finally {
        setDepositBusy(false);
      }
    },
    [connection, wallet, publicKey, stockMint, refresh],
  );

  const handleClaim = useCallback(async () => {
    const stockPk = toPublicKey(stockMint);
    const usdcPk = config ? toPublicKey(config.usdcMint) : null;
    if (!wallet || !publicKey || !stockPk || !usdcPk) return;
    setClaimBusy(true);
    setClaimResult(null);
    try {
      const program = getPaycheckProgram(connection, wallet);
      const sig = await claim(program, publicKey, usdcPk, stockPk);
      setClaimResult({ ok: true, signature: sig });
      await refresh();
    } catch (err) {
      setClaimResult({ ok: false, error: describeError(err) });
    } finally {
      setClaimBusy(false);
    }
  }, [connection, wallet, publicKey, stockMint, config, refresh]);

  const handleInitialize = useCallback(
    async (keeperStr: string, usdcMintStr: string) => {
      if (!wallet || !publicKey) return;
      const keeperPk = toPublicKey(keeperStr);
      const usdcPk = toPublicKey(usdcMintStr);
      if (!keeperPk) {
        setInitResult({ ok: false, error: "Keeper is not a valid pubkey." });
        return;
      }
      if (!usdcPk) {
        setInitResult({ ok: false, error: "USDC mint is not a valid pubkey." });
        return;
      }
      setInitBusy(true);
      setInitResult(null);
      try {
        const program = getPaycheckProgram(connection, wallet);
        const sig = await initialize(program, publicKey, keeperPk, usdcPk);
        setInitResult({ ok: true, signature: sig });
        await refresh();
      } catch (err) {
        setInitResult({ ok: false, error: describeError(err) });
      } finally {
        setInitBusy(false);
      }
    },
    [connection, wallet, publicKey, refresh],
  );

  const handleRecordRebase = useCallback(
    async (dividendUsdcBaseUnits: bigint, newMultiplierBps: number) => {
      const stockPk = toPublicKey(stockMint);
      if (!wallet || !publicKey || !stockPk) return;
      const oldBps = position?.lastMultiplierBps ?? 10000;
      setRebaseBusy(true);
      setRebaseResult(null);
      try {
        const program = getPaycheckProgram(connection, wallet);
        // Single-wallet demo: the connected keeper records for itself as holder.
        const sig = await recordRebase(
          program,
          publicKey,
          publicKey,
          stockPk,
          dividendUsdcBaseUnits,
          newMultiplierBps,
        );
        setRebaseResult({ ok: true, signature: sig });
        setRebaseLog((prev) => [
          {
            signature: sig,
            recordedAt: Date.now(),
            user: publicKey.toBase58(),
            oldMultiplierBps: oldBps,
            newMultiplierBps,
            dividendUsdcBaseUnits,
          },
          ...prev,
        ]);
        await refresh();
      } catch (err) {
        setRebaseResult({ ok: false, error: describeError(err) });
      } finally {
        setRebaseBusy(false);
      }
    },
    [connection, wallet, publicKey, stockMint, position, refresh],
  );

  const usdcDecimals = config?.usdcDecimals ?? USDC_DECIMALS;
  const walletIsKeeper = config != null && walletPubkey === config.keeper;
  const walletIsAdmin = config != null && walletPubkey === config.admin;
  const actionsDisabled = deployStatus !== "deployed";

  return (
    <div className="mt-6 space-y-5">
      <ProgramStatusBanner
        status={deployStatus}
        programId={PAYCHECK_PROGRAM_ID.toBase58()}
        onRetry={checkDeployment}
      />

      <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="leading-relaxed">
          Every action here builds a transaction your own wallet signs on devnet.
          No funds move server-side and no key is held for you. Deposits open a
          program vault, the keeper posts the USDC value of a rebase, then you
          claim the accrued USDC.
        </p>
      </div>

      <Tabs defaultValue="holder">
        <TabsList>
          <TabsTrigger value="holder">Holder</TabsTrigger>
          <TabsTrigger value="keeper">Keeper / Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="holder" className="space-y-5">
          <DepositCard
            stockMint={stockMint}
            onStockMintChange={setStockMint}
            stockDecimals={stockDecimals}
            stockMintValid={stockMintValid}
            connected={connected}
            disabled={actionsDisabled}
            busy={depositBusy}
            onDeposit={handleDeposit}
            result={depositResult}
          />
          <PositionPanel
            position={position}
            usdcDecimals={usdcDecimals}
            connected={connected}
            disabled={actionsDisabled}
            busy={claimBusy}
            onClaim={handleClaim}
            onRefresh={refresh}
            refreshing={refreshing}
            result={claimResult}
          />
          <RebaseHistory entries={rebaseLog} />
        </TabsContent>

        <TabsContent value="keeper">
          <KeeperPanel
            connected={connected}
            walletPubkey={walletPubkey}
            config={config}
            walletIsKeeper={walletIsKeeper}
            walletIsAdmin={walletIsAdmin}
            disabled={actionsDisabled}
            position={position}
            usdcDecimals={usdcDecimals}
            busyInit={initBusy}
            busyRebase={rebaseBusy}
            onInitialize={handleInitialize}
            onRecordRebase={handleRecordRebase}
            initResult={initResult}
            rebaseResult={rebaseResult}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
