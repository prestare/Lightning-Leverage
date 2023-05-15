import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { 
  poolAddressProvider, 
  AAVE_POOL_ADDRESS,
  USDCAddress
} from './address';
import {
    aTokenAbi,
    debtTokenABI,
    WETHGateABI,
    erc20
  } from "./ABI";
import { deployFlashLoan } from './helpers/deployHelper';
import { showUserAccountData } from './helpers/aaveHelper';
const hre: HardhatRuntimeEnvironment = require('hardhat');

async function main() {
  let userAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  await impersonateAccount(userAddress);

  const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(userAddress);
  let poolAbi = await (await hre.artifacts.readArtifact("IPool")).abi;
  const AAVE_POOL = new ethers.Contract(AAVE_POOL_ADDRESS, poolAbi, fakeSigner);
  var accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
  showUserAccountData(accountData);

  let amount = "100";
  let token = new Contract(USDCAddress, erc20, fakeSigner);
  let decimals = await token.decimals();
  console.log(decimals);
  let deposit = ethers.utils.parseUnits(amount, decimals);
  console.log(deposit);
  let balance = await token.balanceOf(fakeSigner.address);
  console.log(balance);
  await token.connect(fakeSigner).approve(AAVE_POOL_ADDRESS, deposit);
  await AAVE_POOL.connect(fakeSigner).deposit(USDCAddress,deposit,fakeSigner.address,0);
  accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
  showUserAccountData(accountData);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});