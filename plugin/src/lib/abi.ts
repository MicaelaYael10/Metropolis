// Minimal ABIs for the RiskGuard stack. Kept hand-written and `as const` so viem
// infers named tuple fields for reads and encodes calls without extra plumbing.

export const riskGuardAbi = [
  {
    type: "function",
    name: "setPolicy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "maxRiskScore", type: "uint8" },
      { name: "maxProtocols", type: "uint8" },
      { name: "maxPerProtocol", type: "uint256" },
      { name: "maxAmountPerOp", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "checkOperation",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "protocol", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [
      { name: "allowed", type: "bool" },
      { name: "reasonCode", type: "uint8" },
      { name: "riskScore", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "commitOperation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "protocol", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "rationaleHash", type: "bytes32" },
    ],
    outputs: [{ name: "logIndex", type: "uint256" }],
  },
  {
    type: "function",
    name: "recordRejection",
    stateMutability: "nonpayable",
    inputs: [
      { name: "user", type: "address" },
      { name: "protocol", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "rationaleHash", type: "bytes32" },
    ],
    outputs: [{ name: "logIndex", type: "uint256" }],
  },
  {
    type: "function",
    name: "policyOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "maxRiskScore", type: "uint8" },
          { name: "maxProtocols", type: "uint8" },
          { name: "maxPerProtocol", type: "uint256" },
          { name: "maxAmountPerOp", type: "uint256" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "exposure",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "committedCount",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "protocolsUsedBy",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "protocolExposureOf",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "protocol", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export const protocolRegistryAbi = [
  {
    type: "function",
    name: "getProtocol",
    stateMutability: "view",
    inputs: [{ name: "target", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "category", type: "uint8" },
          { name: "riskScore", type: "uint8" },
          { name: "confidence", type: "uint8" },
          { name: "updatedAt", type: "uint64" },
          { name: "evidenceHash", type: "bytes32" },
          { name: "active", type: "bool" },
          { name: "registered", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "list",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "size",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "band",
    stateMutability: "view",
    inputs: [{ name: "score", type: "uint8" }],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const agentLogAbi = [
  {
    type: "function",
    name: "count",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "entry",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "user", type: "address" },
          { name: "protocol", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "riskScore", type: "uint8" },
          { name: "reasonCode", type: "uint8" },
          { name: "allowed", type: "bool" },
          { name: "rationaleHash", type: "bytes32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "entriesOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
] as const;

export const mockVaultAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "assets", type: "uint256" }],
  },
  {
    type: "function",
    name: "sharesOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalShares",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
