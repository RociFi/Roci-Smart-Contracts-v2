// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.6;
pragma abicoder v2;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {Path} from "@uniswap/v3-periphery/contracts/libraries/Path.sol";
import {MockIPriceFeed} from "./MockIPriceFeed.sol";
import {MockIERC20} from "./MockIERC20.sol";

contract MockSwapRouter is ISwapRouter {
    struct SwapCallbackData {
        bytes path;
        address payer;
    }
    using Path for bytes;

    constructor() {}

    MockIPriceFeed public priceFeed;

    function setPriceFeed(MockIPriceFeed _priceFeed) external {
        priceFeed = _priceFeed;
    }

    /// @dev Performs a single exact input swap
    function exactInputInternal(
        uint256 amountIn,
        address recipient,
        SwapCallbackData memory data
    ) private returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = data.path.decodeFirstPool();

        uint256 amountPriced = priceFeed.convert(amountIn, tokenIn, tokenOut);

        amountOut = amountPriced - ((amountPriced * fee) / 1000000);

        MockIERC20(tokenIn).burnFrom(data.payer, amountIn);

        MockIERC20(tokenOut).mint(recipient, amountOut);
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        amountOut = exactInputInternal(
            params.amountIn,
            params.recipient,
            SwapCallbackData({
                path: abi.encodePacked(params.tokenIn, params.fee, params.tokenOut),
                payer: msg.sender
            })
        );

        require(amountOut >= params.amountOutMinimum, "Too little received");
    }

    function exactInput(ExactInputParams memory params)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        address payer = msg.sender; // msg.sender pays for the first hop

        while (true) {
            bool hasMultiplePools = params.path.hasMultiplePools();

            // the outputs of prior swaps become the inputs to subsequent ones
            params.amountIn = exactInputInternal(
                params.amountIn,
                hasMultiplePools ? address(this) : params.recipient, // for intermediate swaps, this contract custodies
                SwapCallbackData({
                    path: params.path.getFirstPool(), // only the first pool in the path is necessary
                    payer: payer
                })
            );

            // decide whether to continue or terminate
            if (hasMultiplePools) {
                payer = address(this); // at this point, the caller has paid
                params.path = params.path.skipToken();
            } else {
                amountOut = params.amountIn;
                break;
            }
        }

        require(amountOut >= params.amountOutMinimum, "Too little received");
    }

    function exactOutputSingle(ExactOutputSingleParams calldata params)
        external
        payable
        override
        returns (uint256 amountIn)
    {}

    function exactOutput(ExactOutputParams calldata params)
        external
        payable
        override
        returns (uint256 amountIn)
    {}

    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {}
}
