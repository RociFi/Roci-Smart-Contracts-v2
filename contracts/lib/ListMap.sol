// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";

import {IPool} from "../interfaces/IPool.sol";

import {Errors} from "./Errors.sol";

/*
 * @title ListMap
 * @author RociFi Labs
 * @notice Library for combining lists and mapping
 * @notice Allows to manage easily collections and avoid iterations
 */
library ListMap {
    struct _uint256 {
        uint256[] list;
        mapping(uint256 => bool) includes;
    }

    struct _uint16 {
        uint16[] list;
        mapping(uint16 => bool) includes;
    }

    struct _IERC20MetadataUpgradeable {
        IERC20MetadataUpgradeable[] list;
        mapping(IERC20MetadataUpgradeable => bool) includes;
    }

    struct _IPool {
        IPool[] list;
        mapping(IPool => bool) includes;
    }

    /**
     * @dev remove list
     * @param listMap listMap which should be changed
     * @param list list of items to remove from listMap
     */
    function removeList(_uint16 storage listMap, uint16[] memory list) internal {
        for (uint256 i; i < list.length; i++) {
            remove(listMap, list[i]);
        }
    }

    /**
     * @dev remove list
     * @param listMap listMap which should be changed
     * @param list list of items to remove from listMap
     */
    function removeList(_uint256 storage listMap, uint256[] memory list) internal {
        for (uint256 i; i < list.length; i++) {
            remove(listMap, list[i]);
        }
    }

    /**
     * @dev remove list
     * @param listMap listMap which should be changed
     * @param list list of items to remove from listMap
     */
    function removeList(
        _IERC20MetadataUpgradeable storage listMap,
        IERC20MetadataUpgradeable[] memory list
    ) internal {
        for (uint256 i; i < list.length; i++) {
            remove(listMap, list[i]);
        }
    }

    /**
     * @dev remove list
     * @param listMap listMap which should be changed
     * @param list list of items to remove from listMap
     */
    function removeList(_IPool storage listMap, IPool[] memory list) internal {
        for (uint256 i; i < list.length; i++) {
            remove(listMap, list[i]);
        }
    }

    /**
     * @dev remove item
     * @param listMap listMap which should be changed
     * @param value item to remove from listMap
     */
    function remove(_uint16 storage listMap, uint16 value) internal {
        for (uint256 i; i < listMap.list.length; i++) {
            if (listMap.list[i] == value) {
                listMap.list[i] = listMap.list[listMap.list.length - 1];
                listMap.list.pop();
                listMap.includes[value] = false;
                return;
            }
        }
        revert(Errors.NO_ELEMENT_IN_ARRAY);
    }

    /**
     * @dev remove item
     * @param listMap listMap which should be changed
     * @param value item to remove from listMap
     */
    function remove(_uint256 storage listMap, uint256 value) internal {
        for (uint256 i; i < listMap.list.length; i++) {
            if (listMap.list[i] == value) {
                listMap.list[i] = listMap.list[listMap.list.length - 1];
                listMap.list.pop();
                listMap.includes[value] = false;
                return;
            }
        }
        revert(Errors.NO_ELEMENT_IN_ARRAY);
    }

    /**
     * @dev remove item
     * @param listMap listMap which should be changed
     * @param value item to remove from listMap
     */
    function remove(
        _IERC20MetadataUpgradeable storage listMap,
        IERC20MetadataUpgradeable value
    ) internal {
        for (uint256 i; i < listMap.list.length; i++) {
            if (listMap.list[i] == value) {
                listMap.list[i] = listMap.list[listMap.list.length - 1];
                listMap.list.pop();
                listMap.includes[value] = false;
                return;
            }
        }
        revert(Errors.NO_ELEMENT_IN_ARRAY);
    }

    /**
     * @dev remove item
     * @param listMap listMap which should be changed
     * @param value item to remove from listMap
     */
    function remove(_IPool storage listMap, IPool value) internal {
        for (uint256 i; i < listMap.list.length; i++) {
            if (listMap.list[i] == value) {
                listMap.list[i] = listMap.list[listMap.list.length - 1];
                listMap.list.pop();
                listMap.includes[value] = false;
                return;
            }
        }
        revert(Errors.NO_ELEMENT_IN_ARRAY);
    }

    /**
     * @dev add list
     * @param listMap listMap which should be changed
     * @param list list of items to add to listMap
     */
    function addList(_uint16 storage listMap, uint16[] memory list) internal {
        for (uint256 i; i < list.length; i++) {
            add(listMap, list[i]);
        }
    }

    /**
     * @dev add list
     * @param listMap listMap which should be changed
     * @param list list of items to add to listMap
     */
    function addList(_uint256 storage listMap, uint256[] memory list) internal {
        for (uint256 i; i < list.length; i++) {
            add(listMap, list[i]);
        }
    }

    /**
     * @dev add list
     * @param listMap listMap which should be changed
     * @param list list of items to add to listMap
     */
    function addList(
        _IERC20MetadataUpgradeable storage listMap,
        IERC20MetadataUpgradeable[] memory list
    ) internal {
        for (uint256 i; i < list.length; i++) {
            add(listMap, list[i]);
        }
    }

    /**
     * @dev add list
     * @param listMap listMap which should be changed
     * @param list list of items to add to listMap
     */
    function addList(_IPool storage listMap, IPool[] memory list) internal {
        for (uint256 i; i < list.length; i++) {
            add(listMap, list[i]);
        }
    }

    /**
     * @dev add item
     * @param listMap listMap which should be changed
     * @param value item to add to listMap
     */
    function add(_uint256 storage listMap, uint256 value) internal {
        require(!listMap.includes[value], Errors.ELEMENT_IN_ARRAY);
        listMap.includes[value] = true;
        listMap.list.push(value);
    }

    /**
     * @dev add item
     * @param listMap listMap which should be changed
     * @param value item to add to listMap
     */
    function add(_uint16 storage listMap, uint16 value) internal {
        require(!listMap.includes[value], Errors.ELEMENT_IN_ARRAY);
        listMap.includes[value] = true;
        listMap.list.push(value);
    }

    /**
     * @dev add item
     * @param listMap listMap which should be changed
     * @param value item to add to listMap
     */
    function add(
        _IERC20MetadataUpgradeable storage listMap,
        IERC20MetadataUpgradeable value
    ) internal {
        require(!listMap.includes[value], Errors.ELEMENT_IN_ARRAY);
        listMap.includes[value] = true;
        listMap.list.push(value);
    }

    /**
     * @dev add item
     * @param listMap listMap which should be changed
     * @param value item to add to listMap
     */
    function add(_IPool storage listMap, IPool value) internal {
        require(!listMap.includes[value], Errors.ELEMENT_IN_ARRAY);
        listMap.includes[value] = true;
        listMap.list.push(value);
    }

    /**
     * @dev Check that listMap contains all values from list
     * @param listMap listMap to check
     * @param values values which should be present
     */
    function includesAll(
        _IERC20MetadataUpgradeable storage listMap,
        IERC20MetadataUpgradeable[] memory values
    ) internal view {
        for (uint256 i; i < values.length; i++) {
            require(listMap.includes[values[i]], Errors.ELEMENT_IN_ARRAY);
        }
    }
}
