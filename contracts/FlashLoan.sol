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
import './libraries/Path.sol';

import "hardhat/console.sol";

contract FlashLoan is IFlashLoanSimpleReceiver {
    using Path for bytes;

    struct BaseSwapParams {
        bytes path;
        bool single;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    struct SwapParams {
        BaseSwapParams base;
        address recipient;
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

    /**
     * @dev call Aave flashLoanSimple func
     * @param receiverAddress The address of the contract receiving the funds, implementing IFlashLoanSimpleReceiver interface
     * @param assets The address of the asset being flash-borrowed
     * @param amounts The amount of the asset being flash-borrowed
     * @param interestRateModes The ir modes for each asset
     * @param params describe in IPool flashLoanSimple
     * @param referralCode describe in IPool flashLoanSimple
     */
    function callAAVEFlashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] memory amounts,
        uint256[] memory interestRateModes,
        bytes memory params,
        uint16 referralCode
    ) external returns (bool) {
        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        // console.log("balance is: ", balance);
        // if we keep params in a map, Will the transaction consume less gas?
        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            interestRateModes,
            OWNER,
            params,
            referralCode
        );

        return true;
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
            calldatacopy(0, params.offset, params.length)
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                implematation,
                0,
                params.length,
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

        assembly {
            calldatacopy(0, params.offset, params.length)
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                implematation,
                0,
                params.length,
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

    // selector: 0x8ecfaae0
    function AaveOperation(
        BaseSwapParams calldata baseSwapParams
    ) public returns (bool) {
        (, address Long, ) = baseSwapParams.path.decodeLastPool();

        SwapParams memory swapParams = SwapParams({
            base: baseSwapParams,
            recipient: address(this)
        });

        uint256 amountOut = swap(swapParams);
        return leverageAAVEPos(Long, amountOut, OWNER, 0);
    }

    // selector: 0x8fd8f362
    function AaveRepayOperation(
        BaseSwapParams calldata base,
        uint256 flashAmount,
        uint256 interestRateMode,
        ApprovePermitParams calldata permitParams
    ) public returns (bool) {
        (address Long, , ) = base.path.decodeFirstPool();
        (, address Short, ) = base.path.decodeLastPool();
        IERC20(Short).approve(address(POOL), flashAmount);
        uint256 repayAmount = POOL.repay(
            Short,
            flashAmount,
            interestRateMode,
            tx.origin
        );
        console.log("repayAmount ", repayAmount);

        (address aToken, , ) = POOL_DATA_PROVIDER.getReserveTokensAddresses(
            Long
        );

        console.log("aToken: ", aToken);
        IAToken(aToken).permit(
            tx.origin,
            address(this),
            base.amountIn,
            permitParams.deadline,
            permitParams.v,
            permitParams.r,
            permitParams.s
        );
        IAToken(aToken).transferFrom(tx.origin, address(this), base.amountIn);

        uint256 withdrawAmount = POOL.withdraw(
            Long,
            base.amountIn,
            address(this)
        );
        console.log("withdrawAmount ", withdrawAmount);

        SwapParams memory swapParams = SwapParams({
            base: base,
            recipient: address(this)
        });

        uint256 amountOut = swap(swapParams);
        console.log("amountOut: ", amountOut);

        console.log("amountOutMinimum: ", base.amountOutMinimum);
        bool success = IERC20(Short).approve(address(POOL), amountOut);
        require(success, "failed to approve");
        return
            IERC20(Short).transfer(
                tx.origin,
                amountOut - base.amountOutMinimum
            );
    }

    // selector: 0x6afc18e3
    function CompRepayOperation(
        BaseSwapParams calldata base,
        uint256 flashAmount
    ) public returns (bool) {
        (address Long, , ) = base.path.decodeFirstPool();
        (, address Short, ) = base.path.decodeLastPool();
        IERC20(Short).approve(address(COMET), flashAmount);

        uint256 balance = IERC20(Short).balanceOf(address(this));
        console.log("balance", balance);
        uint256 borrowBalanceOf = COMET.borrowBalanceOf(tx.origin);
        console.log("borrowBalanceOf1", borrowBalanceOf);

        COMET.supplyTo(tx.origin, Short, flashAmount);
        borrowBalanceOf = COMET.borrowBalanceOf(tx.origin);
        console.log("borrowBalanceOf", borrowBalanceOf);
        console.log("tx.origin: ", tx.origin);

        COMET.withdrawFrom(tx.origin, address(this), Long, base.amountIn);

        SwapParams memory swapParams = SwapParams({
            base: base,
            recipient: address(this)
        });

        uint256 amountOut = swap(swapParams);
        console.log("amountOut: ", amountOut);

        bool success = IERC20(Short).approve(
            address(POOL),
            base.amountOutMinimum
        );
        require(success, "failed to approve");
        return
            IERC20(Short).transfer(
                tx.origin,
                amountOut - base.amountOutMinimum
            );
    }

    // selector: 0xfe235f79
    function CompOperation(
        BaseSwapParams calldata base,
        uint256 flashAmount
    ) public returns (bool) {
        address initiator = tx.origin;
        (, address Long, ) = base.path.decodeLastPool();

        IERC20(Long).approve(address(COMET), flashAmount);
        COMET.supplyTo(initiator, Long, flashAmount);
        COMET.collateralBalanceOf(initiator, Long);
        COMET.withdrawFrom(initiator, address(this), USDC, base.amountIn);
        IERC20(USDC).balanceOf(address(this));

        SwapParams memory swapParams = SwapParams({
            base: base,
            recipient: address(this)
        });
        swap(swapParams);

        return IERC20(Long).approve(address(POOL), base.amountOutMinimum);
    }

    // use transfer and send run out of gas!!!!!
    // the Out-of-gas problem may be caused by sending eth between the contract and weth, and transfer eth to lido to wstcontract
    // But i think that is a little useless
    function _excuteLIDO(address weth, uint256 amount) internal returns (bool) {
        // submit eth to
        console.log(weth);
        console.log(amount);
        // console.logBytes4(bytes4(keccak256(bytes("withdraw(uint256)"))));
        uint256 balance = IWETH(weth).balanceOf(address(this));
        console.log(balance);
        IWETH(weth).withdraw(amount);
        console.log("withdraw");
        // uint256 stETH = ILido(LIDOADDRESS).submit{value:amount}(address(this));
        // use the shortcut wstETH supply to submit eth to lido;
        (bool sent, ) = WSTADDRESS.call{value: amount}("");
        require(sent, "send eth to wstEther fail");
        console.log("transfer done");
        uint256 wstETH = IWstETH(WSTADDRESS).balanceOf(address(this));
        console.log(wstETH);
        // approve pool to pull money form this to deposit
        IERC20(WSTADDRESS).approve(address(POOL), wstETH);
        POOL.supply(WSTADDRESS, wstETH, OWNER, 0);

        console.log("finish _excuteLIDO Op");
        return true;
    }

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
        SwapParams memory swapParams
    ) public returns (uint256 amountOut) {
        if (swapParams.base.single) {
            amountOut = swapExactInputSingle(
                swapParams.base.path,
                swapParams.recipient,
                swapParams.base.amountIn,
                swapParams.base.amountOutMinimum
            );
        } else {
            amountOut = swapExactInput(
                swapParams.base.path,
                swapParams.recipient,
                swapParams.base.amountIn,
                swapParams.base.amountOutMinimum
            );
        }
    }

    function swapExactInputSingle(
        bytes memory path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) internal returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = path.decodeFirstPool();

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



    function _safeApprove(address token, address to, uint256 value) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, to, value)
        );
        require(
            success && (data.length == 0 || abi.decode(data, (bool))),
            "SA"
        );
    }

    receive() external payable {}
}
