// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {ISettingsProvider} from "./interfaces/ISettingsProvider.sol";
import {IPool} from "./interfaces/IPool.sol";

import {Roles} from "./lib/Roles.sol";
import {Errors} from "./lib/Errors.sol";
import {ListMap} from "./lib/ListMap.sol";
import {Version} from "./lib/Version.sol";
import {SETTINGS_PROVIDER_VERSION} from "./lib/ContractVersions.sol";

/*
 * @title SettingsProvider
 * @author RociFi Labs
 * @notice Contract used for loan configuration
 */
contract SettingsProvider is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ISettingsProvider,
    Version
{
    using ListMap for ListMap._uint256;
    using ListMap for ListMap._uint16;
    using ListMap for ListMap._IERC20MetadataUpgradeable;
    using ListMap for ListMap._IPool;

    // treasury address which will receive share of profit from payed interest
    address public treasuryAddress;
    // treasury share, n * 10**18
    uint256 public treasuryPercent;
    // All pools currently used in protocol
    ListMap._IPool internal pools;
    // Late fee for specific pool, n * 10**18
    mapping(IPool => uint256) public poolToLateFee;
    // Grace period for specific pool
    mapping(IPool => uint256) public poolToGracePeriod;
    // Collateral accepted in specific pool, seconds
    mapping(IPool => ListMap._IERC20MetadataUpgradeable) internal poolCollaterals;
    // Scores allowed to borrow from specific pool
    mapping(IPool => ListMap._uint16) internal poolScores;
    // Collection of possible loan LTVs (n * 10**18) according to pool and score
    mapping(IPool => mapping(uint16 => ListMap._uint256)) internal poolToScoreLtvs;
    // Collection of possible loan durations (in seconds) according to pool and score
    mapping(IPool => mapping(uint16 => ListMap._uint256)) internal poolToScoreDurations;
    // APR interest (n * 10**18) for specific combination of pool -> score -> ltv -> duration
    mapping(IPool => mapping(uint16 => mapping(uint256 => mapping(uint256 => uint256))))
        internal poolToScoreToLtvToDurationToInterest;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(Roles.UPDATER)
    {}

    function initialize(address admin) public initializer {
        require(admin != address(0), Errors.ZERO_ADDRESS);

        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);

        _grantRole(Roles.ADMIN, admin);
    }

    /**
     * @dev Method to set treasuryAddress
     * @param _treasuryAddress new address for treasury
     */
    function setTreasuryAddress(address _treasuryAddress) external onlyRole(Roles.ADMIN) {
        require(_treasuryAddress != address(0), Errors.ZERO_ADDRESS);
        emit TreasuryAddressChanged(msg.sender, treasuryAddress, _treasuryAddress, block.timestamp);
        treasuryAddress = _treasuryAddress;
    }

    /**
     * @dev Method to set treasuryPercent
     * @param percent new share for treasury
     */
    function setTreasuryPercent(uint256 percent) external onlyRole(Roles.ADMIN) {
        emit TreasuryPercentChanged(msg.sender, treasuryPercent, percent, block.timestamp);
        treasuryPercent = percent;
    }

    /**
     * @dev Getter to retrieve address and share of treasury
     */
    function getTreasuryInfo() external view returns (address, uint256) {
        return (treasuryAddress, treasuryPercent);
    }

    /**
     * @dev Method to set poolToLateFee
     * @param pool pool address
     * @param value late fee amount
     */
    function setPoolToLateFee(IPool pool, uint256 value) external onlyRole(Roles.ADMIN) {
        emit PoolToLateFeeChanged(msg.sender, pool, poolToLateFee[pool], value, block.timestamp);
        poolToLateFee[pool] = value;
    }

    /**
     * @dev Method to set poolToGracePeriod
     * @param pool pool address
     * @param value grace period amount
     */
    function setPoolToGracePeriod(IPool pool, uint256 value) external onlyRole(Roles.ADMIN) {
        emit PoolToGracePeriodChanged(
            msg.sender,
            pool,
            poolToGracePeriod[pool],
            value,
            block.timestamp
        );
        poolToGracePeriod[pool] = value;
    }

    /**
     * @dev Method to get all pools in protocol
     */
    function getPools() external view returns (IPool[] memory) {
        return pools.list;
    }

    /**
     * @dev Method to add pools to protocol
     * @param _pools list of pool addresses
     */
    function addPools(IPool[] memory _pools) external onlyRole(Roles.ADMIN) {
        pools.addList(_pools);
        emit PoolsAdded(msg.sender, _pools, block.timestamp);
    }

    /**
     * @dev Method to remove pools from protocol
     * @param _pools list of pool addresses
     */
    function removePools(IPool[] memory _pools) external onlyRole(Roles.ADMIN) {
        pools.removeList(_pools);
        emit PoolsRemoved(msg.sender, _pools, block.timestamp);
    }

    /**
     * @dev Method to get all collaterals allowed in pool
     * @param pool pool address
     */
    function getPoolCollaterals(IPool pool)
        external
        view
        returns (IERC20MetadataUpgradeable[] memory)
    {
        return poolCollaterals[pool].list;
    }

    /**
     * @dev Method to add pools to pool
     * @param pool pool address
     * @param _collaterals list of collateral addresses
     */
    function addPoolCollaterals(IPool pool, IERC20MetadataUpgradeable[] memory _collaterals)
        external
        onlyRole(Roles.ADMIN)
    {
        require(pools.includes[pool], Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
        poolCollaterals[pool].addList(_collaterals);
        emit PoolCollateralsAdded(msg.sender, pool, _collaterals, block.timestamp);
    }

    /**
     * @dev Method to remove pools from pool
     * @param pool pool address
     * @param _collaterals list of collateral addresses
     */
    function removePoolCollaterals(IPool pool, IERC20MetadataUpgradeable[] memory _collaterals)
        external
        onlyRole(Roles.ADMIN)
    {
        require(pools.includes[pool], Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
        poolCollaterals[pool].removeList(_collaterals);
        emit PoolCollateralsRemoved(msg.sender, pool, _collaterals, block.timestamp);
    }

    /**
     * @dev Method to get all scores allowed in pool
     * @param pool pool address
     */
    function getPoolScores(IPool pool) external view returns (uint16[] memory) {
        return poolScores[pool].list;
    }

    /**
     * @dev Method to add scores to pool
     * @param pool pool address
     * @param scores list of scores
     */
    function addPoolScores(IPool pool, uint16[] memory scores) external onlyRole(Roles.ADMIN) {
        require(pools.includes[pool], Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
        poolScores[pool].addList(scores);
        emit PoolScoresAdded(msg.sender, pool, scores, block.timestamp);
    }

    /**
     * @dev Method to remove scores from pool
     * @param pool pool address
     * @param scores list of scores
     */
    function removePoolScores(IPool pool, uint16[] memory scores) external onlyRole(Roles.ADMIN) {
        require(pools.includes[pool], Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
        poolScores[pool].removeList(scores);
        emit PoolScoresRemoved(msg.sender, pool, scores, block.timestamp);
    }

    /**
     * @dev Method to get all ltvs for pool and score
     * @param pool pool address
     * @param score score value
     */
    function getPoolToScoreLtvs(IPool pool, uint16 score) external view returns (uint256[] memory) {
        return poolToScoreLtvs[pool][score].list;
    }

    /**
     * @dev Method to add LTVs to pool-score pair
     * @param pool pool address
     * @param score score value
     * @param ltvs list of LTVs
     */
    function addPoolToScoreLtvs(
        IPool pool,
        uint16 score,
        uint256[] memory ltvs
    ) external onlyRole(Roles.ADMIN) {
        require(poolScores[pool].includes[score], Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
        poolToScoreLtvs[pool][score].addList(ltvs);
        emit PoolToScoreLtvsAdded(msg.sender, pool, score, ltvs, block.timestamp);
    }

    /**
     * @dev Method to remove LTVs from pool-score pair
     * @param pool pool address
     * @param score score value
     * @param ltvs list of LTVs
     */
    function removePoolToScoreLtvs(
        IPool pool,
        uint16 score,
        uint256[] memory ltvs
    ) external onlyRole(Roles.ADMIN) {
        require(poolScores[pool].includes[score], Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
        poolToScoreLtvs[pool][score].removeList(ltvs);
        emit PoolToScoreLtvsRemoved(msg.sender, pool, score, ltvs, block.timestamp);
    }

    /**
     * @dev Method to get all loan durations for pool and score
     * @param pool pool address
     * @param score score value
     */
    function getPoolToScoreDurations(IPool pool, uint16 score)
        external
        view
        returns (uint256[] memory)
    {
        return poolToScoreDurations[pool][score].list;
    }

    /**
     * @dev Method to add loan durations to pool-score pair
     * @param pool pool address
     * @param score score value
     * @param durations list of durations
     */
    function addPoolToScoreDurations(
        IPool pool,
        uint16 score,
        uint256[] memory durations
    ) external onlyRole(Roles.ADMIN) {
        require(poolScores[pool].includes[score], Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
        poolToScoreDurations[pool][score].addList(durations);
        emit PoolToScoreDurationsAdded(msg.sender, pool, score, durations, block.timestamp);
    }

    /**
     * @dev Method to remove loan durations from pool-score pair
     * @param pool pool address
     * @param score score value
     * @param durations list of durations
     */
    function removePoolToScoreDurations(
        IPool pool,
        uint16 score,
        uint256[] memory durations
    ) external onlyRole(Roles.ADMIN) {
        require(poolScores[pool].includes[score], Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
        poolToScoreDurations[pool][score].removeList(durations);
        emit PoolToScoreDurationsRemoved(msg.sender, pool, score, durations, block.timestamp);
    }

    /**
     * @dev Method to set APR interest for pool -> score -> ltv -> duration combination
     * @param pool pool address
     * @param score score value
     * @param ltv ltv value
     * @param duration duration value
     * @param interest APR
     */
    function setPoolToScoreToLtvToDurationInterest(
        IPool pool,
        uint16 score,
        uint256 ltv,
        uint256 duration,
        uint256 interest
    ) external onlyRole(Roles.ADMIN) {
        require(pools.includes[pool], Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
        require(poolScores[pool].includes[score], Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
        require(poolToScoreLtvs[pool][score].includes[ltv], Errors.SETTINGS_PROVIDER_LTV_NOT_SET);
        require(
            poolToScoreDurations[pool][score].includes[duration],
            Errors.SETTINGS_PROVIDER_DURATION_NOT_SET
        );
        emit PoolToScoreToLtvToDurationToInterestChanged(
            msg.sender,
            pool,
            score,
            ltv,
            duration,
            poolToScoreToLtvToDurationToInterest[pool][score][ltv][duration],
            interest,
            block.timestamp
        );
        poolToScoreToLtvToDurationToInterest[pool][score][ltv][duration] = interest;
    }

    /**
     * @dev Method to get APR interest for pool -> score -> ltv -> duration combination
     * @param pool pool address
     * @param score score value
     * @param ltv ltv value
     * @param duration duration value
     */
    function getLoanInterest(
        IPool pool,
        uint16 score,
        uint256 ltv,
        uint256 duration
    ) public view returns (uint256) {
        require(pools.includes[pool], Errors.SETTINGS_PROVIDER_POOL_NOT_SET);
        require(poolScores[pool].includes[score], Errors.SETTINGS_PROVIDER_SCORE_NOT_SET);
        require(poolToScoreLtvs[pool][score].includes[ltv], Errors.SETTINGS_PROVIDER_LTV_NOT_SET);
        require(
            poolToScoreDurations[pool][score].includes[duration],
            Errors.SETTINGS_PROVIDER_DURATION_NOT_SET
        );
        return poolToScoreToLtvToDurationToInterest[pool][score][ltv][duration];
    }

    /**
     * @dev Method to get loan settings on borrow in LoanManager
     * @param pool pool address
     * @param score borrower score
     * @param ltv loan ltv
     * @param duration loan duration
     * @param collateral collateral address for borrow
     */
    function getLoanSettings(
        IPool pool,
        uint16 score,
        uint256 ltv,
        uint256 duration,
        IERC20MetadataUpgradeable collateral
    ) external view returns (LoanSettings memory loanSettings) {
        require(
            poolCollaterals[pool].includes[collateral],
            Errors.SETTINGS_PROVIDER_COLLATERAL_NOT_SET
        );

        uint256 loanInterest = getLoanInterest(pool, score, ltv, duration);
        require(loanInterest > 0, Errors.SETTINGS_PROVIDER_INTEREST_NOT_SET);

        loanSettings.interest = loanInterest;
        loanSettings.gracePeriod = poolToGracePeriod[pool];
        loanSettings.lateFee = poolToLateFee[pool];
    }

    /**
     * @dev get current contract version
     */
    function currentVersion() public pure override returns (string memory) {
        return SETTINGS_PROVIDER_VERSION;
    }
}
