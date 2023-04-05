// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import {IFlashLoanSimpleReceiver} from "./interfaces/AAVE/IFlashLoanSimpleReceiver.sol";
import {IPoolAddressesProvider} from "./interfaces/AAVE/IPoolAddressesProvider.sol";
import {IPool} from "./interfaces/AAVE/IPool.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import "hardhat/console.sol";

contract FlashLoanSimple is IFlashLoanSimpleReceiver{
    IPoolAddressesProvider public override ADDRESSES_PROVIDER;
    IPool public override POOL;
    address public OWNER;

    constructor(address provider, address owner) public {
        ADDRESSES_PROVIDER = IPoolAddressesProvider(provider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        OWNER = owner;
    }

    /**
     * @dev call Aave flashLoanSimple func
     * @param receiverAddress The address of the contract receiving the funds, implementing IFlashLoanSimpleReceiver interface
     * @param asset The address of the asset being flash-borrowed
     * @param amount The amount of the asset being flash-borrowed
     * @param params describe in IPool flashLoanSimple
     * @param referralCode describe in IPool flashLoanSimple
     */
    function callAAVEFlashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external returns (bool) {
        POOL.flashLoanSimple(
            address(this), 
            asset, 
            amount,
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
        // deposit the amount of asset to IPOOL
        uint256 approve = amount * 3;
        console.log(approve);
        IERC20(asset).approve(address(POOL), approve);
        // uint256 balance = IERC20(assets[0]).balanceOf(address(this));
        console.log("excuteOp balance is: ", IERC20(asset).balanceOf(address(this)));
        console.log("supply");
        console.log("asset is ",asset);
        console.log("amount is ", amount);
        console.log("premiums is ", premium);

        console.log("finish execute Op");
        return true;
    }

}