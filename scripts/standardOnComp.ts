import { ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import {
    WETHAddress,
    WALLET_ADDRESS,
} from './address';
import { hre } from "./constant";
import { deployAll } from "./helpers/deployHelper";

import {
    initCompContract,

    getMaxLeverageOnComp,
    allowFlashLoanContract,
    depositToComp,
    calcUserLeverFlashLoanComp,
} from './helpers/compHelper';
import {
    initAAVEContract,
    initAavePriceOracle,
    calcFlashLoanFee,
    AAVE_POOL,

} from "./helpers/aaveHelper";
import {
    quoterUniswap
} from "./helpers/UniswapQuoter";
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
    await depositToComp(fakeSigner, fakeSigner.address, WETHAddress, depositAmount, true);

    let { assetValue, maxleverage } = await getMaxLeverageOnComp(fakeSigner, fakeSigner.address, WETHAddress);

    let userleverage = 4;
    const { flashLoanAmount } = await calcUserLeverFlashLoanComp(fakeSigner, WETHAddress, fakeSigner.address, userleverage);

    console.log("");
    console.log("Calculate flash loan fee and slippage");
    let flashLoanFee = await calcFlashLoanFee(flashLoanAmount);
    console.log("   AAVE Flash Loan fee %d", flashLoanFee);
    // how much WETH we need to repay falsh loan
    let repayAmount = flashLoanAmount.add(flashLoanFee);
    console.log("   After SWAP, need %s WETH to repay the flash loan", repayAmount.toString());
    // how much USD we need to repay falsh loan ()



    let slippage = 20;
    const { mValue, single, path } = await quoterUniswap('USDC', 'WETH', repayAmount.toString(), slippage, true, false);
    const maximumAmount = mValue;
    // const single = true;
    // const amountIn = '11073514753';
    // const path = 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

    const asset: string = WETHAddress;
    const amount: ethers.BigNumber = flashLoanAmount;
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
    let userCollateralBalance = await COMET.collateralBalanceOf(fakeSigner.address, WETHAddress);
    console.log("After leverage, user collateral balance is: ", userCollateralBalance);

}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
