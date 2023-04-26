import { ethers } from "hardhat";
import { BigNumber } from 'ethers';
import { DaiAddress, WETHAddress } from '../scripts/address';
import {
    initAAVEContract,
    AAVE_POOL, WETH_GATEWAY,
    debtTokenContract,
    getAssetDebtTokenAddress,
    apporve2Borrow,
} from "../scripts/helpers/aaveHelper";
import {
    initCompContract,
    supplyWETH,
    allowFlashLoanContract,
} from '../scripts/helpers/compHelper';
import { deployFlashLoan } from "../scripts/helpers/deployHelper";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("comp", function () {
    async function beforeCompFixture() {
        const [fakeSigner] = await ethers.getSigners();
        const flashLoan = await deployFlashLoan(fakeSigner);

        await initAAVEContract(fakeSigner);
        await initCompContract(fakeSigner);
        console.log(" finish to init contracts");

        const depositAmount = ethers.utils.parseUnits("2", "ether");
        await supplyWETH(fakeSigner, depositAmount);
        console.log(" finish to supplyETH");

        let flashloanAmount = BigNumber.from("6000000000000000000");


        return { flashLoan, fakeSigner, flashloanAmount }
    }

    it("long WETH", async function () {
        const { flashLoan, fakeSigner, flashloanAmount } = await loadFixture(beforeCompFixture);

        const asset: string = WETHAddress;
        const amount: ethers.BigNumber = flashloanAmount;

        let amountIn = "9644492283"
        const single = true;
        const path = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, amountIn, path, "0x16d1fb86"]);


        await allowFlashLoanContract(fakeSigner, flashLoan.address);

        const gas = await AAVE_POOL.connect(fakeSigner).estimateGas.flashLoanSimple(
            flashLoan.address,
            asset,
            amount,
            params,
            0,
        );
        console.log("estimateGas: ", gas);
    })
})

describe("aave", function () {
    async function beforeAaveFixture() {
        const [fakeSigner] = await ethers.getSigners();
        const flashLoan = await deployFlashLoan(fakeSigner);

        await initAAVEContract(fakeSigner);
        console.log(" finish to initAAVEContract");

        const depositAmount = ethers.utils.parseUnits("2", "ether");
        await WETH_GATEWAY.connect(fakeSigner).depositETH(fakeSigner.address, fakeSigner.address, 0, { value: depositAmount });
        console.log(" finish to depositETH");

        let flashloanAmount = BigNumber.from("11477534063880000000000");

        const debtTokenAddress = await getAssetDebtTokenAddress(DaiAddress);
        console.log(" finish to getAssetDebtTokenAddress");

        const debtToken = debtTokenContract(debtTokenAddress, fakeSigner);
        await apporve2Borrow(debtToken, fakeSigner, flashLoan.address, flashloanAmount);
        console.log("finish to approve2Borrow")

        return { flashLoan, fakeSigner, flashloanAmount }
    }

    it("long WETH", async function () {
        const { flashLoan, fakeSigner, flashloanAmount } = await loadFixture(beforeAaveFixture);

        const assets: string[] = [DaiAddress,];
        const amounts: ethers.BigNumber[] = [flashloanAmount,];
        const interestRateModes: ethers.BigNumber[] = [BigNumber.from("2"),];


        const single = true;
        const minimumAmount = "5269674485762893556";
        const path = "0x6b175474e89094c44da98b954eedeac495271d0f0001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

        const params = ethers.utils.solidityPack(["bool", "uint256", "bytes", "bytes4"], [single, minimumAmount.toString(), path, "0x80ddec56"]);



        const gas = await AAVE_POOL.connect(fakeSigner).estimateGas.flashLoan(
            flashLoan.address,
            assets,
            amounts,
            interestRateModes,
            fakeSigner.address,
            params,
            0,
        );
        console.log("estimateGas: ", gas);
    })
})

// aave old gas 713000; new gas 708160; new2 612974
// comp new gas 586971; new2 550576