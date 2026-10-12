import { CommandError } from "@metamask/agent-wallet/plugin";
import type { CommandIO, PluginCommandContext } from "@metamask/agent-wallet/plugin";
import type { Abi, Hex } from "viem";
import { encodeFunctionData } from "viem";
import { MONAD_TESTNET_EXPLORER, MONAD_TESTNET_CHAIN_ID } from "./chains.js";
import { assertChainEstimable } from "./state.js";

export type TxIntentAction =
  | "call"
  | "transfer"
  | "lending.approve"
  | "lending.supply"
  | "lending.withdraw";

export type TxIntent = {
  summary: string;
  action: TxIntentAction;
  details?: Record<string, string | undefined>;
};

export type ContractCall = {
  to: Hex;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

export type TxOutcome = {
  hash: string;
  status: string;
  explorerUrl: string;
};

export function explorerTxUrl(chainId: number, hash: string): string {
  if (chainId === MONAD_TESTNET_CHAIN_ID) return `${MONAD_TESTNET_EXPLORER}/tx/${hash}`;
  return `${MONAD_TESTNET_EXPLORER}/tx/${hash}`;
}

function encodeCall(call: ContractCall): Hex {
  try {
    return encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    } as unknown as Parameters<typeof encodeFunctionData>[0]);
  } catch (error) {
    throw new CommandError(
      "INVALID_INPUT",
      `Could not encode ${call.functionName}: ${(error as Error).message}`,
      "Check the command arguments and contract ABI.",
    );
  }
}

/**
 * Route a single contract call through the MetaMask Agent Wallet executor.
 * The private key never leaves the wallet: every tx is policy-checked and
 * (where applicable) MFA-gated by the host before signing.
 */
export async function submitContractCall(
  ctx: PluginCommandContext,
  io: CommandIO,
  source: string,
  chainId: number,
  call: ContractCall,
  options: { intent?: TxIntent; waitForReceipt?: boolean } = {},
): Promise<TxOutcome> {
  const data = encodeCall(call);
  assertChainEstimable(ctx, chainId);
  const executor = await ctx.walletExecutor(io, source);
  const result = await executor(
    {
      kind: "transaction",
      chainId,
      transaction: { to: call.to, data, value: call.value },
      intent: options.intent,
    },
    { signal: io.signal, waitForReceipt: options.waitForReceipt },
  );

  if (result.kind !== "transaction") {
    throw new CommandError("TX_FAILED", "Unexpected non-transaction result.", "Retry the command.");
  }
  if (result.failureCode || result.failureDescription) {
    throw new CommandError(
      result.failureCode ?? "TX_FAILED",
      result.failureDescription ?? "Transaction did not confirm.",
      "Check the transaction in the MetaMask Agent Wallet activity and retry.",
    );
  }

  return {
    hash: result.hash,
    status: result.status,
    explorerUrl: explorerTxUrl(chainId, result.hash),
  };
}

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new CommandError("ABORTED", "Command aborted.", "Re-run when ready."));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(new CommandError("ABORTED", "Command aborted.", "Re-run when ready."));
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
