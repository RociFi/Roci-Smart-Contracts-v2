// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IVersion} from "../interfaces/IVersion.sol";

interface NFCSInterface is IVersion {
    // Receives an address array, verifies ownership of addrs [WIP], mints a token, stores the bundle against token ID, sends token to msg.sender
    function mintToken(
        address[] memory bundle,
        bytes[] memory signatures,
        string memory version
    ) external;

    // Receives a tokenId, returns corresponding address bundle
    function getBundle(uint256 tokenId) external view returns (address[] memory);

    // Receives an address, returns tokenOwned by it if any, otherwise reverts
    function getToken(address tokenOwner) external view returns (uint256);

    function getTotalOutstanding(uint256 _nfcsId)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    // function getUserAddressTotalOustanding(address _user) external view returns(uint);

    // function getGlobalTotalOustanding() external view returns(uint);

    function getLimits()
        external
        view
        returns (
            uint128,
            uint128,
            uint128,
            uint128
        );

    function getNFCSLimits(uint256 _nfcsId) external view returns (uint128, uint128);
}
