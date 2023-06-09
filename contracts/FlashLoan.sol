// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

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
import "./libraries/SwapLogic.sol";

import "hardhat/console.sol";

contract FlashLoan {
    using Path for bytes;

    struct AaveOperationParams {
        bool single;
        uint256 amountOutMinimum;
        bytes path;
    }

    struct CompOperationParams {
        bool single;
        uint256 amountIn;
        uint256 amountOutMinimum;
        bytes path;
    }

    struct ApprovePermitParams {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
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

    struct CompRepayParams {
        bool single;
        uint256 amountInMaximum;
        uint256 repayAmount;
        bytes path;
    }

    struct AaveChangeParams {
        bool single;
        uint8 v;
        uint256 amountIn;
        uint256 repayAmount;
        uint256 deadline;
        bytes32 r;
        bytes32 s;
        bytes path;
    }

    struct CompChangeParams {
        bool single;
        uint256 amountIn;
        uint256 repayAmount;
        bytes path;
    }

    IPoolAddressesProvider public ADDRESSES_PROVIDER;
    IPoolDataProvider public POOL_DATA_PROVIDER;
    IPool public POOL;
    IComet public COMET;
    address public SWAP_ROUTER;

    // bytes32 public constant LIDOMODE = "0";
    // address public LIDOADDRESS = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    // address payable public constant WSTADDRESS =
    //     payable(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);
    address public USDC;

    bool private _initialized;

    function initialize(
        address provider,
        address comet,
        address swapRouter,
        address usdc
    ) external {
        require(!_initialized, Errors.IS_INITIALIZED);
        _initialized = true;

        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        POOL_DATA_PROVIDER = IPoolDataProvider(
            ADDRESSES_PROVIDER.getPoolDataProvider()
        );

        // address comet = 0xc3d688B66703497DAA19211EEdff47f25384cdc3;
        COMET = IComet(comet);
        SWAP_ROUTER = swapRouter;
        // address usdc = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
        USDC = usdc;
    }

    // selector: 0x80ddec56
    function AaveOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        console.log("initiator: ", initiator);
        initiator = tx.origin;

        (uint256 totalCollateralBase, uint256 totalDebtBase, , , , ) = POOL
            .getUserAccountData(initiator);
        console.log("totalCollateralBase: ", totalCollateralBase);
        console.log("totalDebtBase: ", totalDebtBase);

        // params: single+amountOutMinimum+path, bool+uint256+bytes
        AaveOperationParams memory aaveOperationParams = AaveOperationParams({
            single: params.toBool(0),
            amountOutMinimum: params.toUint256(1),
            path: params[33:params.length - 4] // remove selector
        });

        (, address Long, ) = aaveOperationParams.path.decodeLastPool();

        SwapLogic.SwapParams memory swapParams = SwapLogic.SwapParams({
            amount: amounts[0],
            amountM: aaveOperationParams.amountOutMinimum,
            single: aaveOperationParams.single,
            recipient: address(this),
            path: aaveOperationParams.path
        });

        console.log("begin to swap");

        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);
        console.log("amountOut: ", amountOut);

        console.log("end to swap");
        return leverageAAVEPos(Long, amountOut, initiator, 0);
    }

    // selector: 16d1fb86
    function CompOperation(
        address Long,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        initiator = tx.origin;
        // params: single+amountIn+path, bool+uint256+bytes+bytes4
        CompOperationParams memory compOperationParams = CompOperationParams({
            single: params.toBool(0),
            amountIn: params.toUint256(1),
            amountOutMinimum: amount + premiums,
            path: params[33:params.length - 4] // remove selector
        });

        IERC20(Long).approve(address(COMET), amount);
        COMET.supplyTo(initiator, Long, amount);

        COMET.withdrawFrom(
            initiator,
            address(this),
            USDC,
            compOperationParams.amountIn
        );

        IERC20(USDC).balanceOf(address(this));

        SwapLogic.SwapParams memory swapParams = SwapLogic.SwapParams({
            amount: compOperationParams.amountIn,
            amountM: compOperationParams.amountOutMinimum,
            single: compOperationParams.single,
            recipient: address(this),
            path: compOperationParams.path
        });
        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);

        IERC20(Long).approve(
            address(COMET),
            amountOut - compOperationParams.amountOutMinimum
        );
        COMET.supplyTo(
            initiator,
            Long,
            amountOut - compOperationParams.amountOutMinimum
        );

        return
            IERC20(Long).approve(
                address(POOL),
                compOperationParams.amountOutMinimum
            );
    }

    // selector: 0xd8ad4ac2
    function AaveRepayOperation(
        address Short,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        initiator = tx.origin;
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

        SwapLogic.SwapParams memory swapParams = SwapLogic.SwapParams({
            amount: amount + premiums,
            amountM: aaveRepayParams.amountInMaximum,
            single: aaveRepayParams.single,
            recipient: address(this),
            path: aaveRepayParams.path
        });

        uint256 amountIn = SwapLogic.swap(swapParams, true, SWAP_ROUTER);
        console.log("amountIn: ", amountIn);

        console.log("amountInMaximum: ", aaveRepayParams.amountInMaximum);
        _safeApprove(Short, address(POOL), aaveRepayParams.repayAmount);

        return
            IERC20(Long).transfer(
                initiator,
                aaveRepayParams.amountInMaximum - amountIn
            );
    }

    // selector: 0xeedcb9b9
    function CompRepayOperation(
        address Short,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        initiator = tx.origin;
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
        // console.log("Long:", Long);
        // console.log("amountInMaximum:", compRepayParams.amountInMaximum);

        IERC20(Short).approve(address(COMET), amount);

        COMET.supplyTo(initiator, Short, amount);

        COMET.withdrawFrom(
            initiator,
            address(this),
            Long,
            compRepayParams.amountInMaximum
        );

        SwapLogic.SwapParams memory swapParams = SwapLogic.SwapParams({
            amount: compRepayParams.repayAmount,
            amountM: compRepayParams.amountInMaximum,
            single: compRepayParams.single,
            recipient: address(this),
            path: compRepayParams.path
        });

        uint256 amountIn = SwapLogic.swap(swapParams, true, SWAP_ROUTER);
        // console.log("amountIn: ", amountIn);

        _safeApprove(Short, address(POOL), compRepayParams.repayAmount);

        return
            IERC20(Long).transfer(
                initiator,
                compRepayParams.amountInMaximum - amountIn
            );
    }

    // selector: 0xc85a890a
    function changeDepositAave(
        address asset,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        initiator = tx.origin;

        leverageAAVEPos(asset, amount, initiator, 0);

        // params: single+amountIn+deadline+v+r+s+path+selector,
        // bool+uint256+uint256+uint8+bytes32+bytes32+bytes+bytes4
        AaveChangeParams memory aaveChangeParams = AaveChangeParams({
            single: params.toBool(0),
            v: params.toUint8(65),
            amountIn: params.toUint256(1),
            repayAmount: amount + premiums,
            deadline: params.toUint256(33),
            r: bytes32(params[66:98]),
            s: bytes32(params[98:130]),
            path: params[130:params.length - 4] // remove selector
        });

        (address fromToken, , ) = aaveChangeParams.path.decodeFirstPool();

        (address aToken, , ) = POOL_DATA_PROVIDER.getReserveTokensAddresses(
            fromToken
        );

        console.log("aToken: ", aToken);
        IAToken(aToken).permit(
            initiator,
            address(this),
            aaveChangeParams.amountIn,
            aaveChangeParams.deadline,
            aaveChangeParams.v,
            aaveChangeParams.r,
            aaveChangeParams.s
        );

        IAToken(aToken).transferFrom(
            initiator,
            address(this),
            aaveChangeParams.amountIn
        );

        uint256 withdrawAmount = POOL.withdraw(
            fromToken,
            aaveChangeParams.amountIn,
            address(this)
        );
        console.log("withdrawAmount ", withdrawAmount);
        console.log("repayAmount: ", aaveChangeParams.repayAmount);

        SwapLogic.SwapParams memory swapParams = SwapLogic.SwapParams({
            amount: aaveChangeParams.amountIn,
            amountM: aaveChangeParams.repayAmount,
            single: aaveChangeParams.single,
            recipient: address(this),
            path: aaveChangeParams.path
        });

        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);

        leverageAAVEPos(
            asset,
            amountOut - aaveChangeParams.repayAmount,
            initiator,
            0
        );

        _safeApprove(asset, address(POOL), aaveChangeParams.repayAmount);

        return true;
    }

    // selector: 0x4cc63017
    function changeDepositComp(
        address asset,
        uint256 amount,
        uint256 premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        initiator = tx.origin;

        // params: single+amountIn+path+selector,
        // bool+uint256+bytes+bytes4
        CompChangeParams memory compChangeParams = CompChangeParams({
            single: params.toBool(0),
            amountIn: params.toUint256(1),
            repayAmount: amount + premiums,
            path: params[33:params.length - 4] // remove selector
        });

        (address fromToken, , ) = compChangeParams.path.decodeFirstPool();
        console.log("amountIn:", compChangeParams.amountIn);

        IERC20(asset).approve(address(COMET), amount);
        COMET.supplyTo(initiator, asset, amount);

        COMET.withdrawFrom(
            initiator,
            address(this),
            fromToken,
            compChangeParams.amountIn
        );

        SwapLogic.SwapParams memory swapParams = SwapLogic.SwapParams({
            amount: compChangeParams.amountIn,
            amountM: compChangeParams.repayAmount,
            single: compChangeParams.single,
            recipient: address(this),
            path: compChangeParams.path
        });

        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);
        console.log("amountOut: ", amountOut);

        _safeApprove(asset, address(POOL), compChangeParams.repayAmount);
        _safeApprove(
            asset,
            address(COMET),
            amountOut - compChangeParams.repayAmount
        );
        COMET.supplyTo(
            initiator,
            asset,
            amountOut - compChangeParams.repayAmount
        );

        return true;
    }

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
        (uint256 totalCollateralBase, uint256 totalDebtBase, , , , ) = POOL
            .getUserAccountData(user);
        console.log("totalCollateralBase: ", totalCollateralBase);
        console.log("totalDebtBase: ", totalDebtBase);

        return true;
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
