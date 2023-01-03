// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface INFCS {
    // Receives an address array, verifies ownership of address, mints a token, stores the bundle against token ID, sends token to msg.sender
    function mintToken(
        address[] memory bundle,
        bytes[] memory signatures,
        string memory version
    ) external;

    // Receives a tokenId, returns corresponding address bundle
    function getBundle(uint256 tokenId) external view returns (address[] memory);

    // Receives an address, returns tokenOwned by it if any, otherwise reverts
    function getToken(address tokenOwner) external view returns (uint256);
}
