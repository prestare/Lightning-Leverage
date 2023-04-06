import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { 
  DaiAddress,
  V3_SWAP_ROUTER_ADDRESS,
  WETHAddress,
  WALLET_ADDRESS
} from './address';
import {
  daiAbi,
  WethABI
} from "./ABI";
const hre: HardhatRuntimeEnvironment = require('hardhat');

async function main() {

    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
    const flashLoanContract: Contract = await hre.ethers.getContractFactory("SwapRobot");
    console.log(fakeSigner.address);
    // const flashLoan = await flashLoanContract.connect(fakeSigner).deploy(poolAddressProvider, V3_SWAP_ROUTER_ADDRESS, fakeSigner.address);
    const flashLoan = await flashLoanContract.connect(fakeSigner).deploy(V3_SWAP_ROUTER_ADDRESS);
    await flashLoan.deployed();
    console.log(
      `flash loan deployed to ${flashLoan.address}`
    );
    
    // 将Dai转给flash loan Contract
    const DAI = new ethers.Contract(DaiAddress, daiAbi, fakeSigner);
    const swapAmount = ethers.utils.parseUnits("500", 18);
    const tx1 = await DAI.connect(fakeSigner).approve(flashLoan.address, swapAmount);
    const balance = await DAI.balanceOf(flashLoan.address);
    console.log("Now balance is: ", balance);

    // 调用 swapExactInputSingle 交换 DAI(short) 得到 WETH
    const poolFee = 3000;
    const WETH = new ethers.Contract(WETHAddress, WethABI, fakeSigner);
    let wethbalance = await WETH.balanceOf(flashLoan.address);
    console.log("WETH Balance is: ", wethbalance);
    
    const tx2 = await flashLoan.connect(fakeSigner).swapExactInputSingle(swapAmount);
    wethbalance = await WETH.balanceOf(flashLoan.address);
    console.log("WETH Balance is: ", wethbalance);
    // end
  
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  