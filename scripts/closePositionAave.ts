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
  calcFlashLoanFee,
  showUserAccountData,
  num2Fixed,
  getUserDebtTokenBalance,
  getApprovePermit
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
  swapRouteExactOutPut,
  encodeRouteToPath
} from "./helpers/UniswapQuoter";

async function main() {

  const [fakeSigner, other]: SignerWithAddress[] = await hre.ethers.getSigners();

  const pathLib = await deployPathLibrary(fakeSigner);
  const flashLoan = await deployFlashLoan(fakeSigner, pathLib);
  const flashLoanProxy = await deployFlashLoanProxy(fakeSigner, flashLoan.address);
  console.log("Now user address: ", fakeSigner.address);

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
  const aTokenBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
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

  // borrow dai of the value of 1 ETH(50% deposit) in aave to other
  const borrowAmount = WETHValue.mul(ethers.utils.parseUnits("1.0", 18)).div(DAIPrice).div(2);
  console.log("borrowAmount: ", borrowAmount);
  await AAVE_POOL.borrow(DaiAddress, borrowAmount, 2, 0, fakeSigner.address); // 2 represents variable interest rate

  // account data after borrowing
  accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
  showUserAccountData(accountData);

  const debtTokenBalance = await getUserDebtTokenBalance(DaiAddress, fakeSigner.address, 2);
  console.log("interestMode: %d;debtTokenBalance: %s", 2, debtTokenBalance);

  const slippage = 20;
  const slippageTolerance = new Percent(slippage, 10_000);
  console.log("   User's slippage = %d%", slippageTolerance.toFixed());

  const flashloanAmount = debtTokenBalance;
  console.log("flashAmount: ", flashloanAmount);

  let flashLoanFee = await calcFlashLoanFee(flashloanAmount);
  console.log("   AAVE Flash Loan fee %d", flashLoanFee);
  // how much WETH we need to repay falsh loan
  let repayAmount = flashloanAmount.add(flashLoanFee);
  console.log("   After SWAP, need %s DAI to repay the flash loan", repayAmount.toString());

  console.log("");
  // console.log("Quoter Asset Swap");
  // console.log("   Registry Token...");
  // registryToken('WETH', WETH_TOKEN);
  // registryToken('DAI', DAI_TOKEN);
  // const route = await swapRouteExactOutPut(
  //   'WETH',
  //   repayAmount.toString(),
  //   'DAI',
  //   slippageTolerance
  // );

  // if (route == null || route.methodParameters == undefined) throw 'No route loaded';

  // const { route: routePath, inputAmount } = route.trade.swaps[0];
  // const maximumAmount = route.trade.maximumAmountIn(slippageTolerance, inputAmount).quotient;

  // const path = encodeRouteToPath(routePath, true);
  // console.log(`   maximum Input Amount: ${maximumAmount}`);
  // console.log(`   route path: ${path}`);

  // console.log(`   You'll pay ${route.quote.toFixed()} of ${DAI_TOKEN.symbol}`);
  // // output quote minus gas fees
  // console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
  // console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
  // console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
  // console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
  // console.log(`   Gas Price Wei: ${route.gasPriceWei}`);

  // const paths = route.route[0].tokenPath.map(value => value.symbol);
  // console.log(`   route paths: ${paths}`);
  // console.log(`   trade: ${route.trade}`);

  // const single = paths.length == 2;
  // const amountIn = maximumAmount.toString();

  const single = true;
  const path = "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
  const amountIn = "1003389458389176670"

  const asset: string = DaiAddress;
  const amount: ethers.BigNumber = flashloanAmount;
  const interestRateMode: ethers.BigNumber = BigNumber.from("2");
  
  const permitInfo = await getApprovePermit(aWETH, fakeSigner, flashLoanProxy.address, amountIn);

  // params: single+amountInMaximum+interestRateMode+deadline+v+r+s+path+selector,
  // bool+uint256+uint256+uint256+uint8+bytes32+bytes32+bytes+bytes4
  const params = ethers.utils.solidityPack(["bool", "uint256", "uint256", "uint256", "uint8", "bytes32", "bytes32", "bytes", "bytes4"],
    [single, amountIn, interestRateMode.toString(), permitInfo.deadline, permitInfo.sig.v, permitInfo.sig.r, permitInfo.sig.s, path, "0xd8ad4ac2"]);
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

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
