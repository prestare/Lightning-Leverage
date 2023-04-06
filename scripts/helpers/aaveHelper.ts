import { Contract, Signer, ethers, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    AAVE_POOL_ADDRESS,
    AAVE_Price_Oricle_Address,
    WETH_GATEWAY_ADDRESS,
    aWETHAddress
} from "../address";
import {
    aTokenAbi,
    debtTokenABI,
    WETHGateABI
  } from "../ABI";
import {hre} from "../constant";
import {getLtv} from "./aaveConfigHelper";
import {getMaxLeverage} from "./leverage";

export var AAVE_POOL: Contract;
export var WETH_GATEWAY: Contract;
export var AavePriceOricle: Contract;
// export var ;

export const initAAVEContract = async (signer: Signer) => {
    let poolAbi = await (await hre.artifacts.readArtifact("IPool")).abi;
    AAVE_POOL = new ethers.Contract(AAVE_POOL_ADDRESS, poolAbi, signer);
    WETH_GATEWAY = new ethers.Contract(WETH_GATEWAY_ADDRESS, WETHGateABI, signer);
}

export const aTokenContract = (aTokenAddress: string, signer: SignerWithAddress) => {
    return (new ethers.Contract(aWETHAddress, aTokenAbi, signer));
}

export const getAssetDebtTokenAddress = async (asset: string) => {
    return (await AAVE_POOL.getReserveData(asset)).variableDebtTokenAddress;
}

export const debtTokenContract = (debtTokenAddress: string, signer: Signer) => {
    return (new ethers.Contract(debtTokenAddress, debtTokenABI, signer));
}

// Before helping user to flash loan, user need to approve us to borrow on behalf of their account
export const apporve2Borrow = async (debtToken: Contract, user: Signer, flashLoanAddress: string, amount: BigNumber) => {
    const approveDebt = await debtToken.connect(user).approveDelegation(flashLoanAddress, amount);
    return;
}

export const checkBorrowAllowance = async (debtToken: Contract, userAddress: string, flashLoanAddress: string) => {
    const borrowAllowance = await debtToken.borrowAllowance(userAddress, flashLoanAddress);
    console.log("borrowAllowance is ", borrowAllowance);
}

export const initAavePriceOracle = async (signer: Signer) => {
    let priceOricleABI = await (await hre.artifacts.readArtifact("IAaveOracle")).abi;
    AavePriceOricle = new ethers.Contract(AAVE_Price_Oricle_Address, priceOricleABI, signer);
}

export const getAssetPriceOnAAVE = async (asset: string) => {
    let price = await AavePriceOricle.getAssetPrice(asset);
    return price;
}

export const getUserATokenBalance = async (aToken: Contract, userAddress: string) => {
    return (await aToken.balanceOf(userAddress));
}

export const getMaxLeverageOnAAVE =async (asset: string, POOL: Contract, TokenName: string) => {
    let assetConfig = (await POOL.getConfiguration(asset)).data;
    let assetLTV = getLtv(assetConfig);
    // MAX Leverage = 1 / (1 - LTV)
    let maxleverage = getMaxLeverage(assetLTV);
    console.log("   According to the AAVE %s Asset Configuration:", TokenName);
    console.log("       The Maximum leverage abilidity = ", maxleverage.toString());
    return maxleverage;
}

export const calcFlashLoanFee = async (amount: BigNumber) => {
    let Premium = await AAVE_POOL.FLASHLOAN_PREMIUM_TOTAL();
    let fee = amount.mul(Premium).div(10000);
    return fee;   
}