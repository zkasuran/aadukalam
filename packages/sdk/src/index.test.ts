import { describe, it, expect } from "vitest";
import { createConfig, SDK_VERSION } from "./index";

describe("sdk placeholder", () => {
  it("builds a config", () => {
    const cfg = createConfig("devnet", "https://api.devnet.solana.com");
    expect(cfg.cluster).toBe("devnet");
    expect(cfg.rpcUrl).toContain("devnet");
  });

  it("exposes a version", () => {
    expect(SDK_VERSION).toBe("0.0.0");
  });
});
