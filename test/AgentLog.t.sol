// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentLog} from "../contracts/AgentLog.sol";

contract AgentLogTest is Test {
    // La variable NO puede llamarse `log`: forge-std declara `event log(string)` y chocaria.
    AgentLog internal agentLog;

    address internal user = address(0xA11CE);
    address internal other = address(0xB0B);
    address internal protocol = address(0x1001);

    function setUp() public {
        agentLog = new AgentLog();
    }

    function test_RegistraUnaDecision() public {
        agentLog.record(user, protocol, 250, 20, 0, true, keccak256("motivo"));

        assertEq(agentLog.count(), 1);
        AgentLog.Entry memory e = agentLog.entry(0);
        assertEq(e.user, user);
        assertEq(e.protocol, protocol);
        assertEq(e.amount, 250);
        assertEq(e.riskScore, 20);
        assertEq(e.allowed, true);
        assertEq(e.rationaleHash, keccak256("motivo"));
    }

    function test_GuardaHistorialPorUsuario() public {
        agentLog.record(user, protocol, 100, 20, 0, true, bytes32(0));
        agentLog.record(user, protocol, 100, 80, 4, false, bytes32(0));

        uint256[] memory ids = agentLog.entriesOf(user);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);

        AgentLog.Entry memory last = agentLog.lastEntryOf(user);
        assertEq(last.allowed, false);
        assertEq(last.reasonCode, 4);
    }

    function test_Revert_CuandoNoEsElEscritor() public {
        vm.prank(other);
        vm.expectRevert(AgentLog.NotWriter.selector);
        agentLog.record(user, protocol, 1, 10, 0, true, bytes32(0));
    }

    function test_ElOwnerPuedeCambiarElEscritor() public {
        address newWriter = address(0xC0FFEE);
        agentLog.setWriter(newWriter);

        vm.prank(newWriter);
        agentLog.record(user, protocol, 1, 10, 0, true, bytes32(0));
        assertEq(agentLog.count(), 1);

        vm.prank(other);
        vm.expectRevert(AgentLog.NotWriter.selector);
        agentLog.record(user, protocol, 1, 10, 0, true, bytes32(0));
    }

    function test_UltimaEntradaVaciaParaUsuarioSinHistorial() public view {
        AgentLog.Entry memory e = agentLog.lastEntryOf(user);
        assertEq(e.user, address(0));
        assertEq(e.amount, 0);
    }

    function test_ElOwnerSiemprePuedeEscribir() public {
        agentLog.record(user, protocol, 1, 10, 0, true, bytes32(0));
        assertEq(agentLog.count(), 1);
    }
}
