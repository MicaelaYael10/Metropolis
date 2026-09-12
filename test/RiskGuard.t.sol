// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentLog} from "../contracts/AgentLog.sol";
import {ProtocolRegistry} from "../contracts/ProtocolRegistry.sol";
import {RiskGuard} from "../contracts/RiskGuard.sol";

/// @notice Pruebas del control previo a la operacion (pre-trade risk control).
/// Lo importante que se demuestra:
///   - el agente NO puede operar fuera de la politica del usuario;
///   - el puntaje lo lee el contrato del registry: el agente no puede mentir;
///   - los intentos bloqueados quedan registrados on-chain.
contract RiskGuardTest is Test {
    // La variable NO puede llamarse `log`: forge-std declara `event log(string)`.
    AgentLog internal agentLog;
    ProtocolRegistry internal registry;
    RiskGuard internal guard;

    address internal user = address(0xA11CE);
    address internal agent = address(0xA9E47);
    address internal other = address(0xB0B);

    address internal safeProtocol = address(0x1001);
    address internal riskyProtocol = address(0x1002);
    address internal unpricedProtocol = address(0x1003);

    // Codigos de motivo (deben coincidir con RiskGuard)
    uint8 internal constant NO_POLICY = 1;
    uint8 internal constant NOT_REGISTERED = 2;
    uint8 internal constant NOT_ACTIVE = 3;
    uint8 internal constant SCORE_TOO_HIGH = 4;
    uint8 internal constant PROTOCOL_CAP = 5;
    uint8 internal constant TOO_MANY_PROTOCOLS = 6;
    uint8 internal constant AMOUNT_TOO_HIGH = 7;
    uint8 internal constant ZERO_AMOUNT = 8;

    function setUp() public {
        agentLog = new AgentLog();
        registry = new ProtocolRegistry();
        guard = new RiskGuard(registry, agentLog);
        agentLog.setWriter(address(guard));
        registry.setUpdater(address(this), true);

        registry.registerProtocol(safeProtocol, "Lending seguro", ProtocolRegistry.Category.Lending);
        registry.registerProtocol(riskyProtocol, "Lending riesgoso", ProtocolRegistry.Category.Lending);
        registry.registerProtocol(unpricedProtocol, "Sin puntuar", ProtocolRegistry.Category.Lending);

        registry.setActive(safeProtocol, true);
        registry.setActive(riskyProtocol, true);
        registry.setRiskScore(safeProtocol, 20, 90, bytes32(0));
        registry.setRiskScore(riskyProtocol, 78, 90, bytes32(0));

        // politica: riesgo max 55 - 2 protocolos - 1000 por protocolo - 400 por operacion
        vm.prank(user);
        guard.setPolicy(55, 2, 1000, 400);
    }

    // --------------------------------------------------------------- politica

    function test_SinPolitica_TodoSeBloquea() public view {
        (bool allowed, uint8 code,) = guard.checkOperation(other, safeProtocol, 300);
        assertFalse(allowed);
        assertEq(code, NO_POLICY);
    }

    function test_PoliticaInvalida_Reverte() public {
        vm.prank(user);
        vm.expectRevert(RiskGuard.InvalidPolicy.selector);
        guard.setPolicy(101, 2, 1000, 400);
    }

    // -------------------------------------------------------------- validacion

    function test_PermiteProtocoloDentroDeLaPolitica() public view {
        (bool allowed, uint8 code, uint8 riskScore) = guard.checkOperation(user, safeProtocol, 300);
        assertTrue(allowed);
        assertEq(code, 0);
        assertEq(riskScore, 20);
    }

    function test_BloqueaPorRiesgoAlto() public view {
        (bool allowed, uint8 code, uint8 riskScore) = guard.checkOperation(user, riskyProtocol, 300);
        assertFalse(allowed);
        assertEq(code, SCORE_TOO_HIGH);
        assertEq(riskScore, 78);
    }

    function test_BloqueaProtocoloNoPuntuado() public view {
        (bool allowed, uint8 code,) = guard.checkOperation(user, unpricedProtocol, 300);
        assertFalse(allowed);
        assertEq(code, NOT_ACTIVE);
    }

    function test_BloqueaProtocoloNoRegistrado() public view {
        (bool allowed, uint8 code,) = guard.checkOperation(user, address(0xDEAD), 300);
        assertFalse(allowed);
        assertEq(code, NOT_REGISTERED);
    }

    function test_BloqueaMontoCero() public view {
        (bool allowed, uint8 code,) = guard.checkOperation(user, safeProtocol, 0);
        assertFalse(allowed);
        assertEq(code, ZERO_AMOUNT);
    }

    function test_BloqueaPorTopeDeOperacion() public view {
        (bool allowed, uint8 code,) = guard.checkOperation(user, safeProtocol, 401);
        assertFalse(allowed);
        assertEq(code, AMOUNT_TOO_HIGH);
    }

    function test_BloqueaPorTopePorProtocolo() public {
        vm.startPrank(user);
        guard.commitOperation(user, safeProtocol, 400, bytes32(0));
        guard.commitOperation(user, safeProtocol, 400, bytes32(0));
        vm.stopPrank();

        (bool allowed, uint8 code,) = guard.checkOperation(user, safeProtocol, 400);
        assertFalse(allowed);
        assertEq(code, PROTOCOL_CAP);
    }

    function test_BloqueaPorMaximoDeProtocolos() public {
        address third = address(0x3003);
        address fourth = address(0x4004);
        registry.registerProtocol(third, "Tercero", ProtocolRegistry.Category.Other);
        registry.setActive(third, true);
        registry.setRiskScore(third, 10, 90, bytes32(0));
        registry.registerProtocol(fourth, "Cuarto", ProtocolRegistry.Category.Other);
        registry.setActive(fourth, true);
        registry.setRiskScore(fourth, 10, 90, bytes32(0));

        vm.startPrank(user);
        guard.commitOperation(user, safeProtocol, 100, bytes32(0));
        guard.commitOperation(user, third, 100, bytes32(0));
        vm.stopPrank();

        (bool allowed, uint8 code,) = guard.checkOperation(user, fourth, 100);
        assertFalse(allowed);
        assertEq(code, TOO_MANY_PROTOCOLS);
    }

    // ------------------------------------------------------------- ejecucion

    function test_ElAgenteNoPuedeMentirSobreElRiesgo() public {
        vm.prank(user);
        guard.setAgent(agent);

        // Con riesgo 20 la operacion pasa...
        vm.prank(agent);
        guard.commitOperation(user, safeProtocol, 100, bytes32(0));

        // ...pero si el registry sube el riesgo, el MISMO agente queda bloqueado.
        registry.setRiskScore(safeProtocol, 80, 90, bytes32(0));

        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(RiskGuard.OperationBlocked.selector, SCORE_TOO_HIGH, uint8(80))
        );
        guard.commitOperation(user, safeProtocol, 100, bytes32(0));
    }

    function test_Commit_ReverteConElMotivoExacto() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(RiskGuard.OperationBlocked.selector, SCORE_TOO_HIGH, uint8(78))
        );
        guard.commitOperation(user, riskyProtocol, 300, bytes32(0));
    }

    function test_Commit_ActualizaExposicionYEscribeEnElLog() public {
        vm.prank(user);
        guard.commitOperation(user, safeProtocol, 250, keccak256("motivo"));

        assertEq(guard.exposure(user), 250);
        assertEq(guard.protocolExposureOf(user, safeProtocol), 250);
        assertEq(guard.committedCount(user), 1);
        assertEq(guard.totalCommitted(), 250);
        assertEq(agentLog.count(), 1);

        AgentLog.Entry memory e = agentLog.entry(0);
        assertEq(e.user, user);
        assertEq(e.allowed, true);
        assertEq(e.riskScore, 20);
        assertEq(e.rationaleHash, keccak256("motivo"));
    }

    function test_RecordRejection_GuardaLaPerdidaEvitada() public {
        vm.prank(user);
        guard.setAgent(agent);

        vm.prank(agent);
        guard.recordRejection(user, riskyProtocol, 300, keccak256("bloqueado"));

        assertEq(guard.totalRejections(), 1);
        assertEq(guard.exposure(user), 0, "no debe mover exposicion");
        assertEq(agentLog.count(), 1);

        AgentLog.Entry memory e = agentLog.entry(0);
        assertEq(e.allowed, false);
        assertEq(e.reasonCode, SCORE_TOO_HIGH);
        assertEq(e.riskScore, 78);
    }

    function test_Revert_RegistrarRechazoDeOperacionQueSiPasa() public {
        vm.prank(user);
        vm.expectRevert(RiskGuard.OperationNotBlocked.selector);
        guard.recordRejection(user, safeProtocol, 100, bytes32(0));
    }

    function test_SoloElUsuarioOSuAgentePuedenOperar() public {
        vm.prank(other);
        vm.expectRevert(RiskGuard.NotAuthorized.selector);
        guard.commitOperation(user, safeProtocol, 100, bytes32(0));
    }

    function test_RevocarAgenteCortaElAcceso() public {
        vm.startPrank(user);
        guard.setAgent(agent);
        guard.revokeAgent();
        vm.stopPrank();

        vm.prank(agent);
        vm.expectRevert(RiskGuard.NotAuthorized.selector);
        guard.commitOperation(user, safeProtocol, 100, bytes32(0));
    }

    function test_ProtocolsUsedBy_ReflejaElUso() public {
        vm.startPrank(user);
        guard.commitOperation(user, safeProtocol, 100, bytes32(0));
        guard.commitOperation(user, safeProtocol, 50, bytes32(0));
        vm.stopPrank();

        address[] memory used = guard.protocolsUsedBy(user);
        assertEq(used.length, 1, "no debe duplicar el protocolo");
        assertEq(used[0], safeProtocol);
    }
}
