// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

interface IScoreDB {
    event ScoreUpdated(uint256 timestamp, uint256 indexed tokenId, uint16 indexed score);
    event NFCSSignerAddressChanged(uint256 timestamp, address indexed nfcsSignerAddress);

    event MinScoreChanged(address user, uint256 old, uint256 updated, uint256 timestamp);
    event MaxScoreChanged(address user, uint256 old, uint256 updated, uint256 timestamp);
    event ScoreValidityPeriodChanged(address user, uint256 old, uint256 updated, uint256 timestamp);

    struct Score {
        uint256 timestamp;
        uint256 tokenId;
        uint16 creditScore;
    }

    function getScore(uint256 tokenId) external view returns (Score memory);

    function getCreditScoreAndValidate(uint256 tokenId) external view returns (uint16);
}
