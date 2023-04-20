import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { DaiAddress, WETHAddress, aWETHAddress, WALLET_ADDRESS, LIGHTNING_LEVERAGE_ADDRESS} from '../address';
import {
    initAavePriceOracle,
    getAssetPriceOnAAVE,
    getUserATokenBalance,
    initAAVEContract, 
    AAVE_POOL, WETH_GATEWAY, 
    showUserAccountData,
    num2Fixed,

} from "../helpers/aaveHelper";
import {deployFlashLoan} from "../helpers/deployHelper";
import {hre, flashAssetList, mainnetProvider} from "../constant";

import { initAAVEGlobal, atokenContractMap, initTokenAddress} from "./aaveLogic";

async function main() {
    await impersonateAccount(WALLET_ADDRESS);
    const user: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);

    await initAAVEGlobal(user);
    await initTokenAddress(user);
    const flashLoan = await deployFlashLoan(user);
    console.log("Now user address: ", user.address);
    await helpUserDeposit(user, "WETH");
}

// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });


const helpUserDeposit = async (user:SignerWithAddress, tokenName: string) => {
    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // deposit eth in aave by WETHGateWay function
    console.log("Now, User deposit %d %s token in to AAVE",num2Fixed(depositAmount,18), "ETH");
    const tx1 =  await WETH_GATEWAY.connect(user).depositETH(user.address,user.address, 0, {value: depositAmount});
    console.log("After Deposit...");
    // check if we actually have one aWETH
    const aToken = atokenContractMap.get(tokenName)!;
    const aTokenBalance = await getUserATokenBalance(aToken, user.address);
    console.log("   user a%sBalance is ", "ETH", num2Fixed(aTokenBalance, 18));
    let accountData = await AAVE_POOL.getUserAccountData(user.address);
    showUserAccountData(accountData);
}