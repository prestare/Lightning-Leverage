import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import {Percent} from '@uniswap/sdk-core';

import { DaiAddress, WETHAddress, aWETHAddress, WALLET_ADDRESS, LIGHTNING_LEVERAGE_ADDRESS} from '../address';
import { 
  calcUserAssetValue,
  calcLeveragePosition,
  calcNeedBorrowValue,
  calcNeedBorrowAmount,
  adoptTokenDicimals,
  getAmountOutleast
} from '../helpers/leverage';
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
} from "../helpers/aaveHelper";
import {deployFlashLoan} from "../helpers/deployHelper";
import {hre, flashAssetList, mainnetProvider} from "../constant";
import {
  WETH_TOKEN,
  DAI_TOKEN,
  USDC_TOKEN,
} from "../constant";
import {
  registryToken, 
  swapRoute, 
  encodeRouteToPath
} from "../helpers/UniswapQuoter";

var tokenContractMap: Map<string, Contract> = new Map();
var atokenContractMap: Map<string, Contract> = new Map();

export const initTokenAddress = (provider: Signer) => {
    for (const key in flashAssetList) {
        const address = flashAssetList[key];
        const aToken = aTokenContract(aWETHAddress, provider);
        atokenContractMap.set(key, aToken);
    }
    registryToken('WETH', WETH_TOKEN);
    registryToken('DAI', DAI_TOKEN);
    registryToken('USDC', USDC_TOKEN);
}

export const initAAVEGlobal = async (user: Signer) => {
    await initAAVEContract(user);
    await initAavePriceOracle(user);
}

interface UserLeverageMsg {
    depositAsset: string,
    longAsset: string,
    shortAsset: string,
    depositAssetAddress?: string,
    longAssetAddress?: string,
    shortAssetAddress?: string,
    userLeverage?: number,
    slippage?: number
}

export const deconstructMaxLever = (msg: string[]) => {
    var obj: UserLeverageMsg = {
        depositAsset : msg[1],
        longAsset: msg[2],
        shortAsset: msg[3],
    };
    obj.depositAssetAddress = flashAssetList[obj.depositAsset];
    obj.longAssetAddress = flashAssetList[obj.longAsset];
    obj.shortAssetAddress = flashAssetList[obj.shortAsset];
    return obj;
}

export const calcUserAAVEMaxLeverage = async (user: SignerWithAddress, msg: string[]) => {
    // let depositAsset = msg[1];
    // let longAsset = msg[2];
    // let shortAsset = msg[3];
    // var depositAssetAddress = flashAssetList[depositAsset];
    // // console.log(depositAssetAddress);
    // var longAssetAddress = flashAssetList[longAsset];
    // var shortAssetAddress = flashAssetList[shortAsset];
    var leverMsg = deconstructMaxLever(msg);

    let depositAssetPrice = await getAssetPriceOnAAVE(leverMsg.depositAssetAddress!);
    const aToken = atokenContractMap.get(leverMsg.depositAsset)!;
    let userBalance = await getUserATokenBalance(aToken, user.address);
    const balance = await aToken.balanceOf(user.address);
    console.log("Before any tx, the Wallet AToken Address is balance: ", balance.toString());
    
    // let LongAssetPrice = await getAssetPriceOnAAVE(longAssetAddress);
    // let shortAssetPrice = await getAssetPriceOnAAVE(shortAssetAddress);

    const depositValue = await calcUserAssetValue(userBalance, depositAssetPrice, 18);
    const maxleverage = await getMaxLeverageOnAAVE(leverMsg.depositAssetAddress!, AAVE_POOL, "");
    const maxBorrowCap = depositValue.mul(maxleverage);
    return [maxleverage.toString(), maxBorrowCap.toString()];
}

