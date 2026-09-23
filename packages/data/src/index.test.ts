import { describe, it, expect } from "vitest";
import {
  loadTokens,
  getToken,
  allThemes,
  tokensByTheme,
  bestPythFeed,
} from "./index";

describe("token registry", () => {
  const tokens = loadTokens();

  it("loads the verified registry", () => {
    expect(tokens.length).toBeGreaterThanOrEqual(50);
  });

  it("every token has a mint, a ticker and the Token-2022 program", () => {
    for (const t of tokens) {
      expect(t.mint.length).toBeGreaterThan(30);
      expect(t.ticker.length).toBeGreaterThan(0);
      expect(t.tokenProgram).toBe("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
      expect(typeof t.decimals).toBe("number");
    }
  });

  it("mints are unique", () => {
    const mints = new Set(tokens.map((t) => t.mint));
    expect(mints.size).toBe(tokens.length);
  });

  it("getToken finds by ticker and by mint", () => {
    const first = tokens[0];
    expect(getToken(first.ticker)?.mint).toBe(first.mint);
    expect(getToken(first.mint)?.ticker).toBe(first.ticker);
    expect(getToken("does-not-exist")).toBeUndefined();
  });

  it("themes resolve to tokens", () => {
    const themes = allThemes();
    expect(themes.length).toBeGreaterThan(0);
    for (const th of themes) {
      expect(tokensByTheme(th).length).toBeGreaterThan(0);
    }
  });

  it("bestPythFeed returns a feed when one exists", () => {
    const withFeed = tokens.find((t) => t.pythFeedId || t.pythEquityFeedId);
    expect(withFeed).toBeDefined();
    if (withFeed) expect(bestPythFeed(withFeed)).toBeTruthy();
  });
});

