// SPDX-License-Identifier: None
pragma solidity ^0.8.9;

import {IPool} from "../interfaces/IPool.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

/*
 * @title Loan Library for RociFi Cydonia
 * @author RociFi Labs
 * @notice Manages loan structs, statuses.
 */

library LoanLib {
    event LoanStatusChanged(uint256 indexed loanId, LoanLib.Status from, LoanLib.Status to);

    // PERSIST -> Nothing to change
    // NEW -> Newly created, initial stage of any loan.
    // PAID_EARLY_PART -> Partially repaid before maturity date.
    // PAID_EARLY_FULL -> Final stage. Loan paid in full before or on maturity date time.
    // PAID_LATE_PART -> Partially repaid before grace period ends.
    // PAID_LATE_FULL -> Final stage. Loan paid in full after maturity date and before grace period ends.
    // DEFAULT_PART -> Loan is liquidated and collateral didn’t cover the amount due. Loan still has an outstanding balance.
    // DEFAULT_FULL_LIQUIDATED -> Final stage. Loan is liquidated and collateral covers the amount due on the loan. Loan will not accept further repayments.
    // DEFAULT_FULL_PAID -> Final stage. DEFAULT_PART loan which is paid in full. Loan will not accept further repayments.
    /**
     * @dev Status enum represents possible states of loan
     */
    enum Status {
        PERSIST,
        NEW,
        PAID_EARLY_PART,
        PAID_EARLY_FULL,
        PAID_LATE_PART,
        PAID_LATE_FULL,
        DEFAULT_PART,
        DEFAULT_FULL_LIQUIDATED,
        DEFAULT_FULL_PAID
    }

    // BEFORE_MATURITY -> Before maturity date
    // BEFORE_LIQUIDATION -> After maturity date but before liquidation
    // AFTER_LIQUIDATION -> After liquidation
    /**
     * @dev Period enum represents loan life cycles
     */
    enum Period {
        BEFORE_MATURITY,
        BEFORE_LIQUIDATION,
        AFTER_LIQUIDATION
    }

    // PARTIAL_REPAY -> Partial repayment
    // FULL_REPAY -> Full repayment
    // LIQUIDATION_COVERED -> Liquidation with outstanding = 0
    // LIQUIDATION_UNCOVERED -> Liquidation with outstanding > 0
    /**
     * @dev Action enum represents actions that can happen on loan
     */
    enum Action {
        REPAY_PARTIAL,
        REPAY_FULL,
        LIQUIDATION_COVERED,
        LIQUIDATION_NOT_COVERED
    }

    /**
     * @dev Loan instance structure
     * @param borrower of the loan
     * @param amount is loan principal
     * @param apr annual percentage rate to a moment of loan creation
     * @param ltv loan to value factor
     * @param lateFee fee that is applied to loan interest after maturity date will be passed
     * @param issueDate is a timestamp of loan creation
     * @param dueDate is a timestamp of maturity date of the loan
     * @param liquidationDate is a timestamp after that loan will be marked as ready for liquidation
     * @param lastRepay is a timestamp of last loan repayment or liquidation
     * @param frozenCollateralAmount amount of collateral frozen to cover loan
     * @param frozenCollateralToken collateral token address
     * @param pool pool address where loan has been taken
     * @param status current status of loan
     */
    struct Loan {
        address borrower;
        uint256 amount;
        uint256 apr;
        uint256 ltv;
        uint256 lateFee;
        uint256 issueDate;
        uint256 dueDate;
        uint256 liquidationDate;
        uint256 lastRepay;
        uint256 frozenCollateralAmount;
        IERC20MetadataUpgradeable frozenCollateralToken;
        IPool pool;
        Status status;
    }

    /**
     * @dev Loan liquidation info
     * @param toLiquidate amount of collateral that needs to be liquidated
     * @param notCovered amount of loan that will stay uncovered
     * @param poolValueAdjust amount by which pool value needs to be adjusted
     */
    struct DelinquencyInfo {
        uint256 toLiquidate;
        uint256 notCovered;
        int256 poolValueAdjust;
    }

    /**
     * @dev Status matrix is a 3 dimensional transition stable
     * @notice Current status is depends of last status, current period and action applied to loan
     */
    struct StatusMatrix {
        mapping(Status => mapping(Period => mapping(Action => Status))) _m;
    }

    /**
     * @dev Updates loan status
     * @param loan struct instance
     * @param loanId id of the loan
     * @param actionType action applied to loan
     * @param table transitions table
     * @notice loan period calculated from current block.timestamp and loan params
     */
    function updateStatus(
        Loan storage loan,
        uint256 loanId,
        Action actionType,
        StatusMatrix storage table
    ) internal {
        Period period = block.timestamp > loan.liquidationDate
            ? Period.AFTER_LIQUIDATION
            : block.timestamp > loan.dueDate
            ? Period.BEFORE_LIQUIDATION
            : Period.BEFORE_MATURITY;

        Status newStatus = table._m[loan.status][period][actionType];

        if (newStatus != Status.PERSIST) {
            emit LoanStatusChanged(loanId, loan.status, newStatus);
            loan.status = newStatus;
        }
    }
}
