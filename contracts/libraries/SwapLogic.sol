// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./Path.sol";

library SwapLogic {
    using Path for bytes;

    struct SwapParams {
        uint256 amount;
        uint256 amountM;
        bool single;
        address recipient;
        bytes path;
    }

    function swap(
        SwapParams memory swapParams,
        bool exactOut,
        address swapRouter
    ) external returns (uint256 amount) {
        if (exactOut) {
            return swapExactOutputs(swapParams, swapRouter);
        } else {
            return swapExactInputs(swapParams, swapRouter);
        }
    }

    function swapExactInputs(
        SwapParams memory swapParams,
        address swapRouter
    ) internal returns (uint256 amountOut) {
        if (swapParams.single) {
            amountOut = swapExactInputSingle(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM,
                swapRouter
            );
        } else {
            amountOut = swapExactInput(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM,
                swapRouter
            );
        }
    }

    function swapExactOutputs(
        SwapParams memory swapParams,
        address swapRouter
    ) internal returns (uint256 amountIn) {
        if (swapParams.single) {
            amountIn = swapExactOutputSingle(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM,
                swapRouter
            );
        } else {
            amountIn = swapExactOutput(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM,
                swapRouter
            );
        }
    }

    function swapExactInputSingle(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address swapRouter
    ) internal returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = path
            .decodeFirstPool();

        _safeApprove(tokenIn, swapRouter, amountIn);
        // IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum,
                sqrtPriceLimitX96: 0
            });

        amountOut = ISwapRouter(swapRouter).exactInputSingle(params);
    }

    function swapExactInput(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum,
        address swapRouter
    ) internal returns (uint256 amountOut) {
        (address tokenIn, , ) = path.decodeFirstPool();

        _safeApprove(tokenIn, swapRouter, amountIn);
        // IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: path,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });

        amountOut = ISwapRouter(swapRouter).exactInput(params);
    }

    function swapExactOutputSingle(
        bytes memory path,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum,
        address swapRouter
    ) internal returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = path
            .decodeFirstPool();

        _safeApprove(tokenIn, swapRouter, amountInMaximum);
        // IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
            .ExactOutputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum,
                sqrtPriceLimitX96: 0
            });

        amountIn = ISwapRouter(swapRouter).exactOutputSingle(params);
    }

    function swapExactOutput(
        bytes memory path,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum,
        address swapRouter
    ) internal returns (uint256 amountIn) {
        (, address tokenIn, ) = path.decodeFirstPool();

        _safeApprove(tokenIn, swapRouter, amountInMaximum);
        // IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactOutputParams memory params = ISwapRouter
            .ExactOutputParams({
                path: path,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });

        amountIn = ISwapRouter(swapRouter).exactOutput(params);
    }

    function _safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(0x095ea7b3, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            Errors.APPROVE_FAILED
        );
    }
}
