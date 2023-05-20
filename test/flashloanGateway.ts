import { ethers } from "hardhat";
import { BigNumber } from 'ethers';
import { DaiAddress, USDCAddress, WETHAddress } from '../scripts/address';
import {
    initAAVEContract,
    debtTokenContract,
    getAssetDebtTokenAddress,
    apporve2Borrow,
    initAavePriceOracle,
    calcLeverFlashLoanAaveByBalance,
    calcFlashLoanFee,
} from "../scripts/helpers/aaveHelper";
import {
    initCompContract,
    allowFlashLoanContract,
    calcLeverFlashLoanCompByBalance,
} from '../scripts/helpers/compHelper';
import { deployAll } from "../scripts/helpers/deployHelper";
import { impersonateAccount, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { quoterUniswap } from "../scripts/helpers/UniswapQuoter";
import { WethABI, erc20 } from "../scripts/ABI";
import { hre } from "../scripts/constant";

// blockNumber: 17301320
describe("aaveDeposit", function () {
    const longAsset = WETHAddress;
    const longSymbol = 'WETH';
    const shortAsset = DaiAddress;
    const shortSymbol = 'DAI';

    async function beforeFixture() {
        const fakeAddress = "0x820C79D0B0c90400cdD24d8916f5BD4d6fBA4cC3" // the account which has enough dai
        await impersonateAccount(fakeAddress); // impersonate the account which has enough dai

        const [signer] = await ethers.getSigners();
        const fakeSigner = await hre.ethers.getSigner(fakeAddress);
        const { flashLoanProxy, flashLoanGateway } = await deployAll(signer);

        await initAAVEContract(signer);
        await initAavePriceOracle(signer);

        const depositAmount = ethers.utils.parseUnits("2", "ether");

        return { signer, fakeSigner, flashLoanProxy, flashLoanGateway, depositAmount }
    }

    it("deposit ETH, long WETH and short Dai", async function () {
        const { signer, flashLoanProxy, flashLoanGateway, depositAmount } = await loadFixture(beforeFixture);

        const leverage = 4;
        const { flashLoanAmount } = await calcLeverFlashLoanAaveByBalance(signer, depositAmount, leverage, longAsset, longAsset, shortAsset);

        const slippage = 20;
        // const { mValue, single, path } = await quoterUniswap(shortSymbol, longSymbol, flashLoanAmount.toString(), slippage, false, false);
        // const minimumAmount = mValue;

        const assets: string[] = [shortAsset];
        const amounts: BigNumber[] = [flashLoanAmount];
        const interestRateModes: BigNumber[] = [BigNumber.from('2')];

        const single = true;
        const minimumAmount = "5974347323631483246"
        const path = "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, minimumAmount, path, "0x80ddec56"]);


        const debtTokenAddress = await getAssetDebtTokenAddress(shortAsset);
        const debtToken = debtTokenContract(debtTokenAddress, signer);
        await apporve2Borrow(debtToken, signer, flashLoanGateway.address, flashLoanAmount);

        const gas = await flashLoanGateway.connect(signer).estimateGas.depositETHAaveAndFlashLoan(
            {
                receiverAddress: flashLoanProxy.address,
                assets: assets,
                amounts: amounts,
                interestRateModes: interestRateModes,
                onBehalfOf: signer.address,
                params: params,
                referralCode: 0
            },
            {
                value: depositAmount
            }
        );
        console.log("estimateGas: ", gas);
    });

    it("deposit WETH, long WETH and short Dai", async function () {
        const { signer, flashLoanProxy, flashLoanGateway, depositAmount } = await loadFixture(beforeFixture);

        // deposit ETH and get WETH
        const WETH = new ethers.Contract(WETHAddress, WethABI, signer);
        await WETH.connect(signer).deposit({value: depositAmount});
        await WETH.connect(signer).approve(flashLoanGateway.address, depositAmount);

        const leverage = 4;
        const { flashLoanAmount } = await calcLeverFlashLoanAaveByBalance(signer, depositAmount, leverage, longAsset, longAsset, shortAsset);

        // const slippage = 20;
        // const { mValue, single, path } = await quoterUniswap(shortSymbol, longSymbol, flashLoanAmount.toString(), slippage, false, false);
        // const minimumAmount = mValue;

        const assets: string[] = [shortAsset];
        const amounts: BigNumber[] = [flashLoanAmount];
        const interestRateModes: BigNumber[] = [BigNumber.from('2')];

        const single = true;
        const minimumAmount = "5974347323631483246"
        const path = "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, minimumAmount, path, "0x80ddec56"]);


        const debtTokenAddress = await getAssetDebtTokenAddress(shortAsset);
        const debtToken = debtTokenContract(debtTokenAddress, signer);
        await apporve2Borrow(debtToken, signer, flashLoanGateway.address, flashLoanAmount);

        const gas = await flashLoanGateway.connect(signer).estimateGas.depositAaveAndFlashLoan(
            {
                asset: longAsset,
                amount: depositAmount
            },
            {
                receiverAddress: flashLoanProxy.address,
                assets: assets,
                amounts: amounts,
                interestRateModes: interestRateModes,
                onBehalfOf: signer.address,
                params: params,
                referralCode: 0
            },
        );
        console.log("estimateGas: ", gas);
    });
    it("deposit Dai and swap to WETH, long WETH and short Dai", async function () {
        const { fakeSigner, flashLoanProxy, flashLoanGateway } = await loadFixture(beforeFixture);
        const depositAmount = ethers.utils.parseUnits("2000", "ether");


        // deposit ETH and get WETH
        const Dai = new ethers.Contract(DaiAddress, erc20, fakeSigner);
        await Dai.connect(fakeSigner).approve(flashLoanGateway.address, depositAmount);

        const slippage = 20;
        // const swapInfo1= await quoterUniswap('DAI', longSymbol, depositAmount.toString(), slippage, false, false);
        const swapInfo1 = {
            mValue: "1097742708277481551",
            single: true,
            path: "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        }
        const swapParams = {
            amount: depositAmount,
            amountM: swapInfo1.mValue,
            single: swapInfo1.single,
            recipient: flashLoanGateway.address,
            path: swapInfo1.path
        }

        const leverage = 4;
        const { flashLoanAmount } = await calcLeverFlashLoanAaveByBalance(fakeSigner, BigNumber.from(swapInfo1.mValue), leverage, longAsset, longAsset, shortAsset);

        // const swapInfo2 = await quoterUniswap(shortSymbol, longSymbol, flashLoanAmount.toString(), slippage, false, false);
        const swapInfo2 = {
            mValue: "3279549594636825031",
            single: true,
            path: "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        }
        const single = swapInfo2.single;
        const minimumAmount = swapInfo2.mValue;
        const path = swapInfo2.path;

        const assets: string[] = [shortAsset];
        const amounts: BigNumber[] = [flashLoanAmount];
        const interestRateModes: BigNumber[] = [BigNumber.from('2')];

        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, minimumAmount, path, "0x80ddec56"]);


        const debtTokenAddress = await getAssetDebtTokenAddress(shortAsset);
        const debtToken = debtTokenContract(debtTokenAddress, fakeSigner);
        await apporve2Borrow(debtToken, fakeSigner, flashLoanGateway.address, flashLoanAmount);

        const gas = await flashLoanGateway.connect(fakeSigner).estimateGas.swapDepositAaveAndFlashLoan(
            swapParams,
            {
                receiverAddress: flashLoanProxy.address,
                assets: assets,
                amounts: amounts,
                interestRateModes: interestRateModes,
                onBehalfOf: fakeSigner.address,
                params: params,
                referralCode: 0
            },
        );
        console.log("estimateGas: ", gas);
    })
});


describe("compDeposit", function () {

    const longAsset = WETHAddress;
    const longSymbol = 'WETH';
    const shortAsset = USDCAddress;
    const shortSymbol = 'USDC';

    async function beforeCompFixture() {
        const fakeAddress = "0x820C79D0B0c90400cdD24d8916f5BD4d6fBA4cC3" // the account which has enough dai
        await impersonateAccount(fakeAddress); // impersonate the account which has enough dai

        const [signer] = await ethers.getSigners();
        const fakeSigner = await hre.ethers.getSigner(fakeAddress);
        const { flashLoanProxy, flashLoanGateway } = await deployAll(signer);

        await initAAVEContract(signer);
        await initAavePriceOracle(signer);
        await initCompContract(signer);

        const depositAmount = ethers.utils.parseUnits("2", "ether");

        return { signer, fakeSigner, flashLoanProxy, flashLoanGateway, depositAmount }
    }

    it("deposit ETH, long WETH and short Dai", async function () {
        const { signer, flashLoanProxy, flashLoanGateway, depositAmount } = await loadFixture(beforeCompFixture);

        // deposit ETH and get WETH
        const WETH = new ethers.Contract(WETHAddress, WethABI, signer);
        await WETH.connect(signer).deposit({value: depositAmount});
        await WETH.connect(signer).approve(flashLoanGateway.address, depositAmount);

        const leverage = 4;
        const { flashLoanAmount } = await calcLeverFlashLoanCompByBalance(signer, longAsset, depositAmount, leverage);
        const flashLoanFee = await calcFlashLoanFee(flashLoanAmount);
        const repayAmount = flashLoanAmount.add(flashLoanFee);

        const slippage = 20;
        // const { mValue, single, path } = await quoterUniswap(shortSymbol,  longSymbol, repayAmount.toString(), slippage, true, false);
        // const maximumAmount = mValue;

        const single = true;
        const maximumAmount = "10934245989"
        const path = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
        const asset: string = longAsset;
        const amount: BigNumber = flashLoanAmount;
        const amountIn = maximumAmount;


        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, amountIn, path, "0x16d1fb86"]);


        await allowFlashLoanContract(signer, flashLoanProxy.address);

        const gas = await flashLoanGateway.connect(signer).estimateGas.depositCompAndFlashLoanSimple(
            {
                asset: longAsset,
                amount: depositAmount
            },
            {
                receiverAddress: flashLoanProxy.address,
                asset: asset,
                amount: amount,
                params: params,
                referralCode: 0
            },
        );
        console.log("gas: ", gas);
    });

    it("deposit WETH, long WETH and short Dai", async function () {
        const { signer, flashLoanProxy, flashLoanGateway, depositAmount } = await loadFixture(beforeCompFixture);

        const leverage = 4;
        const { flashLoanAmount } = await calcLeverFlashLoanCompByBalance(signer, longAsset, depositAmount, leverage);
        const flashLoanFee = await calcFlashLoanFee(flashLoanAmount);
        const repayAmount = flashLoanAmount.add(flashLoanFee);

        const slippage = 20;
        // const { mValue, single, path } = await quoterUniswap(shortSymbol,  longSymbol, repayAmount.toString(), slippage, true, false);
        // const maximumAmount = mValue;

        const single = true;
        const maximumAmount = "10934245989"
        const path = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
        const asset: string = longAsset;
        const amount: BigNumber = flashLoanAmount;
        const amountIn = maximumAmount;


        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, amountIn, path, "0x16d1fb86"]);


        await allowFlashLoanContract(signer, flashLoanProxy.address);

        const gas = await flashLoanGateway.connect(signer).estimateGas.depositETHCompAndFlashLoanSimple(
            {
                receiverAddress: flashLoanProxy.address,
                asset: asset,
                amount: amount,
                params: params,
                referralCode: 0
            },
            {
                value: depositAmount
            }
        );
        console.log("gas: ", gas);
    });

    it("deposit Dai and swap to WETH, long WETH and short Dai", async function () {
        const { fakeSigner, flashLoanProxy, flashLoanGateway } = await loadFixture(beforeCompFixture);
        const depositAmount = ethers.utils.parseUnits("2000", "ether");


        // deposit ETH and get WETH
        const Dai = new ethers.Contract(DaiAddress, erc20, fakeSigner);
        await Dai.connect(fakeSigner).approve(flashLoanGateway.address, depositAmount);

        const slippage = 20;
        // const swapInfo1= await quoterUniswap('DAI', longSymbol, depositAmount.toString(), slippage, false, false);
        const swapInfo1 = {
            mValue: "1097742708277481551",
            single: true,
            path: "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        }
        const swapParams = {
            amount: depositAmount,
            amountM: swapInfo1.mValue,
            single: swapInfo1.single,
            recipient: flashLoanGateway.address,
            path: swapInfo1.path
        }

        const leverage = 4;
        const { flashLoanAmount } = await calcLeverFlashLoanCompByBalance(fakeSigner, longAsset, BigNumber.from(swapInfo1.mValue), leverage);
        const flashLoanFee = await calcFlashLoanFee(flashLoanAmount);
        const repayAmount = flashLoanAmount.add(flashLoanFee);

        // const swapInfo2 = await quoterUniswap(shortSymbol,  longSymbol, repayAmount.toString(), slippage, true, false);
        const swapInfo2 = {
            mValue: "6009073737",
            single: true,
            path: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
        }

        const single = swapInfo2.single;
        const maximumAmount = swapInfo2.mValue;
        const path = swapInfo2.path;

        const asset: string = longAsset;
        const amount: BigNumber = flashLoanAmount;
        const amountIn = maximumAmount;


        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, amountIn, path, "0x16d1fb86"]);


        await allowFlashLoanContract(fakeSigner, flashLoanProxy.address);

        const gas = await flashLoanGateway.connect(fakeSigner).swapDepositCompAndFlashLoanSimple(
            swapParams,
            {
                receiverAddress: flashLoanProxy.address,
                asset: asset,
                amount: amount,
                params: params,
                referralCode: 0
            },
        );
        console.log("gas: ", gas);
    })
});