export const calcUserLeverFlashLoan = async (user: SignerWithAddress, msg: string[]) => {
    var leverMsg = deconstructMaxLever(msg);

    let depositAssetPrice = await getAssetPriceOnAAVE(leverMsg.depositAssetAddress!);
    const aToken = atokenContractMap.get(leverMsg.depositAsset)!;
    let userBalance = await getUserATokenBalance(aToken, user.address);
    const balance = await aToken.balanceOf(user.address);
    const depositValue = await calcUserAssetValue(userBalance, depositAssetPrice, 18);

    let shortAssetPrice = await getAssetPriceOnAAVE(leverMsg.shortAssetAddress!);
    console.log("   User choose to short %s Asset.", leverMsg.shortAsset);
    console.log("   %s Price = $%d", leverMsg.shortAsset, num2Fixed(shortAssetPrice, 8));
    leverMsg.userLeverage = parseInt(msg[4]);
    let shortAssetDecimal = 18;
    console.log("   Current leverage = ", leverMsg.userLeverage);
    let newPosition = calcLeveragePosition(depositValue, leverMsg.userLeverage);
    console.log("       user want to leverage up their position to $%d", newPosition.toString());
    let needBorrowAmountUSD = calcNeedBorrowValue(depositValue, leverMsg.userLeverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needBorrowAmountUSD, 8).toString());
    let needBorrowAmount = calcNeedBorrowAmount(needBorrowAmountUSD, shortAssetPrice);
    console.log("       so user need to borrow DAI Amount = %d", ethers.utils.formatUnits(needBorrowAmount, 8).toString());
    let flashloanAmount = adoptTokenDicimals(needBorrowAmount, 8, shortAssetDecimal);
    console.log("       so flash loan Amount = %s", flashloanAmount.toString());

    leverMsg.slippage = parseInt(msg[5]);
    const slippageTolerance = new Percent(leverMsg.slippage, 10_000);
    console.log("User's slippage = %d%", slippageTolerance.toFixed());
    let needSwapLongAsset = calcNeedBorrowValue(userBalance, leverMsg.userLeverage);
    console.log("   After swap, we need %s ETH to deposit into the Platform", num2Fixed(needSwapLongAsset, 18));
    let amountOutLeast = getAmountOutleast(needSwapLongAsset, leverMsg.slippage);
    console.log("   So after swap, the output should be at least = %s", num2Fixed(amountOutLeast, 18));
    return {
        flashloanAmount, 
        needSwapLongAsset, 
        amountOutLeast
    }
}

export const quoterUniswap = async (flashLoanAmount:string, slippage: number) => {
    console.log("");
    console.log("Quoter Asset Swap");
    const slippageTolerance = new Percent(slippage, 10_000);
    const route = await swapRoute(
        'DAI',
        flashLoanAmount,
        'WETH',
        slippageTolerance
      );

    if (route == null || route.methodParameters == undefined) throw 'No route loaded';
    
    // console.log(...route.trade.swaps);
    const { route: routePath, outputAmount } = route.trade.swaps[0];
    const minimumAmount = route.trade.minimumAmountOut(slippageTolerance, outputAmount).quotient;
    // const minimumAmount = 0;
    const path = encodeRouteToPath(routePath, false);
    // const path = ethers.utils.solidityPack(["address", "uint24", "address"], [DaiAddress, 3000, WETHAddress]);
    console.log(`   minimum Output Amount: ${minimumAmount}`);
    console.log(`   route path: ${path}`);
    console.log(`   You'll get ${route.quote.toFixed(WETH_TOKEN.decimals)} of ${WETH_TOKEN.symbol}`);
    // output quote minus gas fees
    console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
    console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
    console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
    console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
    console.log(`   Gas Price Wei: ${route.gasPriceWei}`);

    const paths = route.route[0].tokenPath.map(value => value.symbol);

    console.log(`   route paths: ${paths}`);
    console.log(`   trade: ${route.trade}`);
    // const single = route.methodParameters.calldata.includes('5ae401dc');
    const single = !route.methodParameters.calldata.startsWith('0x5ae401dc');
    return {
        minimumAmount,
        single,
        path
    }
}

