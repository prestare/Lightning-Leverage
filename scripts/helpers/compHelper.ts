import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber, Contract, Signer, ethers } from 'ethers';
import { 
    WETHAddress,
    bulker_ADDRESS,
    cUSDC_comet_ADDRESS,
} from '../address';
import {adoptTokenDicimals, calcNeedBorrowAmount, calcNeedBorrowValue, calcUserAssetValue, getMaxLeverage} from "./leverage";
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

export const supplyWETH =async (signer: SignerWithAddress, accountAddress: string, amount: BigNumber) => {
    const abiCoder = new ethers.utils.AbiCoder;
    // 2 mean supply eth 
    const action = [abiCoder.encode(["uint"], [2]), ];
    // console.log(action);
    const data: string[] = [abiCoder.encode(["address", "address", "uint"], [cUSDC_comet_ADDRESS, accountAddress, amount]),];
    // console.log(data);
    const tx = await BULKER.connect(signer).invoke(action, data, {value: amount});
    let tx_receipt = await tx.wait();
    // console.log(tx_receipt);
}

export const depositToComp = async (signer: SignerWithAddress, accountAddress: string, assetAddress: string, amount: BigNumber, isETH: boolean) => {
    let userCollateralBalance = await getUserCollateralBalance(signer.address, assetAddress);
    console.log(`Before deposit, user collateral balance is: ${userCollateralBalance.toString()}`);

    if (assetAddress == WETHAddress && isETH) {
        await supplyWETH(signer, accountAddress, amount);
    } else {
        await COMET.supplyTo(accountAddress, assetAddress, amount);
    }

    userCollateralBalance = await getUserCollateralBalance(signer.address, assetAddress);
    console.log(`After deposit, user collateral balance is: ${userCollateralBalance.toString()}`);
}

export const getUserCollateralBalance = async (userAddress: string, assetAddress: string) => {
    return (await COMET.collateralBalanceOf(userAddress, assetAddress));
}

export const getAssetPriceOnComp =async (assetAddress: string) => {
    let priceFeed = await getAssetPriceFeed(assetAddress);
    return (await COMET.callStatic.getPrice(priceFeed));
}

export const getMaxLeverageOnComp =async (signer: SignerWithAddress, accountAddress: string, assetAddress: string) => {
    const assetPrice = await getAssetPriceOnComp(assetAddress);
    const userCollateralBalance = await getUserCollateralBalance(accountAddress, assetAddress);
    const assetDecimal = 18;
    const assetValue = await calcUserAssetValue(userCollateralBalance, assetPrice, assetDecimal);

    const assetLTV = BigInt(await getAssetCF(assetAddress));
    // MAX Leverage = 1 / (1 - LTV)
    const maxleverage = await getMaxLeverage(assetLTV);
    const maxBorrowCap = assetValue.mul(maxleverage);

    console.log("       The Maximum leverage abilidity = ", maxleverage.toString());
    return {assetValue, maxleverage, maxBorrowCap};
}

export const calcUserLeverFlashLoanComp = async (signer: Signer, assetAddress: string, accountAddress:string, leverage: number) => {
    const assetPrice = await getAssetPriceOnComp(assetAddress);
    const userCollateralBalance = await getUserCollateralBalance(accountAddress, assetAddress);
    const assetDecimal = 18;
    const assetValue = await calcUserAssetValue(userCollateralBalance, assetPrice, assetDecimal);

    let needBorrowAmountUSD = calcNeedBorrowValue(assetValue, leverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needBorrowAmountUSD, 8).toString());
    let needBorrowAmount = calcNeedBorrowAmount(needBorrowAmountUSD, assetPrice);
    console.log("       so user need to borrow short asset Amount = %d", ethers.utils.formatUnits(needBorrowAmount, 8).toString());
    let flashLoanAmount = adoptTokenDicimals(needBorrowAmount, 8, assetDecimal);
    console.log("       so flash loan Amount = %s", flashLoanAmount.toString());

    return {
        flashLoanAmount,
    }
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