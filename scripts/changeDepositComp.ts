import { BigNumber, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Percent } from '@uniswap/sdk-core';

import { WETHAddress, WBTC_ADDRESS } from './address';

import {
  initAavePriceOracle,
  initAAVEContract,
  AAVE_POOL,
  num2Fixed,
  calcFlashLoanAmountByRepayAmount
} from "./helpers/aaveHelper";
import { deployAll} from "./helpers/deployHelper";
import { hre } from "./constant";
import {
  quoterUniswap
} from "./helpers/UniswapQuoter";
import { allowFlashLoanContract, depositToComp, getUserCollateralBalance, initCompContract, supplyWETH } from './helpers/compHelper';

/*
 *  example: change deposit: WETH => WBTC in comp
*/
async function main() {

  // get a singer
  const [fakeSigner, other]: SignerWithAddress[] = await hre.ethers.getSigners();

  // deploy contracts
  const flashLoanProxy = await deployAll(fakeSigner);
  console.log("Now user address: ", fakeSigner.address);

  // init  contracts
  await initAAVEContract(fakeSigner);
  await initAavePriceOracle(fakeSigner);
  await initCompContract(fakeSigner);

  console.log("");
  console.log("First, user have to deposit some token into the Compound Pool");

  const depositAmount = ethers.utils.parseUnits("2", "ether");
  // use bulker to supply eth
  await depositToComp(fakeSigner, fakeSigner.address, WETHAddress, depositAmount, true);
  
  let userCollateralBalanceWETH = await getUserCollateralBalance(fakeSigner.address, WETHAddress);
  let userCollateralBalanceWBTC = await getUserCollateralBalance(fakeSigner.address, WBTC_ADDRESS);
  console.log("After Deposit, User collateral balance is: %d WETH", num2Fixed(userCollateralBalanceWETH, 18));
  console.log("After Deposit, User collateral balance is: %d WBTC", num2Fixed(userCollateralBalanceWBTC, 8));

  const slippage = 20;
  const slippageTolerance = new Percent(slippage, 10_000);
  console.log("   User's slippage = %d%", slippageTolerance.toFixed());

  const {mValue, single, path} = await quoterUniswap('WETH', 'WBTC', userCollateralBalanceWETH, slippage, false, false);
  const minimumOutputAmount = BigNumber.from(mValue);
  // const single = true;
  // const path = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f42260fac5e5542a773aa44fbcfedf7c193bc2c599";
  // const minimumOutputAmount = BigNumber.from("13303595");

  const amountIn = userCollateralBalanceWETH;
  console.log("amountIn: ", amountIn);
  const asset: string = WBTC_ADDRESS;
  const flashLoanAmount = await calcFlashLoanAmountByRepayAmount(minimumOutputAmount);
  console.log("flashLoanAmount: ", flashLoanAmount);
  const amount: ethers.BigNumber = flashLoanAmount;


  // params: single+amountIn+path+selector,
  // bool+uint256+bytes+bytes4
  const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"],
    [single, amountIn, path, "0x4cc63017"]);
  console.log("params: ", params)

  await allowFlashLoanContract(fakeSigner, flashLoanProxy.address);

  const tx3 = await AAVE_POOL.connect(fakeSigner).flashLoanSimple(
    flashLoanProxy.address,
    asset,
    amount,
    params,
    0,
  );

  userCollateralBalanceWETH = await getUserCollateralBalance(fakeSigner.address, WETHAddress);
  userCollateralBalanceWBTC = await getUserCollateralBalance(fakeSigner.address, WBTC_ADDRESS);
  console.log("After Deposit, User collateral balance is: %d WETH", num2Fixed(userCollateralBalanceWETH, 18));
  console.log("After Deposit, User collateral balance is: %d WBTC", num2Fixed(userCollateralBalanceWBTC, 8));

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
