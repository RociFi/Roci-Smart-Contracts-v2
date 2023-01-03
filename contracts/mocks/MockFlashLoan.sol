// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Pool} from "../../contracts/Pool.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";

contract MockFlashLoan {
    Pool public pool;
    MockERC20 public token;

    constructor(address _pool, address _token) {
        pool = Pool(_pool);
        token = MockERC20(_token);
    }

    function executeOperation(uint256 depositAmount, string memory poolVersion)
        external
        returns (bool)
    {
        flashDeposit(depositAmount, poolVersion);
        flashWithdraw(depositAmount, poolVersion);
        return true;
    }

    function flashDeposit(uint256 depositAmount, string memory poolVersion) public {
        pool.deposit(depositAmount, poolVersion);
    }

    function flashWithdraw(uint256 depositAmount, string memory poolVersion) public {
        pool.withdraw(depositAmount, poolVersion);
    }

    function approve(address _spender, uint256 _amount) public virtual returns (bool) {
        token.approve(_spender, _amount);
        return true;
    }

    function burn(uint256 _amount) public virtual {
        token.burn(_amount);
    }
}
