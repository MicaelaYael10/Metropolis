import { parseAbi } from "viem";

export const riskGuardAbi = parseAbi([
  "function policyOf(address user) view returns (uint8 maxRiskScore, uint8 maxProtocols, uint256 maxPerProtocol, uint256 maxAmountPerOp, bool active)",
  "function setPolicy(uint8 maxRiskScore, uint8 maxProtocols, uint256 maxPerProtocol, uint256 maxAmountPerOp)",
  "function setAgent(address agent)",
  "function revokeAgent()",
  "function agentOf(address user) view returns (address)",
  "function checkOperation(address user, address protocol, uint256 amount) view returns (bool allowed, uint8 reasonCode, uint8 riskScore)",
  "function commitOperation(address user, address protocol, uint256 amount, bytes32 rationaleHash) returns (uint256 logIndex)",
  "function recordRejection(address user, address protocol, uint256 amount, bytes32 rationaleHash) returns (uint256 logIndex)",
  "function protocolExposureOf(address user, address protocol) view returns (uint256)",
  "function exposure(address user) view returns (uint256)",
  "function totalCommitted() view returns (uint256)",
  "function totalRejections() view returns (uint256)",
]);

export const registryAbi = parseAbi([
  "function list() view returns (address[])",
  "function size() view returns (uint256)",
  // getProtocol devuelve un struct con un `string` (dinamico): hay que declararlo como tupla.
  "function getProtocol(address target) view returns ((string name, uint8 category, uint8 riskScore, uint8 confidence, uint64 updatedAt, bytes32 evidenceHash, bool active, bool registered) protocol)",
  "function band(uint8 score) pure returns (uint8)",
]);

export const agentLogAbi = parseAbi([
  "function count() view returns (uint256)",
  "function entriesOf(address user) view returns (uint256[])",
  "function lastEntryOf(address user) view returns (address user, address protocol, uint256 amount, uint8 riskScore, uint8 reasonCode, bool allowed, bytes32 rationaleHash, uint64 timestamp)",
]);

/** Normaliza la salida decodificada (viem puede devolver array u objeto). */
export function asTuple(data: unknown): readonly unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") return Object.values(data as Record<string, unknown>);
  return [];
}
