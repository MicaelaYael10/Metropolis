// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

/// Boveda hermetica de un solo activo. Deposita un ERC20 y acredita participaciones.
/// Es el "venue" de la demo: el plugin ejecuta `deposit` solo si la politica lo permite.
/// Tipo ERC4626 simplificado, sin estrategia ni rendimiento externo.
contract MockVault {
    MockERC20 public immutable asset;
    string public name;

    uint256 public totalAssets;
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 assets, uint256 shares);

    error ZeroAmount();
    error NotEnoughShares();

    constructor(MockERC20 asset_, string memory name_) {
        asset = asset_;
        name = name_;
    }

    /// @notice Deposita `assets` del activo y devuelve las participaciones acunadas.
    function deposit(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();

        shares = totalShares == 0 ? assets : (assets * totalShares) / totalAssets;
        if (shares == 0) revert ZeroAmount();

        totalAssets += assets;
        totalShares += shares;
        sharesOf[msg.sender] += shares;

        asset.transferFrom(msg.sender, address(this), assets);

        emit Deposit(msg.sender, assets, shares);
    }

    /// @notice Quema `shares` y devuelve el activo correspondiente.
    function withdraw(uint256 shares) external returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (sharesOf[msg.sender] < shares) revert NotEnoughShares();

        assets = (shares * totalAssets) / totalShares;

        sharesOf[msg.sender] -= shares;
        totalShares -= shares;
        totalAssets -= assets;

        asset.transfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
    }
}
