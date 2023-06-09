import { ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Percent } from '@uniswap/sdk-core';

import { WETHAddress, USDCAddress } from './address';
import {
  calcUserAssetValue,
} from './helpers/leverage';
import {
  initAavePriceOracle,
  getAssetPriceOnAAVE,
  initAAVEContract,
  AAVE_POOL,
  calcFlashLoanFee,
} from "./helpers/aaveHelper";
import {
  initCompContract,
  supplyWETH,
  getUserCollateralBalance,
  allowFlashLoanContract,
  getUserBorrowCapacityBase,
  COMET,
  depositToComp,
} from './helpers/compHelper';
import { deployAll} from "./helpers/deployHelper";
import { hre } from "./constant";
import { quoterUniswap } from './helpers/UniswapQuoter';

async function main() {

  const [fakeSigner, other]: SignerWithAddress[] = await hre.ethers.getSigners();

  const {flashLoanProxy} = await deployAll(fakeSigner);
  console.log("Now user address: ", fakeSigner.address);

  await initAAVEContract(fakeSigner);
  await initAavePriceOracle(fakeSigner);
  await initCompContract(fakeSigner);

  // DEPOSIT 2 ETH IN Comp
  console.log("");
  console.log("First, user have to deposit some token into the comp Pool");
  const depositAmount = ethers.utils.parseUnits("2", "ether");
  await depositToComp(fakeSigner, fakeSigner.address, WETHAddress, depositAmount, true);

  const userCollateralBalance = await getUserCollateralBalance(fakeSigner.address, WETHAddress);
  let userBorrowCapacityBalance = await getUserBorrowCapacityBase(fakeSigner.address);

  console.log("After Deposit, User borrow capacity base is: ", userBorrowCapacityBalance);

  await initAavePriceOracle(fakeSigner);
  console.log("");
  let WETHPrice = await getAssetPriceOnAAVE(WETHAddress);
  const WETHValue = await calcUserAssetValue(userCollateralBalance, WETHPrice, 18);
  let USDCPrice = await getAssetPriceOnAAVE(USDCAddress);
  console.log("USDCPrice: ", USDCPrice);

  // borrow usdc of the value of 1 ETH(50% deposit) in comp to other
  const borrowAmount = WETHValue.mul(ethers.utils.parseUnits("1.0", 6)).div(USDCPrice).div(2);
  console.log("borrowAmount: ", borrowAmount);
  await COMET.withdrawTo(other.address, USDCAddress, borrowAmount)

  // borrow balance after borrowing
  userBorrowCapacityBalance = await getUserBorrowCapacityBase(fakeSigner.address);
  console.log("After withdraw, User borrow capacity base is: ", userBorrowCapacityBalance);
  let userBorrowBalance = await COMET.borrowBalanceOf(fakeSigner.address);
  console.log("userBorrowBalance: ", userBorrowBalance);


  const borrowCollateralFactor = (await COMET.getAssetInfoByAddress(WETHAddress))[4];
  console.log("the borrowCollateralFactor of WETH is: ", borrowCollateralFactor);

  const slippage = 20;
  const slippageTolerance = new Percent(slippage, 10_000);
  console.log("   User's slippage = %d%", slippageTolerance.toFixed());

  const borrowCollateralAmount = WETHValue.mul(borrowCollateralFactor).div(ethers.utils.parseUnits("1.0", 12)).div(USDCPrice);
  console.log("the borrowCollateralAmount of WETH is: ", borrowCollateralAmount);
  if (userBorrowCapacityBalance >= borrowCollateralAmount) {
    console.log("can directly withdraw weth");
    return 0;
  }

  const flashloanAmount = borrowCollateralAmount.sub(userBorrowCapacityBalance);
  console.log("flashloanAmount: ", flashloanAmount);

  let flashLoanFee = await calcFlashLoanFee(flashloanAmount);
  console.log("   AAVE Flash Loan fee %d", flashLoanFee);
  // how much WETH we need to repay falsh loan
  let repayAmount = flashloanAmount.add(flashLoanFee);
  console.log("   After SWAP, need %s USDC to repay the flash loan", repayAmount.toString());

  const {mValue, single, path} = await quoterUniswap('WETH', 'USDC', repayAmount.toString(), slippage, true, true);
  const maximumAmount = mValue;
  const amountIn = maximumAmount;
  // const single = true;
  // const path = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
  // const amountIn = "1003331194516972752"

  const asset: string = USDCAddress;
  const amount: ethers.BigNumber = flashloanAmount;

  const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, amountIn, path, "0xeedcb9b9", ]);
  console.log("params: ", params)

  await allowFlashLoanContract(fakeSigner, flashLoanProxy.address);

  const tx3 = await AAVE_POOL.connect(fakeSigner).flashLoanSimple(
      flashLoanProxy.address,
      asset,
      amount,
      params,
      0,
  );

}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
