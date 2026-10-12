import assert from "node:assert/strict";
import { it } from "node:test";
import { CommandError } from "@metamask/agent-wallet/plugin";
import {
  MONAD_TESTNET_CHAIN_ID,
  resolveAddress,
  resolveChainId,
  resolveVaultAddress,
} from "../lib/chains.js";

const savedEnv = { ...process.env };

it("resolveChainId defaults to Monad Testnet", () => {
  delete process.env.RISKGUARD_CHAIN_ID;
  assert.equal(resolveChainId(), MONAD_TESTNET_CHAIN_ID);
  process.env = { ...savedEnv };
});

it("resolveChainId rejects malformed overrides", () => {
  process.env.RISKGUARD_CHAIN_ID = "monad";
  assert.throws(() => resolveChainId(), CommandError);
  process.env = { ...savedEnv };
});

it("resolveAddress requires a set, valid address and fails loudly otherwise", () => {
  delete process.env.RISKGUARD_TOKEN_ADDRESS;
  assert.throws(() => resolveAddress("RISKGUARD_TOKEN_ADDRESS"), CommandError);

  process.env.RISKGUARD_TOKEN_ADDRESS = "0x123";
  assert.throws(() => resolveAddress("RISKGUARD_TOKEN_ADDRESS"), CommandError);

  process.env.RISKGUARD_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000001";
  assert.equal(resolveAddress("RISKGUARD_TOKEN_ADDRESS"), "0x0000000000000000000000000000000000000001");

  process.env = { ...savedEnv };
});

it("resolveVaultAddress falls back to the environment", () => {
  process.env.RISKGUARD_VAULT_ADDRESS = "0x0000000000000000000000000000000000000002";
  assert.equal(resolveVaultAddress(undefined), "0x0000000000000000000000000000000000000002");
  assert.equal(resolveVaultAddress("0x0000000000000000000000000000000000000003"), "0x0000000000000000000000000000000000000003");
  process.env = { ...savedEnv };
});