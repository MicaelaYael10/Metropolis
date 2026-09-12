// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Catalogo de protocolos DeFi con su puntaje de riesgo.
/// El puntaje vive on-chain y no lo aporta el agente en cada llamada.
contract ProtocolRegistry {
    enum Category {
        Staking,
        Lending,
        Liquidity,
        Other
    }

    struct Protocol {
        string name;
        Category category;
        uint8 riskScore; // 0..100 - mayor = mas riesgoso
        uint8 confidence; // 0..100 - confianza del puntaje
        uint64 updatedAt;
        bytes32 evidenceHash; // hash de la evidencia (senales) usada
        bool active;
        bool registered;
    }

    address public owner;
    mapping(address => bool) public isUpdater;

    mapping(address => Protocol) private _protocols;
    address[] private _list;

    event ProtocolRegistered(address indexed target, string name, Category category);
    event RiskScoreSet(address indexed target, uint8 score, uint8 confidence, bytes32 evidenceHash);
    event ProtocolActiveSet(address indexed target, bool active);
    event UpdaterSet(address indexed updater, bool allowed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error NotUpdater();
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidValue();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyUpdater() {
        if (msg.sender != owner && !isUpdater[msg.sender]) revert NotUpdater();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setUpdater(address updater, bool allowed) external onlyOwner {
        isUpdater[updater] = allowed;
        emit UpdaterSet(updater, allowed);
    }

    /// @notice Registra un protocolo. Arranca inactivo y con riesgo maximo hasta que se puntue.
    function registerProtocol(
        address target,
        string calldata name,
        Category category
    ) external onlyOwner {
        if (target == address(0)) revert InvalidValue();
        if (_protocols[target].registered) revert AlreadyRegistered();

        _protocols[target] = Protocol({
            name: name,
            category: category,
            riskScore: 100,
            confidence: 0,
            updatedAt: uint64(block.timestamp),
            evidenceHash: bytes32(0),
            active: false,
            registered: true
        });
        _list.push(target);

        emit ProtocolRegistered(target, name, category);
    }

    function setRiskScore(
        address target,
        uint8 score,
        uint8 confidence,
        bytes32 evidenceHash
    ) external onlyUpdater {
        if (!_protocols[target].registered) revert NotRegistered();
        if (score > 100 || confidence > 100) revert InvalidValue();

        Protocol storage p = _protocols[target];
        p.riskScore = score;
        p.confidence = confidence;
        p.updatedAt = uint64(block.timestamp);
        p.evidenceHash = evidenceHash;

        emit RiskScoreSet(target, score, confidence, evidenceHash);
    }

    function setActive(address target, bool active) external onlyOwner {
        if (!_protocols[target].registered) revert NotRegistered();
        _protocols[target].active = active;
        emit ProtocolActiveSet(target, active);
    }

    // ----------------------------------------------------------------- vistas

    function getProtocol(address target) external view returns (Protocol memory) {
        return _protocols[target];
    }

    function isRegistered(address target) external view returns (bool) {
        return _protocols[target].registered;
    }

    function list() external view returns (address[] memory) {
        return _list;
    }

    function size() external view returns (uint256) {
        return _list.length;
    }

    /// @notice Banda de riesgo: 0 = verde (<30), 1 = ambar (30..60), 2 = rojo (>60).
    function band(uint8 score) public pure returns (uint8) {
        if (score < 30) return 0;
        if (score <= 60) return 1;
        return 2;
    }
}