export const execLeverage = async (user: SignerWithAddress,flashAmount:string, msg: string[]) => {
    var leverMsg = deconstructMaxLever(msg);
    leverMsg.userLeverage = parseInt(msg[4]);
    leverMsg.slippage = parseInt(msg[5]);
    var flashLoanAmount = BigNumber.from(flashAmount);
    const {minimumAmount, single, path} = await quoterUniswap(flashAmount, leverMsg.slippage);
    console.log(`   route path: ${path}`);
    
    console.log("");
    // apporve flashloan to increase debt on fakesigner
    const debtTokenAddress = await getAssetDebtTokenAddress(DaiAddress);
    const debtToken = debtTokenContract(debtTokenAddress, user);
    // it need to be approved by user, so contract can credit the debt to user address
    await apporve2Borrow(debtToken, user, LIGHTNING_LEVERAGE_ADDRESS, flashLoanAmount); 
    await checkBorrowAllowance(debtToken, user.address, LIGHTNING_LEVERAGE_ADDRESS);
    
    const assets : string[] = [leverMsg.shortAssetAddress!,];
    const amounts : ethers.BigNumber[] = [BigNumber.from(flashLoanAmount), ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];
    // this params is used to meet the condition in executeOperation
    // params: 1. address is long asset address 2. Slippage 500 ~ 0.05% 3000 ~ 0.3% 10000 ~ 1%
    // const poolFee = 3000;
    const mode = 1;
    const params = ethers.utils.solidityPack(["uint8", "bool", "uint256", "bytes"], [mode, single, minimumAmount.toString(), path]);

    console.log("");
    console.log("Transaction Begin...");
    const tx2 = await AAVE_POOL.connect(user).flashLoan(
      LIGHTNING_LEVERAGE_ADDRESS,
      assets,
      amounts,
      interestRateModes,
      user.address,
      params,
      0,
    );
    var accountData = await AAVE_POOL.getUserAccountData(user.address);
    showUserAccountData(accountData);
    // let userTotalCollaterBase = getTotalCollateralBase(accountData);
    // let userTotalDebtBase = getTotalDebtBase(accountData);
    // let calcLeverage = userTotalCollaterBase.mul(1e8).div(oldValue)
    // console.log("Now user leverage = %d", num2Fixed(calcLeverage, 8));
} 

async function main() {
    await impersonateAccount(WALLET_ADDRESS);
    const user: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);

    await initAAVEGlobal(user);
    await initTokenAddress(user);
    // await helpUserDeposit(user, "WETH");
    console.log("Now user address: ", user.address);
    var msg: string[] = ["AAVE", "WETH", "WETH", "DAI"];
    var value: string[] = await calcUserAAVEMaxLeverage(user, msg);
    console.log(value);
    msg[4] = "4";
    msg[5] = "20";
    const { flashloanAmount, needSwapLongAsset, amountOutLeast } = await calcUserLeverFlashLoan(user, msg);

    await execLeverage(user, flashloanAmount.toString(), msg);

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});


const helpUserDeposit = async (user:SignerWithAddress, tokenName: string) => {
    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // deposit eth in aave by WETHGateWay function
    console.log("Now, User deposit %d %s token in to AAVE",num2Fixed(depositAmount,18), "ETH");
    const tx1 =  await WETH_GATEWAY.connect(user).depositETH(user.address,user.address, 0, {value: depositAmount});
    console.log("After Deposit...");
    // check if we actually have one aWETH
    const aToken = atokenContractMap.get(tokenName)!;
    const aTokenBalance = await getUserATokenBalance(aToken, user.address);
    console.log("   user a%sBalance is ", "ETH", num2Fixed(aTokenBalance, 18));
    let accountData = await AAVE_POOL.getUserAccountData(user.address);
    showUserAccountData(accountData);
}