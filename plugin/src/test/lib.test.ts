import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CommandError } from "@metamask/agent-wallet/plugin";
import {
  computeAssetsForShares,
  computeSharesForAssets,
  formatAmount,
  parseAmount,
  splitAmount,
} from "../lib/amount.js";
import { categoryName, reasonDescription, reasonName, riskBand } from "../lib/reason.js";

describe("parseAmount", () => {
  it("parses decimal amounts into base units", () => {
    assert.equal(parseAmount("100", 18), 100n * 10n ** 18n);
    assert.equal(parseAmount("0.5", 6), 500000n);
  });

  it("rejects missing, invalid and non-positive amounts with CommandError", () => {
    assert.throws(() => parseAmount(undefined, 6), CommandError);
    assert.throws(() => parseAmount("abc", 6), CommandError);
    assert.throws(() => parseAmount("0", 6), CommandError);
    assert.throws(() => parseAmount("-10", 6), CommandError);
  });
});

describe("formatAmount", () => {
  it("formats base units back to human units", () => {
    assert.equal(formatAmount(1234567890n, 6), "1234.56789");
  });
});

describe("splitAmount", () => {
  it("splits into roughly-equal tranches with remainder on the last", () => {
    assert.deepEqual(splitAmount(100n, 3), [33n, 33n, 34n]);
    assert.deepEqual(splitAmount(300n, 3), [100n, 100n, 100n]);
  });

  it("returns no tranches for zero parts", () => {
    assert.deepEqual(splitAmount(10n, 0), []);
  });
});

describe("share conversion", () => {
  it("converts assets to shares and back using pool totals", () => {
    const shares = computeSharesForAssets(50n, 100n, 200n);
    assert.equal(shares, 100n);
    assert.equal(computeAssetsForShares(shares, 100n, 200n), 50n);
  });

  it("uses 1:1 when the pool is empty", () => {
    assert.equal(computeSharesForAssets(50n, 0n, 0n), 50n);
    assert.equal(computeAssetsForShares(50n, 0n, 0n), 0n);
  });
});

describe("reasonName", () => {
  it("maps the on-chain reason codes", () => {
    assert.equal(reasonName(0), "OK");
    assert.equal(reasonName(4), "SCORE_TOO_HIGH");
    assert.equal(reasonName(7), "AMOUNT_TOO_HIGH");
    assert.equal(reasonName(99), "UNKNOWN_99");
  });
});

describe("reasonDescription", () => {
  it("explains what the user can do about each reason", () => {
    assert.match(reasonDescription(1), /policy/i);
    assert.match(reasonDescription(4), /risk score/i);
  });
});

describe("riskBand", () => {
  it("maps scores to green/amber/red bands matching ProtocolRegistry", () => {
    assert.equal(riskBand(0), "green");
    assert.equal(riskBand(29), "green");
    assert.equal(riskBand(30), "amber");
    assert.equal(riskBand(60), "amber");
    assert.equal(riskBand(61), "red");
    assert.equal(riskBand(100), "red");
  });
});

describe("categoryName", () => {
  it("maps the registry category enum", () => {
    assert.equal(categoryName(0), "Staking");
    assert.equal(categoryName(1), "Lending");
    assert.equal(categoryName(2), "Liquidity");
    assert.equal(categoryName(3), "Other");
    assert.equal(categoryName(9), "Unknown");
  });
});