// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface INFCS {
    // Receives an address array, verifies ownership of address, mints a token, stores the bundle against token ID, sends token to msg.sender
    function mintToken(
        address[] calldata bundle,
        bytes[] calldata signatures,
        string calldata imageUrl,
        string calldata version
    ) external payable;

    // Receives a tokenId, returns corresponding address bundle
    function getBundle(uint256 tokenId) external view returns (address[] memory);

    // Receives an address, returns tokenOwned by it if any, otherwise reverts
    function getToken(address tokenOwner) external view returns (uint256);

    //Returns primary address for secondary address of bundle.
    function getPrimaryAddress(address user) external view returns (address);
}

// needed for compatibility of storage layout in NFCS contract
interface IAddressBook {

}
