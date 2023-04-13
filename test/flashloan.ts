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
    async function beforeAaveFixture() {
        const [fakeSigner] = await ethers.getSigners();
        const flashLoan = await deployFlashLoan(fakeSigner);

        await initAAVEContract(fakeSigner);
        await initCompContract(fakeSigner);
        console.log(" finish to init contracts");

        const depositAmount = ethers.utils.parseUnits("2", "ether");
        await supplyWETH(fakeSigner, depositAmount);
        console.log(" finish to supplyETH");

        let flashloanAmount = BigNumber.from("6000000000000000000");
        let flashLoanFee = BigNumber.from("3000000000000000");
        let repayAmount = flashloanAmount.add(flashLoanFee);

        return { flashLoan, fakeSigner, repayAmount }
    }

    it("long WETH", async function () {
        const { flashLoan, fakeSigner, repayAmount } = await loadFixture(beforeAaveFixture);

        let flashloanAmount = BigNumber.from("6000000000000000000");

        const assets: string[] = [WETHAddress,];
        const amounts: ethers.BigNumber[] = [flashloanAmount,];
        const interestRateModes: ethers.BigNumber[] = [BigNumber.from("0"),];

        let amountIn = "11581602299"
        const single = true;
        const path = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";


        let params = ethers.utils.defaultAbiCoder.encode(["tuple(bytes,bool,uint256,uint256)", "uint256"], [[path, single, amountIn, repayAmount.toString()], flashloanAmount]);
        params = ethers.utils.solidityPack(["bytes4", "bytes"], ["0xfe235f79", params]);


        await allowFlashLoanContract(fakeSigner, flashLoan.address);

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


        const single = false;
        const minimumAmount = "5000000000000000000";
        const path = "0x6b175474e89094c44da98b954eedeac495271d0f000064dac17f958d2ee523a2206206994597c13d831ec70001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";


        // function AaveOperation(bool single,uint256 amountIn,uint256 minimumAmount,bytes memory path)
        let params = ethers.utils.defaultAbiCoder.encode(["tuple(bytes,bool,uint256,uint256)"], [[path, single, flashloanAmount, minimumAmount.toString()]]);
        params = ethers.utils.solidityPack(["bytes4", "bytes"], ["0x8ecfaae0", params]);



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

// aave old gas 713000; new gas 708160
// comp new gas 586971