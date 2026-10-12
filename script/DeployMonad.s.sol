// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentLog} from "../contracts/AgentLog.sol";
import {ProtocolRegistry} from "../contracts/ProtocolRegistry.sol";
import {RiskGuard} from "../contracts/RiskGuard.sol";
import {MockERC20} from "../contracts/MockERC20.sol";
import {MockVault} from "../contracts/MockVault.sol";

/// Despliega el stack completo en Monad Testnet (chain 10143) y lo deja listo para la demo.
/// Requiere PRIVATE_KEY. AGENT_ADDRESS es opcional: si se define, recibe mUSD para operar.
contract DeployMonad is Script {
    function run()
        external
        returns (
            address agentLogAddr,
            address registryAddr,
            address guardAddr,
            address tokenAddr,
            address safeVaultAddr,
            address riskyVaultAddr
        )
    {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address agent = vm.envOr("AGENT_ADDRESS", address(0));

        vm.startBroadcast(pk);

        AgentLog agentLog = new AgentLog();
        ProtocolRegistry registry = new ProtocolRegistry();
        RiskGuard guard = new RiskGuard(registry, agentLog);
        MockERC20 musd = new MockERC20("Monad Mock USD", "mUSD");
        MockVault safeVault = new MockVault(musd, "RiskGuard Safe Vault");
        MockVault riskyVault = new MockVault(musd, "RiskGuard Risky Vault");

        agentLog.setWriter(address(guard));
        registry.setUpdater(msg.sender, true);

        // Dos venues con riesgo contrastante para el flujo permitir/bloquear.
        registry.registerProtocol(
            address(safeVault), "Safe Vault", ProtocolRegistry.Category.Lending
        );
        registry.setRiskScore(address(safeVault), 18, 92, keccak256("demo:safe"));
        registry.setActive(address(safeVault), true);

        registry.registerProtocol(
            address(riskyVault), "Risky Vault", ProtocolRegistry.Category.Other
        );
        registry.setRiskScore(address(riskyVault), 82, 80, keccak256("demo:risky"));
        registry.setActive(address(riskyVault), true);

        if (agent != address(0)) {
            musd.mint(agent, 1_000e18);
        }

        vm.stopBroadcast();

        agentLogAddr = address(agentLog);
        registryAddr = address(registry);
        guardAddr = address(guard);
        tokenAddr = address(musd);
        safeVaultAddr = address(safeVault);
        riskyVaultAddr = address(riskyVault);

        console2.log("");
        console2.log("=== RiskGuard en Monad Testnet ===");
        console2.log("AgentLog:         ", agentLogAddr);
        console2.log("ProtocolRegistry: ", registryAddr);
        console2.log("RiskGuard:        ", guardAddr);
        console2.log("mUSD:             ", tokenAddr);
        console2.log("SafeVault:        ", safeVaultAddr);
        console2.log("RiskyVault:       ", riskyVaultAddr);
        console2.log("");
        console2.log("Exportar antes de usar el plugin (mm-plugin-riskguard):");
        console2.log("export RISKGUARD_GUARD_ADDRESS=", guardAddr);
        console2.log("export RISKGUARD_REGISTRY_ADDRESS=", registryAddr);
        console2.log("export RISKGUARD_AGENTLOG_ADDRESS=", agentLogAddr);
        console2.log("export RISKGUARD_TOKEN_ADDRESS=", tokenAddr);
        console2.log("# Vault por defecto (opcional, para omitir el primer argumento):");
        console2.log("export RISKGUARD_VAULT_ADDRESS=", safeVaultAddr);
        console2.log("# Riesgo del demo: SafeVault=18 (verde) | RiskyVault=82 (rojo)");
        console2.log("");
    }
}
