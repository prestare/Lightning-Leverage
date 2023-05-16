// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libraries/Path.sol";

contract DepositGateWay {
    using Path for bytes;

    struct SwapParams {
        uint256 amount;
        uint256 amountM;
        bool single;
        address recipient;
        bytes path;
    }

    IPoolAddressesProvider public ADDRESSES_PROVIDER;
    IPool public POOL;
    ISwapRouter public SWAP_ROUTER;

    constructor(address provider, address swapRouter) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        SWAP_ROUTER = ISwapRouter(swapRouter);
    }

    function depositToAave(address asset, uint256 amount) external {
        IERC20(asset).approve(address(POOL), amount);
        POOL.supply(asset, amount, msg.sender, 0);
    }

    /**
     * @dev Swaps `amount` of `from` asset on Uniswap into `to` asset and supply it on Aave.
     */
    function swapAndDepositToAave(SwapParams calldata swapParams) external {
        (, address to, ) = swapParams.path.decodeLastPool();
        uint256 amountOut = swap(swapParams, false);

        IERC20(to).approve(address(POOL), swapParams.amount);
        POOL.supply(to, amountOut, msg.sender, 0);
    }

    function swap(
        SwapParams memory swapParams,
        bool exactOut
    ) public returns (uint256 amount) {
        if (exactOut) {
            return swapExactOutputs(swapParams);
        } else {
            return swapExactInputs(swapParams);
        }
    }

    function swapExactInputs(
        SwapParams memory swapParams
    ) internal returns (uint256 amountOut) {
        if (swapParams.single) {
            amountOut = swapExactInputSingle(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM
            );
        } else {
            amountOut = swapExactInput(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM
            );
        }
    }

    function swapExactOutputs(
        SwapParams memory swapParams
    ) internal returns (uint256 amountIn) {
        if (swapParams.single) {
            amountIn = swapExactOutputSingle(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM
            );
        } else {
            amountIn = swapExactOutput(
                swapParams.path,
                swapParams.recipient,
                swapParams.amount,
                swapParams.amountM
            );
        }
    }

    function swapExactInputSingle(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = path
            .decodeFirstPool();

        _safeApprove(tokenIn, address(SWAP_ROUTER), amountIn);
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

        amountOut = SWAP_ROUTER.exactInputSingle(params);
    }

    function swapExactInput(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256 amountOut) {
        (address tokenIn, , ) = path.decodeFirstPool();

        _safeApprove(tokenIn, address(SWAP_ROUTER), amountIn);
        // IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: path,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });

        amountOut = SWAP_ROUTER.exactInput(params);
    }

    function swapExactOutputSingle(
        bytes memory path,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum
    ) internal returns (uint256 amountIn) {
        (address tokenOut, address tokenIn, uint24 fee) = path
            .decodeFirstPool();

        _safeApprove(tokenIn, address(SWAP_ROUTER), amountInMaximum);
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

        amountIn = SWAP_ROUTER.exactOutputSingle(params);
    }

    function swapExactOutput(
        bytes memory path,
        address recipient,
        uint256 amountOut,
        uint256 amountInMaximum
    ) internal returns (uint256 amountIn) {
        (, address tokenIn, ) = path.decodeFirstPool();

        _safeApprove(tokenIn, address(SWAP_ROUTER), amountInMaximum);
        // IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactOutputParams memory params = ISwapRouter
            .ExactOutputParams({
                path: path,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountOut: amountOut,
                amountInMaximum: amountInMaximum
            });

        amountIn = SWAP_ROUTER.exactOutput(params);
    }

    function _safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            Errors.APPROVE_FAILED
        );
    }
}
