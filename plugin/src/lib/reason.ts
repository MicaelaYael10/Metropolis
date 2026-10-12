/** Mirrors RiskGuard.sol reason codes. */
export const REASON_CODES: Record<number, string> = {
  0: "OK",
  1: "NO_POLICY",
  2: "NOT_REGISTERED",
  3: "NOT_ACTIVE",
  4: "SCORE_TOO_HIGH",
  5: "PROTOCOL_CAP",
  6: "TOO_MANY_PROTOCOLS",
  7: "AMOUNT_TOO_HIGH",
  8: "ZERO_AMOUNT",
};

export function reasonName(code: number): string {
  return REASON_CODES[code] ?? `UNKNOWN_${code}`;
}

export function reasonDescription(code: number): string {
  switch (code) {
    case 0:
      return "Operation passed every policy check.";
    case 1:
      return "The user has not set a risk policy (run: riskguard policy --set ...).";
    case 2:
      return "Protocol is not registered in the ProtocolRegistry.";
    case 3:
      return "Protocol is registered but inactive.";
    case 4:
      return "Protocol risk score is above the policy maximum.";
    case 5:
      return "Adding this amount would exceed the per-protocol exposure cap.";
    case 6:
      return "The policy allows fewer distinct protocols than this would use.";
    case 7:
      return "Amount exceeds the per-operation maximum.";
    case 8:
      return "Amount must be greater than zero.";
    default:
      return "Unknown reason code.";
  }
}

/** ProtocolRegistry.band: 0 = green (<30), 1 = amber (30..60), 2 = red (>60). */
export function riskBand(score: number): "green" | "amber" | "red" {
  if (score < 30) return "green";
  if (score <= 60) return "amber";
  return "red";
}

const CATEGORIES = ["Staking", "Lending", "Liquidity", "Other"] as const;

export function categoryName(id: number): string {
  return CATEGORIES[id] ?? "Unknown";
}
