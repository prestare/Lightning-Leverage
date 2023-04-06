import { BigNumber, Contract, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import {Percent} from '@uniswap/sdk-core';
import { 
  DaiAddress,
  WETHAddress,
  WALLET_ADDRESS,
  USDCAddress,
 } from './address';
import {hre} from "./constant";
import {deployFlashLoan} from "./helpers/deployHelper";
import {
    calcUserAssetValue, 
    calcNeedBorrowValue,
    getAmountOutleast,
    getAmountInleast,
    calcLeveragePosition,
    calcNeedBorrowAmount,
    adoptTokenDicimals
} from "./helpers/leverage";
import { 
    initCompContract,
    supplyWETH, 
    getUserCollateralBalance, 
    getAssetPriceOnComp,
    getMaxLeverageOnComp,
    allowFlashLoanContract,
    COMET
} from './helpers/compHelper';
import {
    initAAVEContract,
    calcFlashLoanFee,
    AAVE_POOL
} from "./helpers/aaveHelper";
import {WETH_TOKEN, DAI_TOKEN, USDC_TOKEN, registryToken, swapRoute, encodeRouteToPath} from "./uniswap-router"

async function main() {
    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
    const flashLoan = await deployFlashLoan(fakeSigner);
    // we init AAVE_POOL to calculate flash loan fee, 
    await initAAVEContract(fakeSigner);
    console.log("Now user address: ", fakeSigner.address);

    // DEPOSIT 1 ETH IN COMP
    await initCompContract(fakeSigner);
    console.log("");
    console.log("First, user have to deposit some token into the AAVE Pool");

    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // use bulker to supply eth
    await supplyWETH(fakeSigner, depositAmount);
    let userCollateralBalance = await getUserCollateralBalance(fakeSigner.address, WETHAddress);
    console.log("User collateral balance is: ", userCollateralBalance);

    // FLASH LOAN WETH which means long WETH
    // the contract should borrow 1 WETH and then deposit it in COMP
    // the borrow USDC from COMP and swap USDC to Dai and repay debt in flash loan 
    console.log("");
    console.log("Now calculate user max leverage...");
    console.log("   User deposit Asset is WETH");
    let WETHDecimal = 18;
    let WETHPrice = await getAssetPriceOnComp(WETHAddress);
    const WETHValue = await calcUserAssetValue(userCollateralBalance, WETHPrice, 18);

    let maxleverage = await getMaxLeverageOnComp(WETHAddress, "WETH");
    let maxBorrowCap = WETHValue.mul(maxleverage);
    console.log("       The MAX amount of position (in USD)  = $%d", ethers.utils.formatUnits(maxBorrowCap, 8).toString());

    // user leverage is the leverage be choosed
    console.log("");
    console.log("Now calculate flash loan params...");
    let userleverage = 4;
    console.log("   Current leverage = ", userleverage);    
    // we deposit WETH in comet and borrow USDC 

    // calculate how much we nee to borrow to satify user leverage
    let newPosition = calcLeveragePosition(WETHValue, userleverage);
    console.log("       user want to leverage up their position to $%d", newPosition.toString());
    let needFlashAmountUSD = calcNeedBorrowValue(WETHValue, userleverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needFlashAmountUSD, 8).toString());
    let needFlashAmount = calcNeedBorrowAmount(needFlashAmountUSD, WETHPrice);
    console.log("       so user need to borrow WETH Amount = ", ethers.utils.formatUnits(needFlashAmount, 8).toString());
    let flashloanAmount = adoptTokenDicimals(needFlashAmount, 8, WETHDecimal);
    console.log("       we need to flash loan WETH Amount = %d", flashloanAmount);

    console.log("");
    console.log("   Calculate flash loan fee and slippage");
    let USDCSymbol = "USDC";
    let USDCDecimal = 6;
    let USDCPrice = ethers.utils.parseUnits("1", 8);
    let flashLoanFee = await calcFlashLoanFee(flashloanAmount);    
    console.log("       AAVE Flash Loan fee %d", flashLoanFee);
    // how much WETH we need to repay falsh loan
    let repayAmount = flashloanAmount.add(flashLoanFee);
    console.log("       After SWAP, need %s weth to repay the flash loan", repayAmount.toString());
    // how much USD we need to repay falsh loan ()
    let repayAmountUSD = repayAmount.mul(WETHPrice).div(ethers.utils.parseUnits("1.0", 18));
    console.log("       borrow $%s WETH from Compound to repay the flash loan", ethers.utils.formatUnits(repayAmountUSD, 8).toString());
    let needBorrowAmount = adoptTokenDicimals(calcNeedBorrowAmount(repayAmountUSD, USDCPrice), 8, 6);
    console.log("       borrow %s USDC from Compound to repay the flash loan", needBorrowAmount.toString());

    // 160bps = 1.6%
    // this is too high, check !!!
    let slippage = 160;
    let slipPercent: number = slippage / 10000 * 100;
    console.log("   User's slippage = %d%", slipPercent);
    let amountInLeast = getAmountInleast(needBorrowAmount, slippage);
    console.log("       Before swap, the input should be at least = ", amountInLeast.toString());

    const assets : string[] = [WETHAddress,];
    const amounts : ethers.BigNumber[] = [flashloanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("0"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    const poolFee = 3000;
    const mode = 2;

    // const params = ethers.utils.formatBytes32String("hello");
    registryToken('WETH', WETH_TOKEN);
    registryToken('USDC', USDC_TOKEN);
    const slippageTolerance = new Percent(160, 10_000);
    const route = await swapRoute(
      'USDC',
      flashloanAmount.toString(),
      'WETH',
      slippageTolerance
    );

    if (route == null || route.methodParameters == undefined) throw 'No route loaded';
    
    console.log(...route.trade.swaps);
    const { route: routePath, outputAmount } = route.trade.swaps[0];
    const minimumAmount = route.trade.minimumAmountOut(slippageTolerance, outputAmount).quotient;
    // const minimumAmount = 0;
    const path = encodeRouteToPath(routePath, false);
    // const path = ethers.utils.solidityPack(["address", "uint24", "address"], [USDCAddress, 3000, WETHAddress]);

    console.log(`minimum Amount: ${minimumAmount}`);
    console.log(`route path: ${path}`);

    console.log(`You'll get ${route.quote.toFixed()} of ${USDC_TOKEN.symbol}`);
    // output quote minus gas fees
    console.log(`Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
    console.log(`Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
    console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
    console.log(`Gas Used: ${route.estimatedGasUsed.toString()}`);
    console.log(`Gas Price Wei: ${route.gasPriceWei}`);

    const paths = route.route[0].tokenPath.map(value => value.symbol);

    console.log(`route paths: ${paths}`);
    console.log(`trade: ${route.trade}`);
    const single = route.methodParameters.calldata.includes('5ae401dc');
    // const single = true;

    // params: mode+single+expectAmountOut+path
    const params = ethers.utils.solidityPack(["uint8", "bool", "uint256", "uint256", "bytes"], [mode, single, minimumAmount.toString(), amountInLeast, path]);
    // const params = ethers.utils.formatBytes32String("hello");
    await allowFlashLoanContract(fakeSigner, flashLoan.address);

    const tx3 = AAVE_POOL.connect(fakeSigner).flashLoan(
        flashLoan.address,
        assets,
        amounts,
        interestRateModes,
        fakeSigner.address,
        params,
        0,
      );

    // let borrowBalanceOf = await COMET.borrowBalanceOf(fakeSigner.address);
    // console.log("After leverage, user borrowBalanceOf is: ", borrowBalanceOf);
    // userCollateralBalance = await COMET.collateralBalanceOf(fakeSigner.address, WETHAddress); 
    // console.log("After leverage, user collateral balance is: ", userCollateralBalance);
  
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  