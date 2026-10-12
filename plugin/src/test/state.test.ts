import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CommandError } from "@metamask/agent-wallet/plugin";
import type { PluginCommandContext } from "@metamask/agent-wallet/plugin";
import { assertChainEstimable } from "../lib/state.js";
import { MONAD_TESTNET_CHAIN_ID } from "../lib/chains.js";

function ctxWith(customEvmChains: unknown): PluginCommandContext {
  return {
    walletStateManager: { read: () => ({ customEvmChains }) },
  } as unknown as PluginCommandContext;
}

describe("assertChainEstimable", () => {
  it("passes when Monad Testnet is registered as a custom chain", () => {
    const ctx = ctxWith([{ chainId: MONAD_TESTNET_CHAIN_ID, rpcTarget: "https://testnet-rpc.monad.xyz" }]);
    assert.doesNotThrow(() => assertChainEstimable(ctx, MONAD_TESTNET_CHAIN_ID));
  });

  it("accepts a string chainId", () => {
    const ctx = ctxWith([{ chainId: String(MONAD_TESTNET_CHAIN_ID) }]);
    assert.doesNotThrow(() => assertChainEstimable(ctx, MONAD_TESTNET_CHAIN_ID));
  });

  it("throws a CommandError when the custom chain entry is missing", () => {
    assert.throws(() => assertChainEstimable(ctxWith([]), MONAD_TESTNET_CHAIN_ID), CommandError);
    assert.throws(() => assertChainEstimable(ctxWith(undefined), MONAD_TESTNET_CHAIN_ID), CommandError);
  });

  it("ignores other chains", () => {
    assert.doesNotThrow(() => assertChainEstimable(ctxWith(undefined), 8453));
  });
});
