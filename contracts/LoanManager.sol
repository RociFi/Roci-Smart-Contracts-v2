// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {CountersUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import {IPool, IPriceFeed, ISettingsProvider, ICollateralManager, INFCS, IScoreDB, ILimitManager, ILoanManager} from "./interfaces/ILoanManager.sol";
import {IVersion} from "./interfaces/IVersion.sol";

import {Errors} from "./lib/Errors.sol";
import {Roles} from "./lib/Roles.sol";
import {LoanLib} from "./lib/LoanLib.sol";
import {Version} from "./lib/Version.sol";
import {SelectivePausable} from "./lib/SelectivePausable.sol";
import {LOAN_MANAGER_VERSION} from "./lib/ContractVersions.sol";
import {ONE_YEAR} from "./lib/Constants.sol";

contract LoanManager is
    Initializable,
    SelectivePausable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    ILoanManager,
    ReentrancyGuardUpgradeable,
    Version
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using CountersUpgradeable for CountersUpgradeable.Counter;
    using LoanLib for LoanLib.Loan;

    ICollateralManager public collateralManager;
    INFCS public nfcs;
    IPriceFeed public priceFeed;
    ISettingsProvider public settingsProvider;
    IScoreDB public scoreDB;
    ILimitManager public limitManager;

    // Loan id counter
    CountersUpgradeable.Counter public nextLoanId;

    // loanId => loan
    mapping(uint256 => LoanLib.Loan) internal _loans;

    mapping(address => uint256[]) public userLoanIds;

    //Statuses table
    LoanLib.StatusMatrix internal table;

    function _authorizeUpgrade(
        address newImplementation
    ) internal override whenPaused onlyRole(Roles.UPDATER) {}

    function initialize(address _admin) public initializer {
        require(_admin != address(0), Errors.ZERO_ADDRESS);

        __Pausable_init();

        // start with 1
        nextLoanId.increment();

        _setRoleAdmin(Roles.PAUSER, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);
        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.LIQUIDATOR, Roles.ADMIN);

        _grantRole(Roles.ADMIN, _admin);

        _addPausableFunc("borrow", this.borrow.selector);
        _addPausableFunc("repay", this.repay.selector);
    }

    /**
     * @dev Returns full loan struct by loanId
     * @param loanId id of the loan
     * @return loan structure
     */
    function loans(uint256 loanId) external view returns (LoanLib.Loan memory) {
        return _loans[loanId];
    }

    function setCollateralManager(
        ICollateralManager _collateralManager
    ) external onlyRole(Roles.ADMIN) {
        emit CollateralManagerChanged(msg.sender, collateralManager, _collateralManager);
        collateralManager = _collateralManager;
    }

    function setNFCS(INFCS _nfcs) external onlyRole(Roles.ADMIN) {
        emit NFCSChanged(msg.sender, nfcs, _nfcs);
        nfcs = _nfcs;
    }

    function setPriceFeed(IPriceFeed _priceFeed) external onlyRole(Roles.ADMIN) {
        emit PriceFeedChanged(msg.sender, priceFeed, _priceFeed);
        priceFeed = _priceFeed;
    }

    function setSettingsProvider(
        ISettingsProvider _settingsProvider
    ) external onlyRole(Roles.ADMIN) {
        emit SettingsProviderChanged(msg.sender, settingsProvider, _settingsProvider);
        settingsProvider = _settingsProvider;
    }

    function setScoreDB(IScoreDB _scoreDB) external onlyRole(Roles.ADMIN) {
        emit ScoreDBChanged(msg.sender, scoreDB, _scoreDB);
        scoreDB = _scoreDB;
    }

    function setLimitManager(ILimitManager _limitManager) external onlyRole(Roles.ADMIN) {
        emit LimitManagerChanged(msg.sender, limitManager, _limitManager);
        limitManager = _limitManager;
    }

    function setStatus(
        LoanLib.Status from,
        LoanLib.Period period,
        LoanLib.Action action,
        LoanLib.Status to
    ) external onlyRole(Roles.ADMIN) {
        emit StatusChanged(msg.sender, from, period, action, table._m[from][period][action], to);
        table._m[from][period][action] = to;
    }

    function getStatus(
        LoanLib.Status from,
        LoanLib.Period period,
        LoanLib.Action action
    ) external view returns (LoanLib.Status) {
        return table._m[from][period][action];
    }

    /**
     * @dev Get all loan ids for user
     * @param user address of user account
     * @return array of user loan ids
     */
    function getUserLoanIds(address user) external view returns (uint256[] memory) {
        return userLoanIds[user];
    }

    /**
     * @dev Calculates interest for params
     * @param apr annual percentage rate
     * @param timeFrame time between last and next interest accruing in seconds
     * @param amount principal of loan
     * @return interest interest to accrue on next interest accruing
     */
    function calculateInterest(
        uint256 apr,
        uint256 timeFrame,
        uint256 amount
    ) internal pure returns (uint256) {
        return (amount * apr * timeFrame) / (100 ether * ONE_YEAR);
    }

    /**
     * @dev Calculates interest for loan
     * @notice Interest will be calculated from last loan repayment/liquidation time or from loan creation
     * @param loanId id of the loan
     * @param toTimestamp timestamp of the next interest accruing
     * @return interest interest to accrue on next interest accruing to loan
     */
    function getInterest(uint256 loanId, uint256 toTimestamp) public view returns (uint256) {
        LoanLib.Loan memory loan = _loans[loanId];

        uint256 interestDry = calculateInterest(
            loan.apr,
            toTimestamp - loan.lastRepay,
            loan.amount
        );

        if (toTimestamp <= loan.dueDate) {
            return interestDry;
        }

        if (loan.lastRepay <= loan.dueDate) {
            uint256 interest = calculateInterest(
                loan.apr,
                loan.dueDate - loan.lastRepay,
                loan.amount
            );

            uint256 lateInterest = calculateInterest(
                loan.apr,
                toTimestamp - loan.dueDate,
                loan.amount
            );

            return interest + (lateInterest * loan.lateFee) / 1 ether;
        }
        return (interestDry * loan.lateFee) / 1 ether;
    }

    /**
     * @dev Creates new loan of amount for msg.sender from pool with collateral and loan params
     * @notice method are payable means native token can be used as collateral
     * @notice this method will transfer value of collateral token required to cover loan from user
     * @notice and amount of loan to user
     * @param amount of pool underlying token to borrow
     * @param pool from which to borrow funds
     * @param collateral token that will be frozen to cover loan value
     * @param ltv loan to value factor
     * @param duration loan duration in seconds
     * @param version LoanManager version for external interactions
     */
    function borrow(
        uint256 amount,
        IPool pool,
        IERC20MetadataUpgradeable collateral,
        uint256 ltv,
        uint256 duration,
        string memory version
    ) public payable ifNotPaused nonReentrant checkVersion(version) {
        BorrowVars memory vars = BorrowVars(
            scoreDB.getCreditScoreAndValidate(nfcs.getToken(msg.sender)),
            nextLoanId.current(),
            pool.underlyingToken()
        );

        nextLoanId.increment();

        limitManager.onBorrow(msg.sender, pool, vars.score, amount);

        ISettingsProvider.LoanSettings memory s = settingsProvider.getLoanSettings(
            pool,
            vars.score,
            ltv,
            duration,
            collateral
        );

        uint256 collateralToFreeze = priceFeed.convert(
            (amount * 100 ether) / ltv,
            vars.underlyingToken,
            collateral
        );

        _loans[vars.loanId] = LoanLib.Loan(
            msg.sender,
            amount,
            s.interest,
            ltv,
            s.lateFee,
            block.timestamp,
            block.timestamp + duration,
            block.timestamp + duration + s.gracePeriod,
            block.timestamp,
            collateralToFreeze,
            collateral,
            pool,
            LoanLib.Status.NEW
        );

        emit LoanCreated(msg.sender, address(pool), vars.loanId, s.interest, amount);

        userLoanIds[msg.sender].push(vars.loanId);

        uint256 userCollateralBalance = collateralManager.collateralToUserToAmount(
            collateral,
            msg.sender
        );

        uint256 collateralToAdd = userCollateralBalance >= collateralToFreeze
            ? 0
            : collateralToFreeze - userCollateralBalance;

        if (collateralToAdd > 0) {
            if (msg.value > 0) {
                collateralManager.addCollateral{value: collateralToAdd}(msg.sender, collateral, 0);
                if (msg.value > collateralToAdd) {
                    require(
                        payable(msg.sender).send(msg.value - collateralToAdd),
                        Errors.LOAN_MANAGER_NATIVE_RETURN
                    );
                }
            } else {
                collateralManager.addCollateral(msg.sender, collateral, collateralToAdd);
            }
        }

        collateralManager.freeze(msg.sender, collateral, collateralToFreeze);

        vars.underlyingToken.safeTransferFrom(address(pool), msg.sender, amount);
    }

    /**
     * @dev Repays existing loan with amount from msg.sender
     * @param loanId existing loan id
     * @param amount to repay, can be greater than loan principal + loan interest
     * @param version LoanManager version for external interactions
     */
    function repay(
        uint256 loanId,
        uint256 amount,
        string memory version
    ) external ifNotPaused nonReentrant checkVersion(version) {
        require(amount > 0, Errors.LOAN_MANAGER_ZERO_REPAY);

        LoanLib.Loan storage loan = _loans[loanId];

        require(loan.amount > 0, Errors.LOAN_MANAGER_LOAN_AMOUNT_ZERO);

        uint256 interestAccrued = getInterest(loanId, block.timestamp);

        //If user repays more that loan principal + loan interest accrued then it repays loan principal + loan interest accrued
        if (amount > loan.amount + interestAccrued) {
            amount = loan.amount + interestAccrued;
        }

        if (amount >= interestAccrued) {
            loan.amount -= amount - interestAccrued;
            limitManager.onRepayOrLiquidate(loan.borrower, loan.pool, amount - interestAccrued);
            loan.lastRepay = block.timestamp;
        } else {
            loan.lastRepay += (amount * 100 ether * ONE_YEAR) / (loan.amount * loan.apr);
            interestAccrued = amount;
        }

        loan.updateStatus(loanId, LoanLib.Action.REPAY_PARTIAL, table);

        emit LoanPayed(
            msg.sender,
            loan.borrower,
            address(loan.pool),
            loanId,
            interestAccrued,
            amount,
            loan.amount
        );

        //If loan are fully repaid
        if (loan.amount == 0) {
            if (loan.frozenCollateralAmount > 0) {
                collateralManager.unfreeze(
                    loan.borrower,
                    loan.frozenCollateralToken,
                    loan.frozenCollateralAmount
                );
            }

            limitManager.onLoanFulfillment(loan.borrower, loan.pool);

            loan.updateStatus(loanId, LoanLib.Action.REPAY_FULL, table);

            emit LoanClosed(loan.borrower, address(loan.pool), loanId);
        }

        IERC20MetadataUpgradeable underlyingToken = loan.pool.underlyingToken();

        uint256 treasuryShare = sendToTreasury(underlyingToken, msg.sender, interestAccrued);

        //Adjust pool value according to accrued interest
        loan.pool.updatePoolValue(int256(interestAccrued - treasuryShare));

        underlyingToken.safeTransferFrom(msg.sender, address(loan.pool), amount - treasuryShare);
    }

    function liquidate(
        uint256 loanId,
        string memory version
    )
        external
        whenNotPaused
        nonReentrant
        checkVersion(version)
        onlyRole(Roles.LIQUIDATOR)
        returns (IERC20MetadataUpgradeable, IERC20MetadataUpgradeable, uint256, IPool)
    {
        LoanLib.DelinquencyInfo memory info = getDelinquencyInfo(loanId);

        LoanLib.Loan storage loan = _loans[loanId];

        IERC20MetadataUpgradeable underlyingToken = loan.pool.underlyingToken();

        uint256 treasuryShare = info.poolValueAdjust > 0
            ? sendToTreasury(underlyingToken, msg.sender, uint256(info.poolValueAdjust))
            : 0;

        int256 poolValueAdjustment = info.poolValueAdjust - int256(treasuryShare);

        loan.pool.updatePoolValue(poolValueAdjustment);

        underlyingToken.safeTransferFrom(
            msg.sender,
            address(loan.pool),
            info.notCovered > 0
                ? loan.amount - info.notCovered
                : loan.amount + uint256(poolValueAdjustment)
        );

        limitManager.onRepayOrLiquidate(loan.borrower, loan.pool, loan.amount - info.notCovered);

        loan.amount = info.notCovered;

        collateralManager.seize(
            msg.sender,
            loan.frozenCollateralToken,
            loan.borrower,
            info.toLiquidate
        );

        uint256 unfrozenCollateral;
        //If loan frozen collateral exceeds amount of collateral to liquidate we can unfreeze remaining amount
        if (loan.frozenCollateralAmount > info.toLiquidate) {
            unfrozenCollateral = loan.frozenCollateralAmount - info.toLiquidate;
            collateralManager.unfreeze(
                loan.borrower,
                loan.frozenCollateralToken,
                unfrozenCollateral
            );
            limitManager.onLoanFulfillment(loan.borrower, loan.pool);
        }

        loan.frozenCollateralAmount = 0;

        LoanLib.Action statusAction = LoanLib.Action.LIQUIDATION_COVERED;

        if (loan.amount > 0) {
            statusAction = LoanLib.Action.LIQUIDATION_NOT_COVERED;
            loan.lastRepay = block.timestamp;
        }

        loan.updateStatus(loanId, statusAction, table);

        emit LoanLiquidated(
            loan.borrower,
            loan.pool,
            loanId,
            poolValueAdjustment > 0 ? uint256(poolValueAdjustment) : 0,
            block.timestamp,
            loan.amount,
            info.toLiquidate,
            unfrozenCollateral,
            poolValueAdjustment
        );

        return (loan.frozenCollateralToken, underlyingToken, info.toLiquidate, loan.pool);
    }

    /**
     * @dev Sends part of accrued interest to treasury
     * @param token underlying token of loan
     * @param user that repays loan
     * @return amount sended to treasury
     */
    function sendToTreasury(
        IERC20MetadataUpgradeable token,
        address user,
        uint256 interestAccrued
    ) internal returns (uint256) {
        (address treasuryAddress, uint256 treasuryPercent) = settingsProvider.getTreasuryInfo();

        if (treasuryAddress == address(0)) {
            return 0;
        }

        uint256 treasuryAmount = (interestAccrued * treasuryPercent) / 100 ether;

        token.safeTransferFrom(user, treasuryAddress, treasuryAmount);
        emit SentToTreasury(user, treasuryAddress, treasuryAmount);

        return treasuryAmount;
    }

    function getDelinquencyInfo(
        uint256 loanId
    ) public view returns (LoanLib.DelinquencyInfo memory) {
        LoanLib.Loan memory loan = _loans[loanId];

        require(isDelinquent(loanId), Errors.LOAN_MANAGER_LOAN_IS_LIQUID);

        IERC20MetadataUpgradeable loanToken = loan.pool.underlyingToken();

        //Calculate accrued interest for now
        uint256 interestAccrued = getInterest(loanId, block.timestamp);

        uint256 remainingAmountAsCollateral = priceFeed.convert(
            loan.amount,
            loanToken,
            loan.frozenCollateralToken
        );

        uint256 remainingInterestAsCollateral = priceFeed.convert(
            interestAccrued,
            loanToken,
            loan.frozenCollateralToken
        );

        uint256 remainingTotal = remainingAmountAsCollateral + remainingInterestAsCollateral;

        //If frozen collateral amount of the loan covers loan principal + loan interest accrued
        if (loan.frozenCollateralAmount >= remainingTotal) {
            return LoanLib.DelinquencyInfo(remainingTotal, 0, int256(interestAccrued));
        }

        int256 poolValueAdjust;

        //If frozen collateral amount of the loan covers loan principal and part of loan interest accrued
        if (loan.frozenCollateralAmount > remainingAmountAsCollateral) {
            poolValueAdjust = int256(
                priceFeed.convert(
                    loan.frozenCollateralAmount - remainingAmountAsCollateral,
                    loan.frozenCollateralToken,
                    loanToken
                )
            );
        } else if (loan.frozenCollateralAmount < remainingAmountAsCollateral) {
            poolValueAdjust = -int256(
                priceFeed.convert(
                    remainingAmountAsCollateral - loan.frozenCollateralAmount,
                    loan.frozenCollateralToken,
                    loanToken
                )
            );
        }

        //This case will occur if frozen collateral amount of the loan covers exact loan principal
        uint256 notCovered = priceFeed.convert(
            remainingTotal - loan.frozenCollateralAmount,
            loan.frozenCollateralToken,
            loanToken
        );

        return LoanLib.DelinquencyInfo(loan.frozenCollateralAmount, notCovered, poolValueAdjust);
    }

    function isDelinquent(uint256 loanId) public view returns (bool) {
        LoanLib.Loan memory loan = _loans[loanId];

        //Check if loan exists or it's too early to liquidation or loan was liquidated
        if (
            loan.amount == 0 ||
            block.timestamp <= loan.liquidationDate ||
            loan.status == LoanLib.Status.DEFAULT_PART ||
            loan.status == LoanLib.Status.DEFAULT_FULL_PAID ||
            loan.status == LoanLib.Status.DEFAULT_FULL_LIQUIDATED
        ) {
            return false;
        }

        return true;
    }

    /**
     * @dev Pause all method with ifNotPaused modifier
     */
    function pause() external onlyRole(Roles.PAUSER) {
        _pause();
    }

    /**
     * @dev Unpause early paused all methods with ifNotPaused modifier
     */
    function unpause() external onlyRole(Roles.PAUSER) {
        _unpause();
    }

    function setFuncPaused(string memory name, bool paused) external onlyRole(Roles.PAUSER) {
        _setFuncPaused(name, paused);
    }

    function currentVersion() public pure override(ILoanManager, IVersion) returns (string memory) {
        return LOAN_MANAGER_VERSION;
    }
}
