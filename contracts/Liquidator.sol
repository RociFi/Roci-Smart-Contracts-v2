// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import {IERC20MetadataUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import {SafeERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import {IPriceFeed} from "./interfaces/IPriceFeed.sol";
import {ILoanManager} from "./interfaces/ILoanManager.sol";
import {IPool} from "./interfaces/IPool.sol";
import {LIQUIDATOR_VERSION} from "./lib/ContractVersions.sol";

import {Errors} from "./lib/Errors.sol";
import {Roles} from "./lib/Roles.sol";
import {Version} from "./lib/Version.sol";

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/*
 * @title Liquidator
 * @author RociFi Labs
 * @notice Contract that holds liquidity, manage liquidations and liquidity swap
 */
contract Liquidator is Initializable, AccessControlUpgradeable, UUPSUpgradeable, Version {
    //Liquidity record structure, using to hold liquidity parameters
    struct LiquidityToSwap {
        IERC20MetadataUpgradeable collateralToken;
        IERC20MetadataUpgradeable underlyingToken;
        uint256 amount;
        IPool pool;
    }

    event LoanManagerChanged(
        address indexed admin,
        ILoanManager indexed from,
        ILoanManager indexed to,
        uint256 timestamp
    );

    event PriceFeedChanged(
        address indexed admin,
        IPriceFeed indexed from,
        IPriceFeed indexed to,
        uint256 timestamp
    );

    event SwapRouterChanged(
        address indexed admin,
        ISwapRouter indexed from,
        ISwapRouter indexed to,
        uint256 timestamp
    );

    event LiquidityStored(
        IERC20MetadataUpgradeable indexed collateralToken,
        IERC20MetadataUpgradeable indexed underlyingToken,
        uint256 collateralAmount,
        IPool indexed pool
    );

    event LiquiditySwapped(uint256 liquidityRecordIndex, uint256 amountIn, uint256 amountOut);

    event EmergencyWithdraw(
        address indexed token,
        address indexed receiver,
        uint256 amount,
        uint256 timestamp
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;

    //External contracts
    IPriceFeed public priceFeed;
    ILoanManager public loanManager;
    ISwapRouter public swapRouter;

    //Liquidity records
    LiquidityToSwap[] public liquidity;

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(Roles.UPDATER)
    {}

    function initialize(address _admin) public initializer {
        require(_admin != address(0), Errors.ZERO_ADDRESS);

        _setRoleAdmin(Roles.UPDATER, Roles.ADMIN);
        _setRoleAdmin(Roles.ADMIN, Roles.ADMIN);
        _setRoleAdmin(Roles.LIQUIDATION_BOT, Roles.ADMIN);

        _grantRole(Roles.ADMIN, _admin);
    }

    /**
     * @dev Returns last liquidity record after liquidations
     * @return last liquidity record
     */
    function getLastLiquidity() external view returns (LiquidityToSwap memory) {
        return liquidity[liquidity.length - 1];
    }

    /**
     * @dev LoanManager address setter
     * @param _loanManager address
     */
    function setLoanManager(ILoanManager _loanManager) external onlyRole(Roles.ADMIN) {
        require(address(_loanManager) != address(0), Errors.ZERO_ADDRESS);

        emit LoanManagerChanged(msg.sender, loanManager, _loanManager, block.timestamp);

        loanManager = _loanManager;
    }

    /**
     * @dev PriceFeed address setter
     * @param _priceFeed address
     */
    function setPriceFeed(IPriceFeed _priceFeed) external onlyRole(Roles.ADMIN) {
        require(address(_priceFeed) != address(0), Errors.ZERO_ADDRESS);

        emit PriceFeedChanged(msg.sender, priceFeed, _priceFeed, block.timestamp);

        priceFeed = _priceFeed;
    }

    /**
     * @dev UniSwapV3Router address setter
     * @param _swapRouter address
     */
    function setUniSwapV3Router(ISwapRouter _swapRouter) external onlyRole(Roles.ADMIN) {
        require(address(_swapRouter) != address(0), Errors.ZERO_ADDRESS);

        emit SwapRouterChanged(msg.sender, swapRouter, _swapRouter, block.timestamp);

        swapRouter = _swapRouter;
    }

    /**
     * @dev Approves asset token to be spendable by LoanManager to cover liquidated loan
     * @param asset amount of asset
     * @param amount price from Chainlink feed
     */
    function approveAsset(address asset, uint256 amount) external onlyRole(Roles.ADMIN) {
        require(address(loanManager) != address(0), Errors.ZERO_ADDRESS);

        IERC20MetadataUpgradeable(asset).approve(address(loanManager), amount);
    }

    /**
     * @dev Liquidates loan by calling loan manager and creates new liquidity record
     * @param loanId id of the loan
     * @param version Liquidator contract version
     */
    function liquidateAndStore(uint256 loanId, string memory version)
        external
        checkVersion(version)
        onlyRole(Roles.LIQUIDATION_BOT)
    {
        require(address(loanManager) != address(0), Errors.ZERO_ADDRESS);

        (
            IERC20MetadataUpgradeable collateralToken,
            IERC20MetadataUpgradeable underlyingToken,
            uint256 collateralAmount,
            IPool pool
        ) = loanManager.liquidate(loanId, loanManager.currentVersion());

        liquidity.push(LiquidityToSwap(collateralToken, underlyingToken, collateralAmount, pool));

        emit LiquidityStored(collateralToken, underlyingToken, collateralAmount, pool);
    }

    /**
     * @dev Internal method that prepares swap params from last liquidity record
     * @return amountIn amount of input token to swap
     * @return amountOutPriced priced amount of token output
     * @return liquidityRecordIndex index of liquidity record
     * @return collateralToken input token of swap
     * @return underlyingToken output token of swap
     */
    function prepareSwap()
        internal
        returns (
            uint256 amountIn,
            uint256 amountOutPriced,
            uint256 liquidityRecordIndex,
            IERC20MetadataUpgradeable collateralToken,
            IERC20MetadataUpgradeable underlyingToken
        )
    {
        require(address(swapRouter) != address(0), Errors.ZERO_ADDRESS);
        require(liquidity.length > 0, Errors.LIQUIDATOR_NOTHING_TO_SWAP);

        liquidityRecordIndex = liquidity.length - 1;
        LiquidityToSwap memory liquidityRecord = liquidity[liquidityRecordIndex];

        amountIn = liquidityRecord.amount;
        collateralToken = liquidityRecord.collateralToken;
        underlyingToken = liquidityRecord.underlyingToken;

        uint256 balance = collateralToken.balanceOf(address(this));

        require(balance >= liquidityRecord.amount, Errors.LIQUIDATOR_INSUFFICIENT_FUNDS);

        collateralToken.approve(address(swapRouter), liquidityRecord.amount);

        amountOutPriced = priceFeed.convert(amountIn, collateralToken, underlyingToken);
    }

    /**
     * @dev Internal method that clean-up liquidity record mapping after swap and fire event
     * @param liquidityRecordIndex liquidityRecordIndex
     * @param amountIn amount of input token
     * @param amountOut amount of output token received with swap
     */
    function cleanUpSwap(
        uint256 liquidityRecordIndex,
        uint256 amountIn,
        uint256 amountOut
    ) internal {
        liquidity.pop();

        emit LiquiditySwapped(liquidityRecordIndex, amountIn, amountOut);
    }

    /**
     * @dev External method that swap liquidity with one UniSwap pool
     * @notice Callable only by LIQUIDATION_BOT
     * @param poolFee fee of the pool
     * @param slippage swap slippage percent
     * @param version Liquidator contract version
     */
    function swapLastDirect(
        uint24 poolFee,
        uint8 slippage,
        string memory version
    ) external checkVersion(version) onlyRole(Roles.LIQUIDATION_BOT) {
        (
            uint256 amountIn,
            uint256 amountOutByPrice,
            uint256 liquidityRecordIndex,
            IERC20MetadataUpgradeable collateralToken,
            IERC20MetadataUpgradeable underlyingToken
        ) = prepareSwap();

        //poolFee is percent with decimals 4 and slippage is percent with decimals 0
        //poolFee = 500 means 0.05%
        uint256 amountOutMinimum = amountOutByPrice -
            ((amountOutByPrice * poolFee) / 1000000) -
            ((amountOutByPrice * slippage) / 100);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(collateralToken),
            tokenOut: address(underlyingToken),
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = swapRouter.exactInputSingle(params);
        require(amountOut >= amountOutMinimum, Errors.LIQUIDATOR_MINIMUM_SWAP_FAILED);

        cleanUpSwap(liquidityRecordIndex, amountIn, amountOut);
    }

    /**
     * @dev External method that swap liquidity with path of UniSwap pools
     * @notice Callable only by LIQUIDATION_BOT
     * @param path of swaps between pools
     * @notice path can be a single pool
     * @param slippage swap slippage percent
     * @param version Liquidator contract version
     */
    function swapLastMultihop(
        bytes memory path,
        uint8 slippage,
        string memory version
    ) external checkVersion(version) onlyRole(Roles.LIQUIDATION_BOT) {
        (
            uint256 amountIn,
            uint256 amountOutByPrice,
            uint256 liquidityRecordIndex,
            IERC20MetadataUpgradeable collateralToken,
            IERC20MetadataUpgradeable underlyingToken
        ) = prepareSwap();

        //Slippage is percent with decimals 0
        uint256 amountOutMinimum = amountOutByPrice - ((amountOutByPrice * slippage) / 100);

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: abi.encodePacked(address(collateralToken), path, address(underlyingToken)),
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum
        });

        uint256 amountOut = swapRouter.exactInput(params);

        require(amountOut >= amountOutMinimum, Errors.LIQUIDATOR_MINIMUM_SWAP_FAILED);

        cleanUpSwap(liquidityRecordIndex, amountIn, amountOut);
    }

    /**
     * @dev External method allows to admin manager withdraw stuck funds
     * @notice Callable only by ADMIN
     * @param token to rescue
     * @param amount of token
     * @param version Liquidator contract version
     */
    function emergencyWithdraw(
        IERC20MetadataUpgradeable token,
        uint256 amount,
        string memory version
    ) external checkVersion(version) onlyRole(Roles.ADMIN) {
        token.safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(address(token), msg.sender, amount, block.timestamp);
    }

    function currentVersion() public pure override returns (string memory) {
        return LIQUIDATOR_VERSION;
    }
}
