import { BigNumber, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Percent } from '@uniswap/sdk-core';

import { DaiAddress, WETHAddress, aWETHAddress } from './address';
import {
  calcUserAssetValue,
} from './helpers/leverage';
import {
  initAavePriceOracle,
  getAssetPriceOnAAVE,
  getUserATokenBalance,
  initAAVEContract,
  AAVE_POOL, WETH_GATEWAY,
  aTokenContract,
  showUserAccountData,
  num2Fixed,
  getApprovePermit,
  calcFlashLoanAmountByRepayAmount
} from "./helpers/aaveHelper";
import { deployFlashLoan, deployFlashLoanProxy, deployPathLibrary } from "./helpers/deployHelper";
import { hre } from "./constant";
import {
  WETH_TOKEN,
  DAI_TOKEN,
} from "./constant";
import {
  registryToken,
  swapRoute,
  encodeRouteToPath
} from "./helpers/UniswapQuoter";

/*
 *  example: change deposit: WETH => Dai in aave
*/

async function main() {

  // get a singer
  const [fakeSigner, other]: SignerWithAddress[] = await hre.ethers.getSigners();

  // deploy contracts
  const pathLib = await deployPathLibrary(fakeSigner);
  const flashLoan = await deployFlashLoan(fakeSigner, pathLib);
  const flashLoanProxy = await deployFlashLoanProxy(fakeSigner, flashLoan.address);
  console.log("Now user address: ", fakeSigner.address);

  // init aave contracts
  await initAAVEContract(fakeSigner);
  
  // DEPOSIT 2 ETH IN AAVE
  const aWETH = aTokenContract(aWETHAddress, fakeSigner);
  console.log("First, user have to deposit some token into the AAVE Pool");
  const depositAmount = ethers.utils.parseUnits("2", "ether");
  // deposit eth in aave by WETHGateWay function
  console.log("Now, User deposit %d %s token in to AAVE", num2Fixed(depositAmount, 18), "ETH");
  const tx1 = await WETH_GATEWAY.connect(fakeSigner).depositETH(fakeSigner.address, fakeSigner.address, 0, { value: depositAmount });
  console.log("After Deposit...");
  // check if we actually have one aWETH
  let aTokenBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
  console.log("   user a%sBalance is ", "ETH", num2Fixed(aTokenBalance, 18));

  // check user account data
  let accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
  showUserAccountData(accountData);
  // console.log(accountData);

  // console.log(AavePrices);
  // Price 小数位为8
  await initAavePriceOracle(fakeSigner);
  let WETHPrice = await getAssetPriceOnAAVE(WETHAddress);
  let userBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
  const WETHValue = await calcUserAssetValue(userBalance, WETHPrice, 18);
  let DAIPrice = await getAssetPriceOnAAVE(DaiAddress);
  console.log("DAIPrice: ", DAIPrice);

  const slippage = 20;
  const slippageTolerance = new Percent(slippage, 10_000);
  console.log("   User's slippage = %d%", slippageTolerance.toFixed());

  console.log("");
  console.log("Quoter Asset Swap");
  console.log("   Registry Token...");
  registryToken('WETH', WETH_TOKEN);
  registryToken('DAI', DAI_TOKEN);
  const route = await swapRoute(
    'WETH',
    aTokenBalance,
    'DAI',
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
  // const path = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f46b175474e89094c44da98b954eedeac495271d0f";
  // const minimumOutputAmount = BigNumber.from("3667518140694153770716");

  const amountIn = aTokenBalance;
  console.log("amountIn: ", amountIn);
  const asset: string = DaiAddress;
  const flashLoanAmount = await calcFlashLoanAmountByRepayAmount(minimumOutputAmount);
  console.log("flashLoanAmount: ", flashLoanAmount);
  const amount: ethers.BigNumber = flashLoanAmount;
  
  const permitInfo = await getApprovePermit(aWETH, fakeSigner, flashLoanProxy.address, amountIn);

  // params: single+amountIn+deadline+v+r+s+path+selector,
  // bool+uint256+uint256+uint8+bytes32+bytes32+bytes+bytes4
  const params = ethers.utils.solidityPack(["bool", "uint256", "uint256", "uint8", "bytes32", "bytes32", "bytes", "bytes4"],
    [single, amountIn, permitInfo.deadline, permitInfo.sig.v, permitInfo.sig.r, permitInfo.sig.s, path, "0xc85a890a"]);
  console.log("params: ", params)
  console.log("v: ", permitInfo.sig.v);
  console.log("r: ", permitInfo.sig.r);
  console.log("s: ", permitInfo.sig.s);

  const tx3 = await AAVE_POOL.connect(fakeSigner).flashLoanSimple(
    flashLoanProxy.address,
    asset,
    amount,
    params,
    0,
  );

  accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
  showUserAccountData(accountData);

  aTokenBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
  console.log("   user a%sBalance is ", "ETH", num2Fixed(aTokenBalance, 18));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
