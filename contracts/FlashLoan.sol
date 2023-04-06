// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IFlashLoanReceiver} from "./interfaces/AAVE/IFlashLoanReceiver.sol";
import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {IWstETH} from "./interfaces/LIDO/IWstETH.sol";
import {ILido} from "./interfaces/LIDO/ILido.sol";
import {IComet} from "./interfaces/COMP/IComet.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import "hardhat/console.sol";

contract FlashLoan is IFlashLoanReceiver {
    struct SwapParams {
        bytes path;
        bool single;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    IPoolAddressesProvider public override ADDRESSES_PROVIDER;
    IComet public COMET;
    ISwapRouter public SWAP_ROUTER;

    IPool public override POOL;
    address public OWNER;

    bytes32 public constant LIDOMODE = "0";
    address public LIDOADDRESS = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address payable public WSTADDRESS =
        payable(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0);
    address public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// @dev The length of the bytes encoded address
    uint256 private constant ADDR_SIZE = 20;
    /// @dev The length of the bytes encoded fee
    uint256 private constant FEE_SIZE = 3;
    /// @dev The offset of a single token address and pool fee
    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;
    /// @dev The offset of an encoded pool key
    uint256 private constant POP_OFFSET = NEXT_OFFSET + ADDR_SIZE;
 
    constructor(address provider, address swapRouter, address owner) public {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        address comet = 0xc3d688B66703497DAA19211EEdff47f25384cdc3;
        COMET = IComet(comet);
        SWAP_ROUTER = ISwapRouter(swapRouter);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        OWNER = owner;
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

    // params: mode+single+expectAmountOut+path
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        // console.log(msg.sender);
        console.log("initiator is: ", initiator);
        // console.logBytes(abi.encodePacked(params));
        // console.logBytes(abi.encodePacked(LIDOMODE));
        // (address Long, uint16 slip, uint256 expectAmountOut) = abi.decode(params, (address, uint16, uint256));
        uint8 mode = uint8(bytes1(params[0:1]));
        bool single = toBool(params, 1);
        uint256 expectAmountOut = toUint256(params, 2);
        // console.log("mode is: ", mode);
        // console.log("single is: ", single);
        // console.log("expectAmountOut is: ", expectAmountOut);

        // In order to simplify, it check the value of mode to decide what platfrom user want to leverage
        // in the future, we use function selector todicide
        if (mode == 1) {
            bytes memory path = params[34:];
            (, address Long, ) = decodeLastPool(path);

            // console.log("AAVE");
            // console.log("long asset is ", Long);
            // console.log("short asset is ", assets[0]);
            console.log("flash loan amount is ", amounts[0]);
            // console.log("premiums is ", premiums[0]);

            SwapParams memory swapParams = SwapParams({
                path: path,
                single: single,
                recipient: address(this),
                amountIn: amounts[0],
                amountOutMinimum: expectAmountOut
            });

            uint256 amountOut = swap(swapParams);
            console.log("After swap amount is :", amountOut);
            // deposit the amount of asset to IPOOL
            // approve pool to pull money form this to deposit
            bool status = leverageAAVEPos(Long, amountOut, OWNER, 0);
        } else if (mode == 2) {
            console.log("Compound");
            console.log("long asset is ", assets[0]);
            console.log("flash loan amount is ", amounts[0]);
            console.log("premiums is ", premiums[0]);

            IERC20(assets[0]).approve(address(COMET), amounts[0]);
            COMET.supplyTo(initiator, assets[0], amounts[0]);
            console.log("");
            // uint256 balance =
            COMET.collateralBalanceOf(initiator, assets[0]);
            // console.log("After supply collateral balance is: ", balance);
            uint256 expectAmountIn = toUint256(params,34);
            console.log("expectAmountIn: ", expectAmountIn);
            COMET.withdrawFrom(initiator, address(this), USDC, expectAmountIn);
            // balance =
            IERC20(USDC).balanceOf(address(this));
            // console.log("After borrow usdc balance is: ", balance);
            console.logBytes(params[66:]);

            SwapParams memory swapParams = SwapParams({
                path: params[66:], // avoid stack too deep
                single: single,
                recipient: address(this),
                amountIn: expectAmountIn,
                amountOutMinimum: expectAmountOut
            });
            uint256 amountOut = swap(swapParams);
            console.log("After swap amount is :", amountOut);
        }

        // avoid stack too deep
        if (mode == 2) {
            IERC20(assets[0]).approve(address(POOL), amounts[0] + premiums[0]);
        }
        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        // console.log("excuteOp balance is: ", IERC20(assets[0]).balanceOf(address(this)));
        // console.log("supply");

        console.log("finish execute Op");
        return true;
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
        (address tokenIn, , ) = decodeFirstPool(path);

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

    function decodeLastPool(
        bytes memory path
    ) internal  returns (address tokenA, address tokenB, uint24 fee) {
        uint256 len = path.length;
        tokenA = toAddress(path, len - POP_OFFSET);
        fee = toUint24(path, len - NEXT_OFFSET);
        tokenB = toAddress(path, len - ADDR_SIZE);
    }

    /// @dev toAddress decodes bytes to address
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

    /// @dev toUint24 decodes bytes to uint24
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

    /// @dev toBool decodes bytes to bool
    function toBool(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (bool tempBool) {
        require(_start + 1 >= _start, "toBool_overflow");
        require(_bytes.length >= _start + 1, "toBool_outOfBounds");
        uint8 temp;

        assembly {
            temp := mload(add(add(_bytes, 0x1), _start))
        }

        if (temp == 1) {
            tempBool = true;
        }

        return tempBool;
    }

    /// @dev toUint256 decodes bytes to uint256
    function toUint256(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (uint256) {
        require(_start + 32 >= _start, "toUint256_overflow");
        require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
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

    receive() external payable {}
}
