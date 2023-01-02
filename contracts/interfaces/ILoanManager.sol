// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;
import {LoanLib} from "../lib/LoanLib.sol";
import {IPool} from "./IPool.sol";
import {ICollateralManager} from "./ICollateralManager.sol";
import {INFCS} from "./INFCS.sol";
import {IPriceFeed} from "./IPriceFeed.sol";
import {ISettingsProvider} from "./ISettingsProvider.sol";
import {IScoreDB} from "./IScoreDB.sol";
import {ILimitManager} from "./ILimitManager.sol";

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

interface ILoanManager {
    event LoanCreated(
        address indexed borrower,
        address indexed pool,
        uint256 indexed loanId,
        uint256 amount
    );

    event LoanPayed(
        address indexed payer,
        address indexed borrower,
        address indexed pool,
        uint256 loanId,
        uint256 interestAccrued,
        uint256 repayAmount,
        uint256 outstanding
    );

    event LoanClosed(address indexed borrower, address indexed pool, uint256 indexed loanId);

    event LoanLiquidated(
        address indexed borrower,
        IPool indexed pool,
        uint256 indexed loanId,
        uint256 timestamp,
        uint256 remainingLoanAmount, // loan amount which was not covered by collateral => remains to be paid
        uint256 liquidatedCollateral, // amount of liquidated collateral
        uint256 unfrozenCollateral, // amount of collateral user received back
        int256 poolValueAdjustment // poolValue adjustment
    );

    event CollateralManagerChanged(
        address user,
        ICollateralManager old,
        ICollateralManager updated
    );
    event NFCSChanged(address user, INFCS old, INFCS updated);
    event PriceFeedChanged(address user, IPriceFeed old, IPriceFeed updated);
    event SettingsProviderChanged(address user, ISettingsProvider old, ISettingsProvider updated);
    event ScoreDBChanged(address user, IScoreDB old, IScoreDB updated);
    event LimitManagerChanged(address user, ILimitManager old, ILimitManager updated);
    event StatusChanged(
        address user,
        LoanLib.Status indexed from,
        LoanLib.Period indexed period,
        LoanLib.Action indexed action,
        LoanLib.Status old,
        LoanLib.Status updated
    );
    event SentToTreasury(address user, address treasuryAddress, uint256 treasuryAmount);

    struct BorrowVars {
        uint16 score;
        uint256 loanId;
        IERC20MetadataUpgradeable underlyingToken;
    }

    function loans(uint256) external view returns (LoanLib.Loan memory);

    function liquidate(uint256 loanId, string memory version)
        external
        returns (
            IERC20MetadataUpgradeable collateralToken,
            IERC20MetadataUpgradeable underlyingToken,
            uint256 collateralAmount,
            IPool pool
        );

    function getDelinquencyInfo(uint256 loanId)
        external
        view
        returns (LoanLib.DelinquencyInfo memory info);

    function currentVersion() external view returns (string memory);
}
