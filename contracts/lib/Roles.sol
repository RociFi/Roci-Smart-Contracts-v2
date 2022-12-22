// SPDX-License-Identifier: None
pragma solidity ^0.8.9;

library Roles {
    bytes32 public constant ADMIN =
        bytes32(0xb055000000000000000000000000000000000000000000000000000000000000); // Admin can setup parameters and maintain protocol

    bytes32 public constant LOAN_MANAGER =
        bytes32(0xdeb7000000000000000000000000000000000000000000000000000000000000); // LoanManager can update pools params

    bytes32 public constant LIQUIDATOR =
        bytes32(0xc105e00000000000000000000000000000000000000000000000000000000000); // Liquidator contract

    bytes32 public constant UPDATER =
        bytes32(0xc105e10000000000000000000000000000000000000000000000000000000000); // Updater can update contracts

    bytes32 public constant PAUSER =
        bytes32(0xc105e12000000000000000000000000000000000000000000000000000000000); // Can pause contracts

    bytes32 public constant LIQUIDATION_BOT =
        bytes32(0xdeaf000000000000000000000000000000000000000000000000000000000000); // Liquidation bot account
}
