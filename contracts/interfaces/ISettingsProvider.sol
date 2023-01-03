// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import {IPool} from "./IPool.sol";

import {IPool} from "./IPool.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface ISettingsProvider {
    struct LoanSettings {
        uint256 interest;
        uint256 gracePeriod;
        uint256 lateFee;
    }

    event TreasuryAddressChanged(address user, address old, address updated, uint256 timestamp);
    event TreasuryPercentChanged(address user, uint256 old, uint256 updated, uint256 timestamp);
    event PoolToLateFeeChanged(
        address user,
        IPool indexed pool,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );
    event PoolToGracePeriodChanged(
        address user,
        IPool indexed pool,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );
    event PoolsAdded(address user, IPool[] pools, uint256 timestamp);
    event PoolsRemoved(address user, IPool[] pools, uint256 timestamp);
    event PoolCollateralsAdded(
        address user,
        IPool indexed pool,
        IERC20MetadataUpgradeable[] collaterals,
        uint256 timestamp
    );
    event PoolCollateralsRemoved(
        address user,
        IPool indexed pool,
        IERC20MetadataUpgradeable[] collaterals,
        uint256 timestamp
    );
    event PoolScoresAdded(address user, IPool indexed pool, uint16[] scores, uint256 timestamp);
    event PoolScoresRemoved(address user, IPool indexed pool, uint16[] scores, uint256 timestamp);
    event PoolToScoreLtvsAdded(
        address user,
        IPool indexed pool,
        uint16 indexed score,
        uint256[] ltvs,
        uint256 timestamp
    );
    event PoolToScoreLtvsRemoved(
        address user,
        IPool indexed pool,
        uint16 indexed score,
        uint256[] ltvs,
        uint256 timestamp
    );
    event PoolToScoreDurationsAdded(
        address user,
        IPool indexed pool,
        uint16 indexed score,
        uint256[] durations,
        uint256 timestamp
    );
    event PoolToScoreDurationsRemoved(
        address user,
        IPool indexed pool,
        uint16 indexed score,
        uint256[] durations,
        uint256 timestamp
    );
    event PoolToScoreToLtvToDurationToInterestChanged(
        address user,
        IPool indexed pool,
        uint16 indexed score,
        uint256 indexed ltv,
        uint256 duration,
        uint256 old,
        uint256 updated,
        uint256 timestamp
    );

    function getLoanSettings(
        IPool pool,
        uint16 score,
        uint256 ltv,
        uint256 duration,
        IERC20MetadataUpgradeable collateral
    ) external view returns (LoanSettings memory);

    function getTreasuryInfo() external view returns (address, uint256);
}
