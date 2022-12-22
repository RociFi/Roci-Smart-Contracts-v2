// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "../NFCS.sol";

contract MockNFCS is NFCS {
    function getSelector(string calldata funcName) external pure returns (bytes4) {
        return bytes4(keccak256(bytes(funcName)));
    }

    function isApprovedOrOwner(address spender, uint256 tokenId)
        external
        view
        virtual
        returns (bool)
    {
        return super._isApprovedOrOwner(spender, tokenId);
    }
}
