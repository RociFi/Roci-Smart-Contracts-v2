// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {ListMap} from "../lib/ListMap.sol";
import {IPool} from "../interfaces/IPool.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

contract ListMapUsage {
    using ListMap for ListMap._uint16;
    using ListMap for ListMap._uint256;
    using ListMap for ListMap._IERC20MetadataUpgradeable;
    using ListMap for ListMap._IPool;

    ListMap._uint16 internal uint16list;
    ListMap._uint256 internal uint256list;
    ListMap._IERC20MetadataUpgradeable internal erc20metadata;
    ListMap._IPool internal pools;

    function getUint16list() external view returns (uint16[] memory) {
        return uint16list.list;
    }

    function addUint16(uint16[] memory _number) external {
        uint16list.addList(_number);
    }

    function removeUint16(uint16[] memory _number) external {
        uint16list.removeList(_number);
    }

    function getUint256list() external view returns (uint256[] memory) {
        return uint256list.list;
    }

    function addUint256(uint256[] memory _number) external {
        uint256list.addList(_number);
    }

    function removeUint256(uint256[] memory _number) external {
        uint256list.removeList(_number);
    }

    function getErc20metadataList() external view returns (IERC20MetadataUpgradeable[] memory) {
        return erc20metadata.list;
    }

    function addErc20metadata(IERC20MetadataUpgradeable[] memory _collaterals) external {
        erc20metadata.addList(_collaterals);
    }

    function removeErc20metadata(IERC20MetadataUpgradeable[] memory _collaterals) external {
        erc20metadata.removeList(_collaterals);
    }

    function getPoolList() external view returns (IPool[] memory) {
        return pools.list;
    }

    function addPool(IPool[] memory _pool) external {
        pools.addList(_pool);
    }

    function removePool(IPool[] memory _pool) external {
        pools.removeList(_pool);
    }
}
