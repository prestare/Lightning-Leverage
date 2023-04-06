// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import "hardhat/console.sol";

contract Swap {
    struct SwapParams {
        bytes path;
        bool single;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @dev The length of the bytes encoded address
    uint256 private constant ADDR_SIZE = 20;
    /// @dev The length of the bytes encoded fee
    uint256 private constant FEE_SIZE = 3;
    /// @dev The offset of a single token address and pool fee
    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;

    IERC20 public WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    ISwapRouter public swapRouter;

    constructor(ISwapRouter _swapRouter) {
        swapRouter = _swapRouter;
    }

    function swap(
        SwapParams memory swapParams
    ) public returns (uint256 amountOut) {
        if (swapParams.single) {
            amountOut = swapExactInputSingle(
                swapParams.path,
                swapParams.recipient,
                swapParams.amountIn,
                swapParams.amountOutMinimum
            );
        } else {
            amountOut = swapExactInput(
                swapParams.path,
                swapParams.recipient,
                swapParams.amountIn,
                swapParams.amountOutMinimum
            );
        }
        console.log("end swap");
    }

    function swapExactInputSingle(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = decodeFirstPool(path);
        console.log("tokenIn:", tokenIn);
        console.log("tokenOut:", tokenOut);
        console.log("fee:", fee);

        _safeApprove(tokenIn, address(swapRouter), amountIn);
        console.log("success to safeApprove");
        // if flashloan to contracts, need to remove
        bool success = IERC20(tokenIn).transferFrom(
            msg.sender,
            address(this),
            amountIn
        );
        console.log("success: ", success);

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

        amountOut = swapRouter.exactInputSingle(params);
        console.log("amountOut:", amountOut);
    }

    function swapExactInput(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256 amountOut) {
        console.log("in swapExactInput");
        (address tokenIn, , ) = decodeFirstPool(path);

        _safeApprove(tokenIn, address(swapRouter), amountIn);
        // if flashloan to contracts, need to remove
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter
            .ExactInputParams({
                path: path,
                recipient: recipient,
                deadline: block.timestamp + 3000,
                amountIn: amountIn,
                amountOutMinimum: amountOutMinimum
            });

        amountOut = swapRouter.exactInput(params);
    }

    /// @notice Decodes the first pool in path
    /// @param path The bytes encoded swap path
    /// @return tokenA The first token of the given pool
    /// @return tokenB The second token of the given pool
    /// @return fee The fee level of the pool
    function decodeFirstPool(
        bytes memory path
    ) internal pure returns (address tokenA, address tokenB, uint24 fee) {
        tokenA = toAddress(path, 0);
        fee = toUint24(path, ADDR_SIZE);
        tokenB = toAddress(path, NEXT_OFFSET);
    }

    function toAddress(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (address) {
        require(_start + 20 >= _start, "toAddress_overflow");
        require(_bytes.length >= _start + 20, "toAddress_outOfBounds");
        address tempAddress;

        assembly {
            tempAddress := div(
                mload(add(add(_bytes, 0x20), _start)),
                0x1000000000000000000000000
            )
        }

        return tempAddress;
    }

    function toUint24(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (uint24) {
        require(_start + 3 >= _start, "toUint24_overflow");
        require(_bytes.length >= _start + 3, "toUint24_outOfBounds");
        uint24 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x3), _start))
        }

        return tempUint;
    }

    function _safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "SA"
        );
    }
}
