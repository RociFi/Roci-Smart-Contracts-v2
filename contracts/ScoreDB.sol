// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {INFCS} from "./interfaces/INFCS.sol";
import {IScoreDB} from "./interfaces/IScoreDB.sol";

import {Roles} from "./lib/Roles.sol";
import {Errors} from "./lib/Errors.sol";
import {Version} from "./lib/Version.sol";
import {SCORE_DB_VERSION} from "./lib/ContractVersions.sol";

/*
 * @title ScoreDB
 * @author RociFi Labs
 * @notice Contract for managing scores of users
 */
contract ScoreDB is
    Initializable,
    PausableUpgradeable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    IScoreDB,
    Version
{
    using ECDSA for bytes32;

    // Stores the address of the private key which signs the scores
    // Previously known as ROCI_ADDRESS
    address public nfcsSignerAddress;
    // how long score is valid (in seconds)
    uint256 public scoreValidityPeriod;
    // mapping holding Scores for each nfcsId
    mapping(uint256 => Score) public nfcsIdToScore;
    // minimal score
    uint256 public minScore;
    // maximal score
    uint256 public maxScore;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        require(admin != address(0), Errors.ZERO_ADDRESS);

        __Pausable_init();

        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.PAUSER, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);

        _grantRole(Roles.ADMIN, admin);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        whenPaused
        onlyRole(Roles.UPDATER)
    {}

    /**
     * @dev Modifier to verify that score was not tampered
     * @param nfcsId NFCS id of user
     * @param score score to update
     * @param timestamp when signature was generated
     * @param sig signature verifying the correctness of score
     */
    modifier verify(
        uint256 nfcsId,
        uint16 score,
        uint256 timestamp,
        bytes memory sig
    ) {
        require(score >= minScore && score <= maxScore, Errors.SCORE_DB_UNKNOWN_FETCHING_SCORE);
        require(
            timestamp + scoreValidityPeriod > block.timestamp,
            Errors.SCORE_DB_OUTDATED_SIGNATURE
        );
        // Recreate msg hash from inputs
        bytes32 hash = keccak256(abi.encodePacked(nfcsId, score, timestamp));
        require(
            hash.toEthSignedMessageHash().recover(sig) == nfcsSignerAddress,
            Errors.SCORE_DB_VERIFICATION
        );
        _;
    }

    /**
     * @dev Method to set minScore
     * @param value new minScore value
     */
    function setMinScore(uint256 value) external onlyRole(Roles.ADMIN) {
        emit MinScoreChanged(msg.sender, minScore, value, block.timestamp);
        minScore = value;
    }

    /**
     * @dev Method to set maxScore
     * @param value new maxScore value
     */
    function setMaxScore(uint256 value) external onlyRole(Roles.ADMIN) {
        emit MaxScoreChanged(msg.sender, maxScore, value, block.timestamp);
        maxScore = value;
    }

    /**
     * @dev Method for updating score for specific NFCS id
     * @param nfcsId NFCS id of user
     * @param score new score
     * @param timestamp when signature was generated
     * @param sig signature verifying the correctness of score
     * @param version contract version
     */
    function updateScore(
        uint256 nfcsId,
        uint16 score,
        uint256 timestamp,
        bytes memory sig,
        string memory version
    ) external whenNotPaused checkVersion(version) verify(nfcsId, score, timestamp, sig) {
        nfcsIdToScore[nfcsId] = Score(timestamp, nfcsId, score);
        emit ScoreUpdated(block.timestamp, nfcsId, score);
    }

    /**
     * @dev Method to get Score for specific NFCS id
     * @param nfcsId nfcsId value
     * @return score Score struct
     */
    function getScore(uint256 nfcsId) external view returns (Score memory) {
        return nfcsIdToScore[nfcsId];
    }

    /**
     * @dev Method to get Score for specific NFCS id and validate that it is fresh
     * @notice Called by LoanManager
     * @param nfcsId nfcsId value
     * @return creditScore actual score value
     */
    function getCreditScoreAndValidate(uint256 nfcsId) external view returns (uint16) {
        Score memory s = nfcsIdToScore[nfcsId];
        require(
            block.timestamp >= s.timestamp && block.timestamp - s.timestamp <= scoreValidityPeriod,
            Errors.SETTINGS_PROVIDER_SCORE_OUTDATED
        );
        return s.creditScore;
    }

    /**
     * @dev Method to set nfcsSignerAddress
     * @param _nfcsSignerAddress signer address
     */
    function setNFCSSignerAddress(address _nfcsSignerAddress) external onlyRole(Roles.ADMIN) {
        require(_nfcsSignerAddress != address(0), Errors.ZERO_ADDRESS);
        nfcsSignerAddress = _nfcsSignerAddress;
        emit NFCSSignerAddressChanged(block.timestamp, _nfcsSignerAddress);
    }

    /**
     * @dev Method to set scoreValidityPeriod
     * @param value new validity period
     */
    function setScoreValidityPeriod(uint256 value) external onlyRole(Roles.ADMIN) {
        emit ScoreValidityPeriodChanged(msg.sender, scoreValidityPeriod, value, block.timestamp);
        scoreValidityPeriod = value;
    }

    /**
     * @dev pause contract
     */
    function pause() external onlyRole(Roles.PAUSER) {
        _pause();
    }

    /**
     * @dev unpause contract
     */
    function unpause() external onlyRole(Roles.PAUSER) {
        _unpause();
    }

    /**
     * @dev get current contract version
     */
    function currentVersion() public pure override returns (string memory) {
        return SCORE_DB_VERSION;
    }
}
