// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IComet} from "./interfaces/COMP/IComet.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libraries/Path.sol";
import "./libraries/SwapLogic.sol";

contract FlashLoanGateWay {
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
    address public SWAP_ROUTER;

    constructor(address provider, address swapRouter, address comet) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        SWAP_ROUTER = swapRouter;
        COMET = IComet(comet);
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
        IERC20(depositParams.asset).approve(
            address(POOL),
            depositParams.amount
        );
        POOL.supply(depositParams.asset, depositParams.amount, msg.sender, 0);
    }

    /**
     * @dev Swaps `amount` of `from` asset on Uniswap into `to` asset and supply it on Aave.
     */
    function swapAndDepositToAave(
        SwapLogic.SwapParams memory swapParams
    ) public {
        (, address to, ) = swapParams.path.decodeLastPool();
        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);

        IERC20(to).approve(address(POOL), amountOut);
        POOL.supply(to, amountOut, msg.sender, 0);
    }

    function depositToComp(DepositParams calldata depositParams) public {
        IERC20(depositParams.asset).approve(
            address(COMET),
            depositParams.amount
        );
        COMET.supplyTo(msg.sender, depositParams.asset, depositParams.amount);
    }

    /**
     * @dev Swaps `amount` of `from` asset on Uniswap into `to` asset and supply it on Comp
     */
    function swapAndDepositToComp(
        SwapLogic.SwapParams memory swapParams
    ) public {
        (, address to, ) = swapParams.path.decodeLastPool();
        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);

        IERC20(to).approve(address(COMET), amountOut);
        COMET.supplyTo(msg.sender, to, amountOut);
    }
}
