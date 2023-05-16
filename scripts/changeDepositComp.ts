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
import { deployFlashLoan, deployFlashLoanProxy, deployPathLibrary } from "./helpers/deployHelper";
import { hre, WETH_TOKEN, WBTC_TOKEN } from "./constant";
import {
  registryToken,
  swapRoute,
  swapRouteExactOutPut,
  encodeRouteToPath
} from "./helpers/UniswapQuoter";
import { allowFlashLoanContract, getUserCollateralBalance, initCompContract, supplyWETH } from './helpers/compHelper';

/*
 *  example: change deposit: WETH => WBTC in comp
*/
async function main() {

  // get a singer
  const [fakeSigner, other]: SignerWithAddress[] = await hre.ethers.getSigners();

  // deploy contracts
  const pathLib = await deployPathLibrary(fakeSigner);
  const flashLoan = await deployFlashLoan(fakeSigner, pathLib);
  const flashLoanProxy = await deployFlashLoanProxy(fakeSigner, flashLoan.address);
  console.log("Now user address: ", fakeSigner.address);

  // init  contracts
  await initAAVEContract(fakeSigner);
  await initAavePriceOracle(fakeSigner);
  await initCompContract(fakeSigner);

  console.log("");
  console.log("First, user have to deposit some token into the Compound Pool");

  const depositAmount = ethers.utils.parseUnits("2", "ether");
  // use bulker to supply eth
  await supplyWETH(fakeSigner, depositAmount);
  let userCollateralBalanceWETH = await getUserCollateralBalance(fakeSigner.address, WETHAddress);
  let userCollateralBalanceWBTC = await getUserCollateralBalance(fakeSigner.address, WBTC_ADDRESS);
  console.log("After Deposit, User collateral balance is: %d WETH", num2Fixed(userCollateralBalanceWETH, 18));
  console.log("After Deposit, User collateral balance is: %d WBTC", num2Fixed(userCollateralBalanceWBTC, 8));

  const slippage = 20;
  const slippageTolerance = new Percent(slippage, 10_000);
  console.log("   User's slippage = %d%", slippageTolerance.toFixed());

  console.log("");
  console.log("Quoter Asset Swap");
  console.log("   Registry Token...");
  registryToken('WETH', WETH_TOKEN);
  registryToken('WBTC', WBTC_TOKEN);
  const route = await swapRoute(
    'WETH',
    userCollateralBalanceWETH,
    'WBTC',
    slippageTolerance
  );

  if (route == null || route.methodParameters == undefined) throw 'No route loaded';

  const { route: routePath, outputAmount } = route.trade.swaps[0];
  console.log("amountOut: ", outputAmount.quotient.toString());
  const minimumOutputAmountString = route.trade.minimumAmountOut(slippageTolerance, outputAmount).quotient.toString();
  const minimumOutputAmount = BigNumber.from(minimumOutputAmountString);

  const path = encodeRouteToPath(routePath, false);
  console.log(`   minimum Output Amount: ${minimumOutputAmount}`);
  console.log(`   route path: ${path}`);

  console.log(`   You'll pay ${route.quote.toFixed()} of USDC`);
  // output quote minus gas fees
  console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
  console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
  console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
  console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
  console.log(`   Gas Price Wei: ${route.gasPriceWei}`);

  const paths = route.route[0].tokenPath.map(value => value.symbol);
  console.log(`   route paths: ${paths}`);
  console.log(`   trade: ${route.trade}`);
  
  const single = paths.length == 2;

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
