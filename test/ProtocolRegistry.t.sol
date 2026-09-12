// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProtocolRegistry} from "../contracts/ProtocolRegistry.sol";

contract ProtocolRegistryTest is Test {
    ProtocolRegistry internal registry;

    address internal owner = address(this);
    address internal other = address(0xBEEF);
    address internal safeTarget = address(0x1001);
    address internal riskyTarget = address(0x1002);

    function setUp() public {
        registry = new ProtocolRegistry();
    }

    function test_Registro_IniciaInactivoConRiesgoMaximo() public {
        registry.registerProtocol(safeTarget, "Lending seguro", ProtocolRegistry.Category.Lending);

        ProtocolRegistry.Protocol memory p = registry.getProtocol(safeTarget);
        assertTrue(p.registered, "debe estar registrado");
        assertFalse(p.active, "no debe estar activo hasta puntuarse");
        assertEq(p.riskScore, 100, "arranca con riesgo maximo");
        assertEq(registry.size(), 1);
    }

    function test_Bandas_CoincidenConElMotorOffChain() public view {
        assertEq(registry.band(0), 0);
        assertEq(registry.band(29), 0); // verde
        assertEq(registry.band(30), 1); // ambar
        assertEq(registry.band(60), 1); // ambar
        assertEq(registry.band(61), 2); // rojo
        assertEq(registry.band(100), 2);
    }

    function test_SetRiskScore_ActualizaPuntajeYConfianza() public {
        registry.registerProtocol(safeTarget, "Lending seguro", ProtocolRegistry.Category.Lending);

        vm.expectEmit(true, false, false, true, address(registry));
        emit ProtocolRegistry.RiskScoreSet(safeTarget, 20, 90, keccak256("evidencia-1"));

        registry.setRiskScore(safeTarget, 20, 90, keccak256("evidencia-1"));

        ProtocolRegistry.Protocol memory p = registry.getProtocol(safeTarget);
        assertEq(p.riskScore, 20);
        assertEq(p.confidence, 90);
        assertEq(p.evidenceHash, keccak256("evidencia-1"));
    }

    function test_Revert_CuandoNoEsUpdater() public {
        registry.registerProtocol(safeTarget, "T", ProtocolRegistry.Category.Other);

        vm.prank(other);
        vm.expectRevert(ProtocolRegistry.NotUpdater.selector);
        registry.setRiskScore(safeTarget, 10, 90, bytes32(0));
    }

    function test_UpdaterAutorizadoPuedePuntuar() public {
        registry.registerProtocol(safeTarget, "T", ProtocolRegistry.Category.Other);
        registry.setUpdater(other, true);

        vm.prank(other);
        registry.setRiskScore(safeTarget, 33, 80, bytes32(0));

        assertEq(registry.getProtocol(safeTarget).riskScore, 33);
    }

    function test_Revert_RegistroDuplicado() public {
        registry.registerProtocol(safeTarget, "T", ProtocolRegistry.Category.Other);

        vm.expectRevert(ProtocolRegistry.AlreadyRegistered.selector);
        registry.registerProtocol(safeTarget, "T otra vez", ProtocolRegistry.Category.Other);
    }

    function test_Revert_PuntajeInvalido() public {
        registry.registerProtocol(safeTarget, "T", ProtocolRegistry.Category.Other);

        vm.expectRevert(ProtocolRegistry.InvalidValue.selector);
        registry.setRiskScore(safeTarget, 101, 90, bytes32(0));

        vm.expectRevert(ProtocolRegistry.InvalidValue.selector);
        registry.setRiskScore(safeTarget, 10, 101, bytes32(0));
    }

    function test_Revert_PuntuarNoRegistrado() public {
        vm.expectRevert(ProtocolRegistry.NotRegistered.selector);
        registry.setRiskScore(safeTarget, 10, 90, bytes32(0));
    }

    function test_SetActive_SoloOwner() public {
        registry.registerProtocol(safeTarget, "T", ProtocolRegistry.Category.Other);

        vm.prank(other);
        vm.expectRevert(ProtocolRegistry.NotOwner.selector);
        registry.setActive(safeTarget, true);

        registry.setActive(safeTarget, true);
        assertTrue(registry.getProtocol(safeTarget).active);
    }
}
