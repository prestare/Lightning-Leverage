import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, Signer, ethers } from 'ethers';
import { 
    bulker_ADDRESS,
    cUSDC_comet_ADDRESS,
} from '../address';
import {getMaxLeverage} from "./leverage";
export var BULKER: Contract;
export var COMET: Contract;
import {hre} from "../constant";
import { getAssetCF, getAssetPriceFeed } from "./compConfigHelper";

export const initCompContract = async (signer: Signer) => {
    let bulkerABI = await (await hre.artifacts.readArtifact("IBulker")).abi;
    BULKER = new ethers.Contract(bulker_ADDRESS, bulkerABI, signer);
    let cometABI = await (await hre.artifacts.readArtifact("IComet")).abi;
    COMET = new ethers.Contract(cUSDC_comet_ADDRESS, cometABI, signer);
}

export const supplyWETH =async (user: SignerWithAddress, amount: BigNumber) => {
    const abiCoder = new ethers.utils.AbiCoder;
    // 2 mean supply eth 
    const action = [abiCoder.encode(["uint"], [2]), ];
    // console.log(action);
    const data: string[] = [abiCoder.encode(["address", "address", "uint"], [cUSDC_comet_ADDRESS, user.address, amount]),];
    // console.log(data);
    const tx = await BULKER.connect(user).invoke(action, data, {value: amount});
    let tx_receipt = await tx.wait();
    // console.log(tx_receipt);
}

export const getUserCollateralBalance = async (userAddress: string, assetAddress: string) => {
    return (await COMET.collateralBalanceOf(userAddress, assetAddress));
}

export const getAssetPriceOnComp =async (assetAddress: string) => {
    let priceFeed = await getAssetPriceFeed(assetAddress);
    return (await COMET.callStatic.getPrice(priceFeed));
}

export const getMaxLeverageOnComp =async (asset: string, TokenName: string) => {
    let assetLTV = BigInt(await getAssetCF(asset));
    // MAX Leverage = 1 / (1 - LTV)
    let maxleverage = await getMaxLeverage(assetLTV);
    console.log("   According to the Comp %s Asset Configuration:", TokenName);
    console.log("       The Maximum leverage abilidity = ", maxleverage.toString());
    return maxleverage;
}

export const allowFlashLoanContract = async (signer: SignerWithAddress, flashLoanAddress: string) => {
    const tx2 = await COMET.connect(signer).allow(flashLoanAddress, true);
    let tx_receipt = await tx2.wait();
    // let allowance = await COMET.connect(signer).allowance(signer.address, flashLoanAddress);
    // console.log("allowance is: ", allowance);
}

export const getUserBorrowCapacityBase = async (account: string) => {
    const numAssets = await COMET.callStatic.numAssets();

    const promisesAssets = [];
    for (let i = 0; i < numAssets; i++) {
      promisesAssets.push(COMET.callStatic.getAssetInfo(i));
    }

    const infos = await Promise.all(promisesAssets);
    
    const promisesCollaterals = [];
    const promisesPrices = [];
    for (let i = 0; i < numAssets; i++) {
      const { asset, priceFeed } = infos[i];
      promisesCollaterals.push(COMET.callStatic.collateralBalanceOf(account, asset));
      promisesPrices.push(COMET.callStatic.getPrice(priceFeed));
    }

    const collateralBalances = await Promise.all(promisesCollaterals);
    const collateralPrices = await Promise.all(promisesPrices);

    const baseTokenPriceFeed = await COMET.callStatic.baseTokenPriceFeed();
    const basePrice = +(await COMET.callStatic.getPrice(baseTokenPriceFeed)).toString() / 1e8;
    const baseDecimals = +(await COMET.callStatic.decimals()).toString();

    let collateralValueUsd = 0;
    let totalBorrowCapacityUsd = 0;
    for (let i = 0; i < numAssets; i++) {
      const balance = +(collateralBalances[i].toString()) / +(infos[i].scale).toString();
      const price = +collateralPrices[i].toString() / 1e8;
      collateralValueUsd += balance * price;
      totalBorrowCapacityUsd += balance * price * (+infos[i].borrowCollateralFactor.toString() / 1e18);
    }

    const borrowBalance = +(await COMET.callStatic.borrowBalanceOf(account)).toString();
    const borrowedInUsd = borrowBalance / Math.pow(10, baseDecimals) * basePrice;

    const borrowCapacityUsd = totalBorrowCapacityUsd - borrowedInUsd;

    const borrowCapacityBase = borrowCapacityUsd / basePrice;
    
    return BigNumber.from(Math.floor(borrowCapacityBase * Math.pow(10, baseDecimals)));
}