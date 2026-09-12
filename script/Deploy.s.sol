// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentLog} from "../contracts/AgentLog.sol";
import {ProtocolRegistry} from "../contracts/ProtocolRegistry.sol";
import {RiskGuard} from "../contracts/RiskGuard.sol";

/// Despliega RiskGuard en Avalanche. Requiere PRIVATE_KEY en el entorno.
contract Deploy is Script {
    function run() external returns (address agentLogAddr, address registryAddr, address guardAddr) {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);

        AgentLog agentLog = new AgentLog();
        ProtocolRegistry registry = new ProtocolRegistry();
        RiskGuard guard = new RiskGuard(registry, agentLog);

        // RiskGuard es el unico escritor del log.
        agentLog.setWriter(address(guard));
        // El desplegador puede actualizar puntajes de riesgo.
        registry.setUpdater(msg.sender, true);

        vm.stopBroadcast();

        agentLogAddr = address(agentLog);
        registryAddr = address(registry);
        guardAddr = address(guard);

        console2.log("");
        console2.log("=== RiskGuard desplegado ===");
        console2.log("AgentLog:         ", agentLogAddr);
        console2.log("ProtocolRegistry: ", registryAddr);
        console2.log("RiskGuard:        ", guardAddr);
        console2.log("");
        console2.log("Guardar en .env:");
        console2.log("LOG_ADDRESS=", agentLogAddr);
        console2.log("REGISTRY_ADDRESS=", registryAddr);
        console2.log("RISKGUARD_ADDRESS=", guardAddr);
        console2.log("");
    }
}
