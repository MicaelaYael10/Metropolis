// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProtocolRegistry} from "./ProtocolRegistry.sol";
import {AgentLog} from "./AgentLog.sol";

/// Control de riesgo previo a la operacion. El agente propone, el contrato dispone:
/// el puntaje se lee del registro (el agente no puede mentir) y toda decision queda en el log.
contract RiskGuard {
    struct Policy {
        uint8 maxRiskScore; // puntaje maximo admitido (0..100)
        uint8 maxProtocols; // cuantos protocolos distintos puede usar
        uint256 maxPerProtocol; // tope de exposicion por protocolo (unidades del activo)
        uint256 maxAmountPerOp; // tope por operacion
        bool active;
    }

    ProtocolRegistry public immutable registry;
    AgentLog public immutable decisionLog;

    mapping(address => Policy) private _policies;
    mapping(address => address) public agentOf;

    mapping(address => uint256) public exposure;
    mapping(address => uint256) public committedCount;

    mapping(address => mapping(address => uint256)) private _protocolExposure;
    mapping(address => mapping(address => bool)) private _usedProtocol;
    mapping(address => address[]) private _protocolsUsed;

    uint256 public totalCommitted;
    uint256 public totalRejections;

    // Codigos de motivo - el agente los usa para explicar y el log los guarda.
    uint8 public constant CODE_OK = 0;
    uint8 public constant CODE_NO_POLICY = 1;
    uint8 public constant CODE_NOT_REGISTERED = 2;
    uint8 public constant CODE_NOT_ACTIVE = 3;
    uint8 public constant CODE_SCORE_TOO_HIGH = 4;
    uint8 public constant CODE_PROTOCOL_CAP = 5;
    uint8 public constant CODE_TOO_MANY_PROTOCOLS = 6;
    uint8 public constant CODE_AMOUNT_TOO_HIGH = 7;
    uint8 public constant CODE_ZERO_AMOUNT = 8;

    event PolicySet(address indexed user, uint8 maxRiskScore, uint8 maxProtocols, uint256 maxPerProtocol, uint256 maxAmountPerOp);
    event AgentSet(address indexed user, address indexed agent);
    event OperationCommitted(address indexed user, address indexed protocol, uint256 amount, uint8 riskScore, uint256 logIndex);
    event RejectionLogged(address indexed user, address indexed protocol, uint256 amount, uint8 reasonCode, uint8 riskScore, uint256 logIndex);

    error NotAuthorized();
    error InvalidPolicy();
    error OperationBlocked(uint8 reasonCode, uint8 riskScore);
    error OperationNotBlocked();

    constructor(ProtocolRegistry registry_, AgentLog log_) {
        registry = registry_;
        decisionLog = log_;
    }

    // ------------------------------------------------------------------ admin

    /// @notice El usuario define su politica de riesgo.
    function setPolicy(
        uint8 maxRiskScore,
        uint8 maxProtocols,
        uint256 maxPerProtocol,
        uint256 maxAmountPerOp
    ) external {
        if (maxRiskScore > 100) revert InvalidPolicy();
        if (maxProtocols == 0 || maxProtocols > 50) revert InvalidPolicy();
        if (maxPerProtocol == 0 || maxAmountPerOp == 0) revert InvalidPolicy();

        _policies[msg.sender] = Policy({
            maxRiskScore: maxRiskScore,
            maxProtocols: maxProtocols,
            maxPerProtocol: maxPerProtocol,
            maxAmountPerOp: maxAmountPerOp,
            active: true
        });

        emit PolicySet(msg.sender, maxRiskScore, maxProtocols, maxPerProtocol, maxAmountPerOp);
    }

    /// @notice Autoriza a un agente a operar en nombre del usuario (sin custodia de fondos).
    function setAgent(address agent) external {
        if (_policies[msg.sender].active == false) revert InvalidPolicy();
        agentOf[msg.sender] = agent;
        emit AgentSet(msg.sender, agent);
    }

    function revokeAgent() external {
        agentOf[msg.sender] = address(0);
        emit AgentSet(msg.sender, address(0));
    }

    // ------------------------------------------------------------- validacion

    /// @notice Control previo a la operacion. Vista pura: no modifica estado.
    function checkOperation(
        address user,
        address protocol,
        uint256 amount
    ) public view returns (bool allowed, uint8 reasonCode, uint8 riskScore) {
        ProtocolRegistry.Protocol memory p = registry.getProtocol(protocol);

        Policy memory policy = _policies[user];
        if (!policy.active) return (false, CODE_NO_POLICY, p.riskScore);
        if (amount == 0) return (false, CODE_ZERO_AMOUNT, p.riskScore);
        if (!p.registered) return (false, CODE_NOT_REGISTERED, 100);
        if (!p.active) return (false, CODE_NOT_ACTIVE, p.riskScore);
        if (p.riskScore > policy.maxRiskScore) return (false, CODE_SCORE_TOO_HIGH, p.riskScore);
        if (amount > policy.maxAmountPerOp) return (false, CODE_AMOUNT_TOO_HIGH, p.riskScore);
        if (_protocolExposure[user][protocol] + amount > policy.maxPerProtocol) {
            return (false, CODE_PROTOCOL_CAP, p.riskScore);
        }
        if (!_usedProtocol[user][protocol] && _protocolsUsed[user].length >= policy.maxProtocols) {
            return (false, CODE_TOO_MANY_PROTOCOLS, p.riskScore);
        }
        return (true, CODE_OK, p.riskScore);
    }

    // -------------------------------------------------------------- ejecucion

    /// @notice Ejecuta la asignacion SOLO si pasa el control previo. Si no, revierte.
    function commitOperation(
        address user,
        address protocol,
        uint256 amount,
        bytes32 rationaleHash
    ) external returns (uint256 logIndex) {
        if (msg.sender != user && msg.sender != agentOf[user]) revert NotAuthorized();

        (bool allowed, uint8 reasonCode, uint8 riskScore) = checkOperation(user, protocol, amount);
        if (!allowed) revert OperationBlocked(reasonCode, riskScore);

        if (!_usedProtocol[user][protocol]) {
            _usedProtocol[user][protocol] = true;
            _protocolsUsed[user].push(protocol);
        }
        _protocolExposure[user][protocol] += amount;
        exposure[user] += amount;
        committedCount[user] += 1;
        totalCommitted += amount;

        logIndex = decisionLog.record(user, protocol, amount, riskScore, reasonCode, true, rationaleHash);

        emit OperationCommitted(user, protocol, amount, riskScore, logIndex);
    }

    /// @notice Registra on-chain un intento BLOQUEADO. No revierte: sirve de evidencia.
    function recordRejection(
        address user,
        address protocol,
        uint256 amount,
        bytes32 rationaleHash
    ) external returns (uint256 logIndex) {
        if (msg.sender != user && msg.sender != agentOf[user]) revert NotAuthorized();

        (bool allowed, uint8 reasonCode, uint8 riskScore) = checkOperation(user, protocol, amount);
        if (allowed) revert OperationNotBlocked();

        totalRejections += 1;
        logIndex = decisionLog.record(user, protocol, amount, riskScore, reasonCode, false, rationaleHash);

        emit RejectionLogged(user, protocol, amount, reasonCode, riskScore, logIndex);
    }

    // ------------------------------------------------------------------ vistas

    function policyOf(address user) external view returns (Policy memory) {
        return _policies[user];
    }

    function protocolsUsedBy(address user) external view returns (address[] memory) {
        return _protocolsUsed[user];
    }

    function protocolExposureOf(address user, address protocol) external view returns (uint256) {
        return _protocolExposure[user][protocol];
    }
}
