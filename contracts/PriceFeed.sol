// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IPriceFeed} from "./interfaces/IPriceFeed.sol";

import {USD_ADDRESS} from "./lib/Constants.sol";
import {Errors} from "./lib/Errors.sol";
import {Roles} from "./lib/Roles.sol";
import {Version} from "./lib/Version.sol";
import {PRICE_FEED_VERSION} from "./lib/ContractVersions.sol";

/*
 * @title PriceFeed
 * @author RociFi Labs
 * @notice Contract for converting assets using Chainlink Feeds
 */
contract PriceFeed is
    IPriceFeed,
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    Version
{
    struct Feed {
        // Chainlink feed address
        address feedAddress;
        // decimals for "from" token
        uint8 decimals;
    }

    // "from" asset => "to" asset => Feed
    mapping(IERC20MetadataUpgradeable => mapping(IERC20MetadataUpgradeable => Feed))
        internal fromToFeed;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin) public initializer {
        require(admin != address(0), Errors.ZERO_ADDRESS);

        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);

        _grantRole(Roles.ADMIN, admin);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(Roles.UPDATER)
    {}

    /**
     * @dev Method to add/remove Chainlink price feed
     * @param feedAddress address
     * @param from "from" token in Chainlink
     * @param to "to" token in Chainlink
     */
    function setPriceFeed(
        address feedAddress,
        IERC20MetadataUpgradeable from,
        IERC20MetadataUpgradeable to
    ) external onlyRole(Roles.ADMIN) {
        uint8 decimals = from.decimals();
        fromToFeed[from][to] = Feed(feedAddress, decimals);
        emit PriceFeedSet(block.timestamp, feedAddress, from, to, decimals);
    }

    /**
     * @dev Method to convert arbitrary asset to another
     * @notice converted value is adjusted to corresponding asset decimals
     * @notice For USD - decimals are equal 8, since all price feeds returns this value for X_TOKEN => USD
     * @param amount amount of origin asset
     * @param origin address of origin asset
     * @param target address of target asset
     * @return result amount of target asset
     */
    function convert(
        uint256 amount,
        IERC20MetadataUpgradeable origin,
        IERC20MetadataUpgradeable target
    ) external view returns (uint256) {
        Feed memory fromOriginToUsd = fromToFeed[origin][IERC20MetadataUpgradeable(USD_ADDRESS)];
        Feed memory fromTargetToUsd = fromToFeed[target][IERC20MetadataUpgradeable(USD_ADDRESS)];

        if (target == IERC20MetadataUpgradeable(USD_ADDRESS)) {
            require(
                fromOriginToUsd.feedAddress != address(0),
                Errors.PRICE_FEED_TOKEN_NOT_SUPPORTED
            );
            return
                calculatePrice(
                    amount,
                    queryFeed(fromOriginToUsd.feedAddress),
                    fromOriginToUsd.decimals,
                    true
                );
        }

        if (origin == IERC20MetadataUpgradeable(USD_ADDRESS)) {
            require(
                fromTargetToUsd.feedAddress != address(0),
                Errors.PRICE_FEED_TOKEN_NOT_SUPPORTED
            );
            return
                calculatePrice(
                    amount,
                    queryFeed(fromTargetToUsd.feedAddress),
                    fromTargetToUsd.decimals,
                    false
                );
        }

        require(
            fromOriginToUsd.feedAddress != address(0) && fromTargetToUsd.feedAddress != address(0),
            Errors.PRICE_FEED_TOKEN_NOT_SUPPORTED
        );

        uint256 usdAmount = calculatePrice(
            amount,
            queryFeed(fromOriginToUsd.feedAddress),
            fromOriginToUsd.decimals,
            true
        );

        return
            calculatePrice(
                usdAmount,
                queryFeed(fromTargetToUsd.feedAddress),
                fromTargetToUsd.decimals,
                false
            );
    }

    /**
     * @dev Method to calculate asset price
     * @param amount amount of asset
     * @param price price from Chainlink feed
     * @param decimals decimals for "from" asset in Chainlink 
     * @param direct flag to decide is asset "from" or "to" in Chainlink
     * @return result calculated price
     */
    function calculatePrice(
        uint256 amount,
        uint256 price,
        uint8 decimals,
        bool direct
    ) internal pure returns (uint256) {
        if (direct) {
            return (amount * price) / 10**decimals;
        }
        return (amount * 10**decimals) / price;
    }

    /**
     * @dev query Chainlink feed
     * @param feedAddress address of Chainlink feed
     * @return price price from Chainlink feed
     */
    function queryFeed(address feedAddress) internal view virtual returns (uint256) {
        (, int256 price, , , ) = AggregatorV3Interface(feedAddress).latestRoundData();
        require(price > 0, Errors.PRICE_FEED_TOKEN_BELOW_ZERO);
        return uint256(price);
    }

    /**
     * @dev get current contract version
     */
    function currentVersion() public pure override returns (string memory) {
        return PRICE_FEED_VERSION;
    }
}
