import { BigNumber, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import {Percent} from '@uniswap/sdk-core';

import { DaiAddress, WETHAddress, aWETHAddress, WALLET_ADDRESS} from './address';
import { 
  calcUserAssetValue,
  calcLeveragePosition,
  calcNeedBorrowValue,
  calcNeedBorrowAmount,
  adoptTokenDicimals,
  getAmountOutleast
} from './helpers/leverage';
import {
    initAavePriceOracle,
    getAssetPriceOnAAVE,
    getUserATokenBalance,
    initAAVEContract, 
    AAVE_POOL, WETH_GATEWAY, 
    aTokenContract, 
    debtTokenContract, 
    getAssetDebtTokenAddress, 
    apporve2Borrow, 
    checkBorrowAllowance,
    getMaxLeverageOnAAVE,
    showUserAccountData,
    num2Fixed,
    getTotalCollateralBase,
    getTotalDebtBase
} from "./helpers/aaveHelper";
import {deployFlashLoan, deployFlashLoanProxy, deployPathLibrary} from "./helpers/deployHelper";
import {hre} from "./constant";
import {
  WETH_TOKEN,
  DAI_TOKEN,
} from "./constant";
import {
  registryToken, 
  swapRoute, 
  encodeRouteToPath
} from "./helpers/UniswapQuoter";

async function main() {

    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);

    const pathLib = await deployPathLibrary(fakeSigner);
    const flashLoan = await deployFlashLoan(fakeSigner, pathLib);
    const flashLoanProxy = await deployFlashLoanProxy(fakeSigner, flashLoan.address);
    
    console.log("Now user address: ", fakeSigner.address);
  
    await initAAVEContract(fakeSigner);
    // DEPOSIT 1 ETH IN AAVE
    const aWETH = aTokenContract(aWETHAddress, fakeSigner);

    const balance = await aWETH.balanceOf(fakeSigner.address);
    console.log("Before any tx, the Wallet AToken Address is balance: ", balance.toString());
    
    console.log("");
    console.log("First, user have to deposit some token into the AAVE Pool");

    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // deposit eth in aave by WETHGateWay function
    console.log("Now, User deposit %d %s token in to AAVE",num2Fixed(depositAmount,18), "ETH");
    const tx1 =  await WETH_GATEWAY.connect(fakeSigner).depositETH(fakeSigner.address,fakeSigner.address, 0, {value: depositAmount});
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
    console.log("");
    console.log("Now calculate user max leverage...");
    console.log("   User deposit Asset is WETH:");
    let WETHPrice = await getAssetPriceOnAAVE(WETHAddress);
    let userBalance = await getUserATokenBalance(aWETH, fakeSigner.address);
    const WETHValue = await calcUserAssetValue(userBalance, WETHPrice, 18);

    let maxleverage = await getMaxLeverageOnAAVE(WETHAddress, AAVE_POOL, "WETH");
    // WETH Value * MAX Leverage = MAX Borrow Cap 
    let maxBorrowCap = WETHValue.mul(maxleverage);
    console.log("       The MAX amount of position (in USD)  = $%d", ethers.utils.formatUnits(maxBorrowCap, 8).toString());
    
    // FLASH LOAN $2000 DAI and short DAI
    let DAIPrice = await getAssetPriceOnAAVE(DaiAddress);
    let DAISymbol = "DAI";
    console.log("   User choose to short %s Asset.", DAISymbol);
    console.log("   %s Price = $%d", DAISymbol, num2Fixed(DAIPrice, 8));
    let DAIdecimal = 18;
    // user leverage is the leverage be choosed
    let userleverage = 4;
    console.log("   Current leverage = ", userleverage);
    let newPosition = calcLeveragePosition(WETHValue, userleverage);
    console.log("       user want to leverage up their position to $%d", newPosition.toString());
    let needBorrowAmountUSD = calcNeedBorrowValue(WETHValue, userleverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needBorrowAmountUSD, 8).toString());
    let needBorrowAmount = calcNeedBorrowAmount(needBorrowAmountUSD, DAIPrice);
    console.log("       so user need to borrow DAI Amount = %d", ethers.utils.formatUnits(needBorrowAmount, 8).toString());
    let flashloanAmount = adoptTokenDicimals(needBorrowAmount, 8, DAIdecimal);
    console.log("       so flash loan Amount = %d", flashloanAmount.toString());

    console.log("");
    // 20bps = 0.2%, when i test, i found the uniswap slip is about 0.1%. WETH-DAI have a lot liquidity, so the slip is small. 
    // But we need to test whether other token-pair swap can have the same slip level.
    let slippage = 20;
    const slippageTolerance = new Percent(slippage, 10_000);
    console.log("User's slippage = %d%", slippageTolerance.toFixed());
    let needSwapETH = calcNeedBorrowValue(userBalance, userleverage);
    console.log("   After swap, we need %s ETH to deposit into the Platform", num2Fixed(needSwapETH, 18));
    let amountOutLeast = getAmountOutleast(needSwapETH, slippage);
    console.log("   So after swap, the output should be at least = ", num2Fixed(amountOutLeast, 18));

    console.log("");
    console.log("Quoter Asset Swap");
    console.log("   Registry Token...");
    // registryToken('WETH', WETH_TOKEN);
    // registryToken('DAI', DAI_TOKEN);

    // const route = await swapRoute(
    //   'DAI',
    //   flashloanAmount.toString(),
    //   'WETH',
    //   slippageTolerance
    // );

    // if (route == null || route.methodParameters == undefined) throw 'No route loaded';
    
    // console.log(...route.trade.swaps);
    // const { route: routePath, outputAmount } = route.trade.swaps[0];
    // const minimumAmount = route.trade.minimumAmountOut(slippageTolerance, outputAmount).quotient;
    const minimumAmount = 5269674485762893556;
    // const path = encodeRouteToPath(routePath, false);
    const path = "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    // console.log(`   minimum Output Amount: ${minimumAmount}`);
    // console.log(`   route path: ${path}`);

    // console.log(`   You'll get ${route.quote.toFixed(WETH_TOKEN.decimals)} of ${WETH_TOKEN.symbol}`);
    // // output quote minus gas fees
    // console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
    // console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
    // console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
    // console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
    // console.log(`   Gas Price Wei: ${route.gasPriceWei}`);

    // const paths = route.route[0].tokenPath.map(value => value.symbol);

    // console.log(`   route paths: ${paths}`);
    // console.log(`   trade: ${route.trade}`);
    const single = true;
    // const single = route.methodParameters.calldata.startsWith('0x5ae401dc');
    // console.log("single: ", single);
    // console.log(route.methodParameters.calldata);

    console.log("");
    // apporve flashloan to increase debt on fakesigner
    const debtTokenAddress = await getAssetDebtTokenAddress(DaiAddress);
    const debtToken = debtTokenContract(debtTokenAddress, fakeSigner);
    // it need to be approved by user, so contract can credit the debt to user address
    await apporve2Borrow(debtToken, fakeSigner, flashLoanProxy.address, flashloanAmount); 
    await checkBorrowAllowance(debtToken, fakeSigner.address, flashLoanProxy.address);
    
    const assets : string[] = [DaiAddress,];
    const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    // const poolFee = 3000;

    // const params = ethers.utils.formatBytes32String("hello");

    // const single = true;

    // params: single+amountOutMinimum+path, bool+uint256+bytes
    const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, minimumAmount.toString(), path, "0x80ddec56"]);

    console.log("");
    console.log("Transaction Begin...");
    
    const tx2 = await AAVE_POOL.connect(fakeSigner).flashLoan(
      flashLoanProxy.address,
      assets,
      amounts,
      interestRateModes,
      fakeSigner.address,
      params,
      0,
    );
    accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
    showUserAccountData(accountData);
    let userTotalCollaterBase = getTotalCollateralBase(accountData);
    let userTotalDebtBase = getTotalDebtBase(accountData);
    let calcLeverage = userTotalCollaterBase.mul(1e8).div(WETHValue)
    console.log("Now user leverage = %d", num2Fixed(calcLeverage, 8));
    // end
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  