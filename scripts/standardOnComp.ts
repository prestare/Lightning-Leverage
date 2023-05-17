import { BigNumber, Contract, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import {
    WETHAddress,
    WALLET_ADDRESS,
    USDCAddress,
} from './address';
import { hre } from "./constant";
import { deployAll} from "./helpers/deployHelper";
import {
    calcUserAssetValue,
    calcNeedBorrowValue,
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
} from './helpers/compHelper';
import {
    initAAVEContract,
    initAavePriceOracle,
    calcFlashLoanFee,
    AAVE_POOL,
    num2Fixed,
    getAssetPriceOnAAVE
} from "./helpers/aaveHelper";
import {
    quoterUniswap
} from "./helpers/UniswapQuoter";
import { Percent } from '@uniswap/sdk-core';
import { COMET } from "./helpers/compHelper";

async function main() {
    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
    
    const flashLoanProxy = await deployAll(fakeSigner);
    // we init AAVE_POOL to calculate flash loan fee, 
    console.log("Now user address: ", fakeSigner.address);

    // DEPOSIT 2 ETH IN COMP
    await initAAVEContract(fakeSigner);
    await initAavePriceOracle(fakeSigner);
    await initCompContract(fakeSigner);
    console.log("");
    console.log("First, user have to deposit some token into the Compound Pool");

    const depositAmount = ethers.utils.parseUnits("2", "ether");
    // use bulker to supply eth
    await supplyWETH(fakeSigner, depositAmount);
    let userCollateralBalance = await getUserCollateralBalance(fakeSigner.address, WETHAddress);
    console.log("After Deposit, User collateral balance is: ", num2Fixed(userCollateralBalance, 18));

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
    console.log("       The MAX amount of position (in USD)  = $%d", num2Fixed(maxBorrowCap, 8));

    // user leverage is the leverage be choosed
    console.log("");
    console.log("Now calculate flash loan params...");
    let userleverage = 4;
    console.log("   Current leverage = ", userleverage);
    // we deposit WETH in comet and borrow USDC 

    let needFlashAmountUSD = calcNeedBorrowValue(WETHValue, userleverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needFlashAmountUSD, 8).toString());
    let needFlashAmount = calcNeedBorrowAmount(needFlashAmountUSD, WETHPrice);
    console.log("       so user need to borrow WETH Amount = ", ethers.utils.formatUnits(needFlashAmount, 8).toString());
    let flashloanAmount = adoptTokenDicimals(needFlashAmount, 8, WETHDecimal);
    console.log("       we need to flash loan WETH Amount = %d", flashloanAmount);

    console.log("");
    console.log("Calculate flash loan fee and slippage");
    let USDCSymbol = "USDC";
    let USDCDecimal = 6;
    let USDCPrice = await getAssetPriceOnAAVE(USDCAddress);
    console.log("   %s Price = $%d", USDCSymbol, num2Fixed(USDCPrice, 8));

    let flashLoanFee = await calcFlashLoanFee(flashloanAmount);
    console.log("   AAVE Flash Loan fee %d", flashLoanFee);
    // how much WETH we need to repay falsh loan
    let repayAmount = flashloanAmount.add(flashLoanFee);
    console.log("   After SWAP, need %s WETH to repay the flash loan", repayAmount.toString());
    // how much USD we need to repay falsh loan ()
    let repayAmountUSD = repayAmount.mul(WETHPrice).div(ethers.utils.parseUnits("1.0", 18));
    console.log("   borrow $%s WETH from Compound to repay the flash loan", num2Fixed(repayAmountUSD, 8));
    let needBorrowAmount = adoptTokenDicimals(calcNeedBorrowAmount(repayAmountUSD, USDCPrice), 8, 6).add(1);
    console.log("   borrow %s USDC from Compound to repay the flash loan", num2Fixed(needBorrowAmount, 6));
    console.log("");

    // 160bps = 1.6%
    // this is too high, check !!!
    let slippage = 20;
    // let slipPercent: number = slippage / 10000 * 100;
    const slippageTolerance = new Percent(slippage, 10_000);

    console.log("   User's slippage = %d%", slippageTolerance.toFixed());
    let amountInMax = getAmountInleast(needBorrowAmount, slippage);
    console.log("       According to the slippage, the max input should be = %d", num2Fixed(amountInMax, 6));


    const {mValue, single, path} = await quoterUniswap('USDC', 'WETH', repayAmount.toString(), slippage, true, false);
    const maximumAmount = mValue;
    // const single = true;
    // const amountIn = '11073514753';
    // const path = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

    const asset: string = WETHAddress;
    const amount: ethers.BigNumber = flashloanAmount;
    let amountIn = maximumAmount;
    console.log(amountIn);
    
    // params: single+amountInMaximum+path+selector, bool+uint256+bytes+bytes4
    const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, amountIn, path, "0x16d1fb86"]);
    console.log("params: ", params)

    await allowFlashLoanContract(fakeSigner, flashLoanProxy.address);

    const tx3 = await AAVE_POOL.connect(fakeSigner).flashLoanSimple(
        flashLoanProxy.address,
        asset,
        amount,
        params,
        0,
    );

    let borrowBalanceOf = await COMET.borrowBalanceOf(fakeSigner.address);
    console.log("After leverage, user borrowBalanceOf is: ", borrowBalanceOf);
    userCollateralBalance = await COMET.collateralBalanceOf(fakeSigner.address, WETHAddress);
    console.log("After leverage, user collateral balance is: ", userCollateralBalance);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
