// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Registro append-only de decisiones. Guarda tambien las bloqueadas:
/// saber que se evito una perdida vale tanto como saber que se ejecuto.
contract AgentLog {
    struct Entry {
        address user;
        address protocol;
        uint256 amount;
        uint8 riskScore;
        uint8 reasonCode;
        bool allowed;
        bytes32 rationaleHash;
        uint64 timestamp;
    }

    address public owner;
    address public writer;

    Entry[] private _entries;
    mapping(address => uint256[]) private _byUser;

    event WriterSet(address indexed writer);
    event Recorded(
        uint256 indexed index,
        address indexed user,
        address indexed protocol,
        bool allowed,
        uint8 reasonCode,
        uint8 riskScore,
        bytes32 rationaleHash
    );

    error NotOwner();
    error NotWriter();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyWriter() {
        if (msg.sender != writer && msg.sender != owner) revert NotWriter();
        _;
    }

    constructor() {
        owner = msg.sender;
        writer = msg.sender;
    }

    function setWriter(address newWriter) external onlyOwner {
        writer = newWriter;
        emit WriterSet(newWriter);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @notice Registra una decision. Solo el escritor autorizado (RiskGuard) o el owner.
    function record(
        address user,
        address protocol,
        uint256 amount,
        uint8 riskScore,
        uint8 reasonCode,
        bool allowed,
        bytes32 rationaleHash
    ) external onlyWriter returns (uint256 index) {
        index = _entries.length;
        _entries.push(
            Entry({
                user: user,
                protocol: protocol,
                amount: amount,
                riskScore: riskScore,
                reasonCode: reasonCode,
                allowed: allowed,
                rationaleHash: rationaleHash,
                timestamp: uint64(block.timestamp)
            })
        );
        _byUser[user].push(index);

        emit Recorded(index, user, protocol, allowed, reasonCode, riskScore, rationaleHash);
    }

    function count() external view returns (uint256) {
        return _entries.length;
    }

    function entry(uint256 index) external view returns (Entry memory) {
        return _entries[index];
    }

    function entriesOf(address user) external view returns (uint256[] memory) {
        return _byUser[user];
    }

    function lastEntryOf(address user) external view returns (Entry memory) {
        uint256[] storage ids = _byUser[user];
        if (ids.length == 0) {
            return Entry(address(0), address(0), 0, 0, 0, false, bytes32(0), 0);
        }
        return _entries[ids[ids.length - 1]];
    }
}
