import { BigNumber, ethers } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";

import { DaiAddress, WETHAddress, WALLET_ADDRESS} from './address';
import {
    initAavePriceOracle,
    initAAVEContract, 
    AAVE_POOL,
    debtTokenContract, 
    getAssetDebtTokenAddress, 
    apporve2Borrow, 
    checkBorrowAllowance,
    showUserAccountData,
    num2Fixed,
    getTotalCollateralBase,
    depositToAave,
    calcUserAaveMaxLeverage,
    calcUserLeverFlashLoanAave
} from "./helpers/aaveHelper";
import {deployAll} from "./helpers/deployHelper";
import {hre} from "./constant";
import {
  quoterUniswap
} from "./helpers/UniswapQuoter";

async function main() {

    await impersonateAccount(WALLET_ADDRESS);
    const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);

    const {flashLoanProxy} = await deployAll(fakeSigner);
    
    console.log("Now user address: ", fakeSigner.address);
  
    await initAAVEContract(fakeSigner);

    // deposit 2 ETH to aave
    const depositAmount = ethers.utils.parseUnits("2", "ether");
    await depositToAave(fakeSigner, fakeSigner.address, WETHAddress, depositAmount, true);

    // check user account data
    let accountData = await AAVE_POOL.getUserAccountData(fakeSigner.address);
    showUserAccountData(accountData);
    
    // console.log(AavePrices);
    // Price 小数位为8
    await initAavePriceOracle(fakeSigner);
    const {assetValue, maxBorrowCap} = await calcUserAaveMaxLeverage(fakeSigner, fakeSigner.address, WETHAddress);
    console.log("       The MAX amount of position (in USD)  = $%d", ethers.utils.formatUnits(maxBorrowCap, 8).toString());

    let userleverage = 4;
    const {flashLoanAmount} = await calcUserLeverFlashLoanAave(fakeSigner, fakeSigner.address, userleverage, WETHAddress, WETHAddress, DaiAddress);
    
    let slippage = 20;
    const {mValue, single, path} = await quoterUniswap('DAI', 'WETH', flashLoanAmount.toString(), slippage, false, false);
    const minimumAmount = mValue;
    // const minimumAmount = "5269674485762893556";
    // const path = "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
    // const single = true;

    // apporve flashloan to increase debt on fakesigner
    const debtTokenAddress = await getAssetDebtTokenAddress(DaiAddress);
    const debtToken = debtTokenContract(debtTokenAddress, fakeSigner);
    // it need to be approved by user, so contract can credit the debt to user address
    await apporve2Borrow(debtToken, fakeSigner, flashLoanProxy.address, flashLoanAmount); 
    await checkBorrowAllowance(debtToken, fakeSigner.address, flashLoanProxy.address);
    
    const assets : string[] = [DaiAddress,];
    const amounts : ethers.BigNumber[] = [flashLoanAmount, ]; 
    const interestRateModes : ethers.BigNumber[] = [BigNumber.from("2"), ];

    // params: single+amountOutMinimum+path, bool+uint256+bytes
    const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, minimumAmount, path, "0x80ddec56"]);

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
    let calcLeverage = userTotalCollaterBase.mul(1e8).div(assetValue)
    console.log("Now user leverage = %d", num2Fixed(calcLeverage, 8));
    // end
}
  
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
  