// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {LoanManager} from "../LoanManager.sol";
import {LoanLib} from "../lib/LoanLib.sol";

contract MockLoanManager is LoanManager {
    function addLoan(LoanLib.Loan memory loan, uint256 id) public {
        collateralManager.addCollateral(
            msg.sender,
            loan.frozenCollateralToken,
            loan.frozenCollateralAmount
        );

        uint256 collateralToFreeze = priceFeed.convert(
            (loan.amount * 100 ether) / loan.ltv,
            loan.pool.underlyingToken(),
            loan.frozenCollateralToken
        );

        collateralManager.freeze(msg.sender, loan.frozenCollateralToken, collateralToFreeze);

        loan.frozenCollateralAmount = collateralToFreeze;

        _loans[id] = loan;

        loan.pool.underlyingToken().transferFrom(address(loan.pool), msg.sender, loan.amount);
    }
}
