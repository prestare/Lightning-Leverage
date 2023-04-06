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