import { CommandError } from "@metamask/agent-wallet/plugin";
import { formatUnits, parseUnits } from "viem";

export function parseAmount(raw: string | undefined, decimals: number, label = "amount"): bigint {
  const value = raw?.trim();
  if (value === undefined || value === "") {
    throw new CommandError("MISSING_AMOUNT", `Missing ${label}.`, `Pass a positive ${label}, e.g. 100.`);
  }
  let parsed: bigint;
  try {
    parsed = parseUnits(value, decimals);
  } catch {
    throw new CommandError(
      "INVALID_AMOUNT",
      `Invalid ${label}: "${value}".`,
      `Use a decimal number with at most ${decimals} decimals.`,
    );
  }
  if (parsed <= 0n) {
    throw new CommandError("INVALID_AMOUNT", `${label} must be greater than zero.`, `Pass a positive ${label}.`);
  }
  return parsed;
}

export function formatAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

/** Split a base-unit total into `parts` roughly-equal tranches (remainder on the last). */
export function splitAmount(total: bigint, parts: number): bigint[] {
  if (parts <= 0) return [];
  const base = total / BigInt(parts);
  const tranches: bigint[] = [];
  let assigned = 0n;
  for (let i = 0; i < parts; i += 1) {
    if (i === parts - 1) {
      tranches.push(total - assigned);
    } else {
      tranches.push(base);
      assigned += base;
    }
  }
  return tranches;
}

export function computeSharesForAssets(assets: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n || totalAssets === 0n) return assets;
  return (assets * totalShares) / totalAssets;
}

export function computeAssetsForShares(shares: bigint, totalAssets: bigint, totalShares: bigint): bigint {
  if (totalShares === 0n) return 0n;
  return (shares * totalAssets) / totalShares;
}
