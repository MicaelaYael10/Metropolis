// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../contracts/MockERC20.sol";
import {MockVault} from "../contracts/MockVault.sol";

contract MockVaultTest is Test {
    MockERC20 internal token;
    MockVault internal vault;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        token = new MockERC20("Monad Mock USD", "mUSD");
        vault = new MockVault(token, "RiskGuard Vault");
        token.mint(alice, 1_000e18);
        token.mint(bob, 1_000e18);
    }

    function test_Deposit_AcreditaParticipacionesYUnoElActivo() public {
        vm.startPrank(alice);
        token.approve(address(vault), 100e18);
        uint256 shares = vault.deposit(100e18);
        vm.stopPrank();

        assertEq(shares, 100e18, "participaciones 1:1 al inicio");
        assertEq(vault.sharesOf(alice), 100e18);
        assertEq(vault.totalAssets(), 100e18);
        assertEq(token.balanceOf(alice), 900e18);
        assertEq(token.balanceOf(address(vault)), 100e18);
    }

    function test_Withdraw_DevuelveElActivo() public {
        vm.startPrank(alice);
        token.approve(address(vault), 100e18);
        vault.deposit(100e18);
        uint256 assets = vault.withdraw(100e18);
        vm.stopPrank();

        assertEq(assets, 100e18);
        assertEq(token.balanceOf(alice), 1_000e18, "recupera todo");
        assertEq(vault.totalAssets(), 0);
        assertEq(vault.sharesOf(alice), 0);
    }

    function test_Deposit_RepartoProporcionalEntreDosDepositantes() public {
        vm.startPrank(alice);
        token.approve(address(vault), 100e18);
        vault.deposit(100e18);
        vm.stopPrank();

        vm.startPrank(bob);
        token.approve(address(vault), 50e18);
        uint256 sharesBob = vault.deposit(50e18);
        vm.stopPrank();

        assertEq(sharesBob, 50e18, "mismo precio: 1 participacion por activo");
        assertEq(vault.totalAssets(), 150e18);
        assertEq(vault.totalShares(), 150e18);
    }

    function test_Revert_DepositSinAllowance() public {
        vm.prank(alice);
        vm.expectRevert(MockERC20.InsufficientAllowance.selector);
        vault.deposit(100e18);
    }

    function test_Revert_DepositCero() public {
        vm.prank(alice);
        vm.expectRevert(MockVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_Revert_WithdrawSinParticipaciones() public {
        vm.prank(alice);
        vm.expectRevert(MockVault.NotEnoughShares.selector);
        vault.withdraw(1e18);
    }
}
