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
} from './helpers/compHelper';
import { deployFlashLoan } from "./helpers/deployHelper";
import { hre } from "./constant";

async function main() {

  const [fakeSigner, other]: SignerWithAddress[] = await hre.ethers.getSigners();
  const flashLoan = await deployFlashLoan(fakeSigner);
  console.log("Now user address: ", fakeSigner.address);

  await initAAVEContract(fakeSigner);
  await initAavePriceOracle(fakeSigner);
  await initCompContract(fakeSigner);

  // DEPOSIT 2 ETH IN Comp
  console.log("");
  console.log("First, user have to deposit some token into the comp Pool");
  const depositAmount = ethers.utils.parseUnits("2", "ether");
  await supplyWETH(fakeSigner, depositAmount);

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

  console.log("");
  // console.log("Quoter Asset Swap");
  // console.log("   Registry Token...");
  
  // registryToken('WETH', WETH_TOKEN);
  // registryToken('USDC', USDC_TOKEN);
  // const route = await swapRouteExactOutPut(
  //   'WETH',
  //   repayAmount.toString(),
  //   'USDC',
  //   slippageTolerance
  // );

  // if (route == null || route.methodParameters == undefined) throw 'No route loaded';

  // const { route: routePath, inputAmount } = route.trade.swaps[0];
  // const maximumAmount = route.trade.maximumAmountIn(slippageTolerance, inputAmount).quotient;
  // const path = encodeRouteToPath(routePath, false);
  // console.log(`   maximum Input Amount: ${maximumAmount}`);
  // console.log(`   route path: ${path}`);

  // console.log(`   You'll pay ${route.quote.toFixed()} of ${WETH_TOKEN.symbol}`);
  // // output quote minus gas fees
  // console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
  // console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
  // console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
  // console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
  // console.log(`   Gas Price Wei: ${route.gasPriceWei}`);

  // const paths = route.route[0].tokenPath.map(value => value.symbol);
  // console.log(`   route paths: ${paths}`);
  // console.log(`   trade: ${route.trade}`);

  // const single = !route.methodParameters.calldata.startsWith('0x5ae401dc');
  // const amountIn = maximumAmount.toString();

  const single = true;
  const path = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
  const amountIn = "1003331194516972752"

  const asset: string = USDCAddress;
  const amount: ethers.BigNumber = flashloanAmount;

  let params = ethers.utils.defaultAbiCoder.encode(["tuple(bytes,bool,uint256,uint256)", "uint256"], [[path, single, amountIn, repayAmount.toString()], flashloanAmount.toString()]);
  params = ethers.utils.solidityPack(["bytes4", "bytes"], ["0x6afc18e3", params]);
  console.log("params: ", params)

  await allowFlashLoanContract(fakeSigner, flashLoan.address);

  const tx3 = await AAVE_POOL.connect(fakeSigner).flashLoanSimple(
      flashLoan.address,
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
