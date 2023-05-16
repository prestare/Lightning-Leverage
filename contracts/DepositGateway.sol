// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "./libraries/Path.sol";
import "./libraries/SwapLogic.sol";

contract DepositGateWay {
    using Path for bytes;


    IPoolAddressesProvider public ADDRESSES_PROVIDER;
    IPool public POOL;
    address public SWAP_ROUTER;

    constructor(address provider, address swapRouter) {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        SWAP_ROUTER = swapRouter;
    }

    function depositToAave(address asset, uint256 amount) external {
        IERC20(asset).approve(address(POOL), amount);
        POOL.supply(asset, amount, msg.sender, 0);
    }

    /**
     * @dev Swaps `amount` of `from` asset on Uniswap into `to` asset and supply it on Aave.
     */
    function swapAndDepositToAave(SwapLogic.SwapParams memory swapParams) external {
        (, address to, ) = swapParams.path.decodeLastPool();
        uint256 amountOut = SwapLogic.swap(swapParams, false, SWAP_ROUTER);

        IERC20(to).approve(address(POOL), swapParams.amount);
        POOL.supply(to, amountOut, msg.sender, 0);
    }

}
