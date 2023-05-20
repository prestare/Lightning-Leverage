// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IWETHGateway} from "./interfaces/AAVE/IWETHGateway.sol";
import {IComet} from "./interfaces/COMP/IComet.sol";
import {IBulker} from "./interfaces/COMP/IBulker.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libraries/Path.sol";
import "./libraries/SwapLogic.sol";

import "hardhat/console.sol";

contract FlashLoanGateway {
    using Path for bytes;

    struct DepositParams {
        address asset;
        uint256 amount;
    }

    struct FlashLoanSimpleParams {
        address receiverAddress;
        address asset;
        uint256 amount;
        bytes params;
        uint16 referralCode;
    }

    struct FlashLoanParams {
        address receiverAddress;
        address[] assets;
        uint256[] amounts;
        uint256[] interestRateModes;
        address onBehalfOf;
        bytes params;
        uint16 referralCode;
    }

    IPoolAddressesProvider public ADDRESSES_PROVIDER;
    IPool public POOL;
    IComet public COMET;
    IWETHGateway public WETH_GATEWAY;
    IBulker public BULKER;
    address public SWAP_ROUTER;

    constructor(
        IPoolAddressesProvider provider,
        address swapRouter,
        IComet comet,
        IWETHGateway wethGateway,
        IBulker bulker
    ) {
        ADDRESSES_PROVIDER = provider;
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        COMET = comet;
        WETH_GATEWAY = wethGateway;
        BULKER = bulker;
        SWAP_ROUTER = swapRouter;
    }

    function depositAaveAndFlashLoanSimple(
        DepositParams calldata depositParams,
        FlashLoanSimpleParams calldata flashLoanSimpleParams
    ) external {
        depositToAave(depositParams);
        POOL.flashLoanSimple(
            flashLoanSimpleParams.receiverAddress,
            flashLoanSimpleParams.asset,
            flashLoanSimpleParams.amount,
            flashLoanSimpleParams.params,
            flashLoanSimpleParams.referralCode
        );
    }

    function depositETHAaveAndFlashLoanSimple(
        FlashLoanSimpleParams calldata flashLoanSimpleParams
    ) external payable {
        depositETHToAave();

        POOL.flashLoanSimple(
            flashLoanSimpleParams.receiverAddress,
            flashLoanSimpleParams.asset,
            flashLoanSimpleParams.amount,
            flashLoanSimpleParams.params,
            flashLoanSimpleParams.referralCode
        );
    }

    function swapDepositAaveAndFlashLoanSimple(
        SwapLogic.SwapParams memory swapParams,
        FlashLoanSimpleParams calldata flashLoanSimpleParams
    ) external {
        swapAndDepositToAave(swapParams);
        POOL.flashLoanSimple(
            flashLoanSimpleParams.receiverAddress,
            flashLoanSimpleParams.asset,
            flashLoanSimpleParams.amount,
            flashLoanSimpleParams.params,
            flashLoanSimpleParams.referralCode
        );
    }

    function depositCompAndFlashLoanSimple(
        DepositParams calldata depositParams,
        FlashLoanSimpleParams calldata flashLoanSimpleParams
    ) external {
        depositToComp(depositParams);

        POOL.flashLoanSimple(
            flashLoanSimpleParams.receiverAddress,
            flashLoanSimpleParams.asset,
            flashLoanSimpleParams.amount,
            flashLoanSimpleParams.params,
            flashLoanSimpleParams.referralCode
        );
    }

    function depositETHCompAndFlashLoanSimple(
        FlashLoanSimpleParams calldata flashLoanSimpleParams
    ) external payable {
        depositETHToComp();
        console.log("receiverAddress: ", flashLoanSimpleParams.receiverAddress);
        console.log("asset: ", flashLoanSimpleParams.asset);
        console.log("amount: ", flashLoanSimpleParams.amount);
        console.logBytes(flashLoanSimpleParams.params);
        POOL.flashLoanSimple(
            flashLoanSimpleParams.receiverAddress,
            flashLoanSimpleParams.asset,
            flashLoanSimpleParams.amount,
            flashLoanSimpleParams.params,
            flashLoanSimpleParams.referralCode
        );
    }

    function swapDepositCompAndFlashLoanSimple(
        SwapLogic.SwapParams memory swapParams,
        FlashLoanSimpleParams calldata flashLoanSimpleParams
    ) external {
        swapAndDepositToComp(swapParams);
        POOL.flashLoanSimple(
            flashLoanSimpleParams.receiverAddress,
            flashLoanSimpleParams.asset,
            flashLoanSimpleParams.amount,
            flashLoanSimpleParams.params,
            flashLoanSimpleParams.referralCode
        );
    }

    function depositAaveAndFlashLoan(
        DepositParams calldata depositParams,
        FlashLoanParams calldata flashLoanParams
    ) external {
        depositToAave(depositParams);
        POOL.flashLoan(
            flashLoanParams.receiverAddress,
            flashLoanParams.assets,
            flashLoanParams.amounts,
            flashLoanParams.interestRateModes,
            flashLoanParams.onBehalfOf,
            flashLoanParams.params,
            flashLoanParams.referralCode
        );
    }

    function depositETHAaveAndFlashLoan(
        FlashLoanParams calldata flashLoanParams
    ) external payable {
        console.logBytes(flashLoanParams.params);

        depositETHToAave();
        console.log("begin flashLoan");
        POOL.flashLoan(
            flashLoanParams.receiverAddress,
            flashLoanParams.assets,
            flashLoanParams.amounts,
            flashLoanParams.interestRateModes,
            flashLoanParams.onBehalfOf,
            flashLoanParams.params,
            flashLoanParams.referralCode
        );
        console.log("end flashloan");
    }

    function swapDepositAaveAndFlashLoan(
        SwapLogic.SwapParams memory swapParams,
        FlashLoanParams calldata flashLoanParams
    ) external {
        swapAndDepositToAave(swapParams);
        POOL.flashLoan(
            flashLoanParams.receiverAddress,
            flashLoanParams.assets,
            flashLoanParams.amounts,
            flashLoanParams.interestRateModes,
            flashLoanParams.onBehalfOf,
            flashLoanParams.params,
            flashLoanParams.referralCode
        );
    }

    function depositCompAndFlashLoan(
        DepositParams calldata depositParams,
        FlashLoanParams calldata flashLoanParams
    ) external {
        depositToComp(depositParams);
        POOL.flashLoan(
            flashLoanParams.receiverAddress,
            flashLoanParams.assets,
            flashLoanParams.amounts,
            flashLoanParams.interestRateModes,
            flashLoanParams.onBehalfOf,
            flashLoanParams.params,
            flashLoanParams.referralCode
        );
    }

    function depositETHCompAndFlashLoan(
        FlashLoanParams calldata flashLoanParams
    ) external payable {
        depositETHToComp();
        POOL.flashLoan(
            flashLoanParams.receiverAddress,
            flashLoanParams.assets,
            flashLoanParams.amounts,
            flashLoanParams.interestRateModes,
            flashLoanParams.onBehalfOf,
            flashLoanParams.params,
            flashLoanParams.referralCode
        );
    }

    function swapDepositCompAndFlashLoan(
        SwapLogic.SwapParams memory swapParams,
        FlashLoanParams calldata flashLoanParams
    ) external {
        swapAndDepositToComp(swapParams);
        POOL.flashLoan(
            flashLoanParams.receiverAddress,
            flashLoanParams.assets,
            flashLoanParams.amounts,
            flashLoanParams.interestRateModes,
            flashLoanParams.onBehalfOf,
            flashLoanParams.params,
            flashLoanParams.referralCode
        );
    }

    function depositToAave(DepositParams calldata depositParams) public {
        IERC20(depositParams.asset).transferFrom(
            msg.sender,
            address(this),
            depositParams.amount
        );
        IERC20(depositParams.asset).approve(
            address(POOL),
            depositParams.amount
        );
        POOL.supply(depositParams.asset, depositParams.amount, msg.sender, 0);
    }

    function depositETHToAave() public payable {
        console.log("begin depositETHToAave");
        WETH_GATEWAY.depositETH{value: msg.value}(address(0), msg.sender, 0);
        console.log("end depositETHToAave");
    }

    /**
     * @dev Swaps `amount` of `from` asset on Uniswap into `to` asset and supply it on Aave.
     */
    function swapAndDepositToAave(
        SwapLogic.SwapParams memory swapParams
    ) public {
        console.log("begin swap");
        (address from, , ) = swapParams.path.decodeFirstPool();
        (, address to, ) = swapParams.path.decodeLastPool();
        console.log("to: ", to);

        IERC20(from).transferFrom(msg.sender, address(this), swapParams.amount);
        IERC20(from).approve(address(SWAP_ROUTER), swapParams.amount);
        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);
        console.log("end swap");
        IERC20(to).approve(address(POOL), amountOut);
        POOL.supply(to, amountOut, msg.sender, 0);
    }

    function depositToComp(DepositParams calldata depositParams) public {
        console.log("begin depositToComp");
        IERC20(depositParams.asset).transferFrom(
            msg.sender,
            address(this),
            depositParams.amount
        );
        IERC20(depositParams.asset).approve(
            address(COMET),
            depositParams.amount
        );
        COMET.supplyTo(msg.sender, depositParams.asset, depositParams.amount);
        console.log("end depositToComp");
    }

    function depositETHToComp() public payable {
        console.log("begin depositETHToComp");
        bytes[] memory supplyAssetCalldatas = new bytes[](1);
        supplyAssetCalldatas[0] = abi.encode(
            address(COMET),
            msg.sender,
            msg.value
        );
        uint256[] memory actions = new uint256[](1);
        actions[0] = 2;
        BULKER.invoke{value: msg.value}(actions, supplyAssetCalldatas);
        console.log("end depositETHToComp");
    }

    /**
     * @dev Swaps `amount` of `from` asset on Uniswap into `to` asset and supply it on Comp
     */
    function swapAndDepositToComp(
        SwapLogic.SwapParams memory swapParams
    ) public {
        (address from, , ) = swapParams.path.decodeFirstPool();
        (, address to, ) = swapParams.path.decodeLastPool();
        IERC20(from).transferFrom(msg.sender, address(this), swapParams.amount);
        IERC20(from).approve(address(SWAP_ROUTER), swapParams.amount);
        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);

        IERC20(to).approve(address(COMET), amountOut);
        COMET.supplyTo(msg.sender, to, amountOut);
    }
}
