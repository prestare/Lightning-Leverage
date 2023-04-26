// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IFlashLoanSimpleReceiver} from "./interfaces/AAVE/IFlashLoanSimpleReceiver.sol";
import {IFlashLoanReceiver} from "./interfaces/AAVE/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IAToken} from "./interfaces/AAVE/IAToken.sol";
import {IWstETH} from "./interfaces/LIDO/IWstETH.sol";
import {ILido} from "./interfaces/LIDO/ILido.sol";
import {IComet} from "./interfaces/COMP/IComet.sol";
import {IPoolDataProvider} from "./interfaces/AAVE/IPoolDataProvider.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libraries/Path.sol";
import "./libraries/Errors.sol";

import "hardhat/console.sol";

contract FlashLoan is IFlashLoanSimpleReceiver {
    using Path for bytes;

    struct SwapParams {
        uint256 amount;
        uint256 amountM;
        bool single;
        address recipient;
        bytes path;
    }

    struct ApprovePermitParams {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    IPoolAddressesProvider public override ADDRESSES_PROVIDER;
    IComet public COMET;
    ISwapRouter public SWAP_ROUTER;

    IPool public override POOL;
    IPoolDataProvider public POOL_DATA_PROVIDER;
    address public OWNER;

    bytes32 public constant LIDOMODE = "0";
    address public LIDOADDRESS = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address payable public WSTADDRESS =
        payable(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);
    address public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    constructor(address provider, address swapRouter, address owner) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        address comet = 0xc3d688B66703497DAA19211EEdff47f25384cdc3;
        COMET = IComet(comet);
        SWAP_ROUTER = ISwapRouter(swapRouter);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        OWNER = owner;
        POOL_DATA_PROVIDER = IPoolDataProvider(
            ADDRESSES_PROVIDER.getPoolDataProvider()
        );
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        address implematation = address(this);

        assembly {
            calldatacopy(0, 0, calldatasize())
            calldatacopy(0, add(params.offset, sub(params.length, 4)), 4) // 4: selector bytes4
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                implematation,
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        address implematation = address(this);
        console.logBytes(msg.data);
        console.logBytes(params);

        assembly {
            calldatacopy(0, 0, calldatasize())
            calldatacopy(0, add(params.offset, sub(params.length, 4)), 4) // 4: selector bytes4
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                implematation,
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    // selector: 0x80ddec56
    function AaveOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) public returns (bool) {
        // params: single+amountOutMinimum+path, bool+uint256+bytes
        bool single = params.toBool(0);
        uint256 amountOutMinimum = params.toUint256(1);
        bytes calldata path = params[33:params.length - 4]; // remove selector
        (, address Long, ) = path.decodeLastPool();

        SwapParams memory swapParams = SwapParams({
            amount: amounts[0],
            amountM: amountOutMinimum,
            single: single,
            recipient: address(this),
            path: path
        });

        uint256 amountOut = swap(swapParams, false);

        return leverageAAVEPos(Long, amountOut, initiator, 0);
    }

    // selector: 16d1fb86
    function CompOperation(
        address Long,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) public returns (bool) {
        // params: single+amountIn+path, bool+uint256+bytes+bytes4
        bool single = params.toBool(0);
        uint256 amountIn = params.toUint256(1);
        uint256 amountOutMinimum = amount + premiums;
        bytes calldata path = params[33:params.length - 4]; // remove selector

        IERC20(Long).approve(address(COMET), amount);
        COMET.supplyTo(initiator, Long, amount);
        COMET.collateralBalanceOf(initiator, Long);
        COMET.withdrawFrom(initiator, address(this), USDC, amountIn);
        IERC20(USDC).balanceOf(address(this));

        SwapParams memory swapParams = SwapParams({
            amount: amountIn,
            amountM: amountOutMinimum,
            single: single,
            recipient: address(this),
            path: path
        });
        swap(swapParams, false);

        return IERC20(Long).approve(address(POOL), amountOutMinimum);
    }

    struct AaveRepayParams {
        bool single;
        uint8 v;
        uint256 amountInMaximum;
        uint256 repayAmount;
        uint256 interestRateMode;
        uint256 deadline;
        bytes32 r;
        bytes32 s;
        bytes path;
    }

    // selector: 0xd8ad4ac2
    function AaveRepayOperation(
        address Short,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) public returns (bool) {
        // params: single+amountInMaximum+interestRateMode+deadline+v+r+s+path+selector,
        // bool+uint256+uint256+uint256+uint8+bytes32+bytes32+bytes+bytes4
        AaveRepayParams memory aaveRepayParams = AaveRepayParams({
            single: params.toBool(0),
            v: params.toUint8(97),
            amountInMaximum: params.toUint256(1),
            repayAmount: amount + premiums,
            interestRateMode: params.toUint256(33),
            deadline: params.toUint256(65),
            r: bytes32(params[98:130]),
            s: bytes32(params[130:162]),
            path: params[162:params.length - 4] // remove selector
        });
        console.log("amountInMaximum", params.toUint256(1));
        console.log("interestRateMode:", params.toUint256(33));
        console.log("path");
        console.logBytes(aaveRepayParams.path);
        console.log(aaveRepayParams.v);
        console.logBytes32(aaveRepayParams.r);
        console.logBytes32(aaveRepayParams.s);

        (, address Long, ) = aaveRepayParams.path.decodeLastPool();

        IERC20(Short).approve(address(POOL), amount);
        uint256 repayAmount = POOL.repay(
            Short,
            amount,
            aaveRepayParams.interestRateMode,
            initiator
        );
        console.log("repayAmount ", repayAmount);

        (address aToken, , ) = POOL_DATA_PROVIDER.getReserveTokensAddresses(
            Long
        );

        console.log("aToken: ", aToken);
        IAToken(aToken).permit(
            initiator,
            address(this),
            aaveRepayParams.amountInMaximum,
            aaveRepayParams.deadline,
            aaveRepayParams.v,
            aaveRepayParams.r,
            aaveRepayParams.s
        );

        IAToken(aToken).transferFrom(
            initiator,
            address(this),
            aaveRepayParams.amountInMaximum
        );

        uint256 withdrawAmount = POOL.withdraw(
            Long,
            aaveRepayParams.amountInMaximum,
            address(this)
        );
        console.log("withdrawAmount ", withdrawAmount);
        console.log("repayAmount: ", aaveRepayParams.repayAmount);

        SwapParams memory swapParams = SwapParams({
            amount: amount + premiums,
            amountM: aaveRepayParams.amountInMaximum,
            single: aaveRepayParams.single,
            recipient: address(this),
            path: aaveRepayParams.path
        });

        uint256 amountIn = swap(swapParams, true);
        console.log("amountIn: ", amountIn);

        console.log("amountInMaximum: ", aaveRepayParams.amountInMaximum);
        _safeApprove(Short, address(POOL), aaveRepayParams.repayAmount);

        return
            IERC20(Long).transfer(
                initiator,
                aaveRepayParams.amountInMaximum - amountIn
            );
    }

    struct CompRepayParams {
        bool single;
        uint256 amountInMaximum;
        uint256 repayAmount;
        bytes path;
    }

    // selector: 0xeedcb9b9
    function CompRepayOperation(
        address Short,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) public returns (bool) {
        // params: single+amountInMaximum+path+selector,
        // bool+uint256+bytes+bytes4
        CompRepayParams memory compRepayParams = CompRepayParams({
            single: params.toBool(0),
            amountInMaximum: params.toUint256(1),
            repayAmount: amount + premiums,
            path: params[33:params.length - 4] // remove selector
        });
        // bool single = params.toBool(0);
        // uint256 amountInMaximum = params.toUint256(1);
        // bytes memory path = params[33:params.length - 4];
        // uint256 repayAmount = amount + premiums;
        (, address Long, ) = compRepayParams.path.decodeLastPool();
        console.log("Long:", Long);
        console.log("amountInMaximum:", compRepayParams.amountInMaximum);

        IERC20(Short).approve(address(COMET), amount);

        uint256 balance = IERC20(Short).balanceOf(address(this));
        console.log("balance", balance);
        uint256 borrowBalanceOf = COMET.borrowBalanceOf(initiator);
        console.log("borrowBalanceOf1", borrowBalanceOf);

        COMET.supplyTo(initiator, Short, amount);
        borrowBalanceOf = COMET.borrowBalanceOf(initiator);
        console.log("borrowBalanceOf", borrowBalanceOf);
        console.log("tx.origin: ", initiator);

        COMET.withdrawFrom(initiator, address(this), Long, compRepayParams.amountInMaximum);

        SwapParams memory swapParams = SwapParams({
            amount: compRepayParams.repayAmount,
            amountM: compRepayParams.amountInMaximum,
            single: compRepayParams.single,
            recipient: address(this),
            path: compRepayParams.path
        });

        uint256 amountIn = swap(swapParams, true);
        console.log("amountIn: ", amountIn);

        _safeApprove(Short, address(POOL), compRepayParams.repayAmount);

        return IERC20(Long).transfer(initiator, compRepayParams.amountInMaximum - amountIn);
    }

    // selector: 0x16d1fb86

    // // use transfer and send run out of gas!!!!!
    // // the Out-of-gas problem may be caused by sending eth between the contract and weth, and transfer eth to lido to wstcontract
    // // But i think that is a little useless
    // function _excuteLIDO(address weth, uint256 amount) internal returns (bool) {
    //     // submit eth to
    //     console.log(weth);
    //     console.log(amount);
    //     // console.logBytes4(bytes4(keccak256(bytes("withdraw(uint256)"))));
    //     uint256 balance = IWETH(weth).balanceOf(address(this));
    //     console.log(balance);
    //     IWETH(weth).withdraw(amount);
    //     console.log("withdraw");
    //     // uint256 stETH = ILido(LIDOADDRESS).submit{value:amount}(address(this));
    //     // use the shortcut wstETH supply to submit eth to lido;
    //     (bool sent, ) = WSTADDRESS.call{value: amount}("");
    //     require(sent, "send eth to wstEther fail");
    //     console.log("transfer done");
    //     uint256 wstETH = IWstETH(WSTADDRESS).balanceOf(address(this));
    //     console.log(wstETH);
    //     // approve pool to pull money form this to deposit
    //     IERC20(WSTADDRESS).approve(address(POOL), wstETH);
    //     POOL.supply(WSTADDRESS, wstETH, OWNER, 0);

    //     console.log("finish _excuteLIDO Op");
    //     return true;
    // }

    function leverageAAVEPos(
        address asset,
        uint256 amount,
        address user,
        uint16 refer
    ) internal returns (bool) {
        // approve pool to pull money form this to deposit
        IERC20(asset).approve(address(POOL), amount);
        POOL.supply(asset, amount, user, refer);
        return true;
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

        console.log("tokenIn:", tokenIn);
        console.log("tokenOut:", tokenOut);
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

        console.log("tokenIn:", tokenIn);
        console.log("tokenOut:", tokenOut);
        _safeApprove(tokenIn, address(SWAP_ROUTER), amountInMaximum);
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        console.log("balance: ", balance);
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

    receive() external payable {}
}
