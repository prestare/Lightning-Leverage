import { Contract, Signer, ethers, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    AAVE_POOL_ADDRESS,
    AAVE_Price_Oricle_Address,
    WETH_GATEWAY_ADDRESS,
    AAVE_Pool_Data_Provider_Address,
    WETHAddress
} from "../address";
import {
    aTokenAbi,
    debtTokenABI,
    erc20,
    WETHGateABI
} from "../ABI";
import { hre } from "../constant";
import { getLtv } from "./aaveConfigHelper";
import { adoptTokenDicimals, calcLeveragePosition, calcNeedBorrowAmount, calcNeedBorrowValue, calcUserAssetValue, getMaxLeverage } from "./leverage";

export var AAVE_POOL: Contract;
export var AAVE_POOL_DATA_PROVIDER: Contract;
export var WETH_GATEWAY: Contract;
export var AavePriceOricle: Contract;
// export var ;

export const initAAVEContract = async (signer: Signer) => {
    let poolAbi = await (await hre.artifacts.readArtifact("IPool")).abi;
    let poolDataProviderAbi = await (await hre.artifacts.readArtifact("IPoolDataProvider")).abi;
    AAVE_POOL = new ethers.Contract(AAVE_POOL_ADDRESS, poolAbi, signer);
    AAVE_POOL_DATA_PROVIDER = new ethers.Contract(AAVE_Pool_Data_Provider_Address, poolDataProviderAbi, signer);
    WETH_GATEWAY = new ethers.Contract(WETH_GATEWAY_ADDRESS, WETHGateABI, signer);
}

export const aTokenContract = (aTokenAddress: string, signer: Signer) => {
    return (new ethers.Contract(aTokenAddress, aTokenAbi, signer));
}

export const getApprovePermit = async (token: Contract, signer: SignerWithAddress, spender: string, value: string) => {
    const nonces = await token.nonces(signer.address);

    const MainnetId = "1";
    const domain = {
        name: await token.name(),
        version: "1",
        chainId: MainnetId,
        verifyingContract: token.address
    }

    const types = {
        Permit: [{
            name: "owner",
            type: "address"
        },
        {
            name: "spender",
            type: "address"
        },
        {
            name: "value",
            type: "uint256"
        },
        {
            name: "nonce",
            type: "uint256"
        },
        {
            name: "deadline",
            type: "uint256"
        },
        ],
    };

    const deadline = Math.floor(Date.now() / 1000) + 4200;
    const values = {
        owner: signer.address,
        spender: spender,
        value: value,
        nonce: nonces,
        deadline: deadline,
    };

    const signature = await signer._signTypedData(domain, types, values);
    const sig = ethers.utils.splitSignature(signature);

    return { deadline, sig };
}

export const getAssetDebtTokenAddress = async (asset: string) => {
    return (await AAVE_POOL.getReserveData(asset)).variableDebtTokenAddress;
}

export const getAssetATokenAddress = async (asset: string) => {
    return (await AAVE_POOL.getReserveData(asset)).aTokenAddress;
}

export const debtTokenContract = (debtTokenAddress: string, signer: Signer) => {
    return (new ethers.Contract(debtTokenAddress, debtTokenABI, signer));
}

export const ERC20Contract = (tokenAddress: string, signer: Signer) => {
    return (new ethers.Contract(tokenAddress, erc20, signer));
}

// Before helping user to flash loan, user need to approve us to borrow on behalf of their account
export const apporve2Borrow = async (debtToken: Contract, user: Signer, flashLoanAddress: string, amount: BigNumber) => {
    const approveDebt = await debtToken.connect(user).approveDelegation(flashLoanAddress, amount);
    return;
}

export const checkBorrowAllowance = async (debtToken: Contract, userAddress: string, flashLoanAddress: string) => {
    const borrowAllowance = await debtToken.borrowAllowance(userAddress, flashLoanAddress);
    console.log("borrowAllowance is ", borrowAllowance);
}

export const initAavePriceOracle = async (signer: Signer) => {
    let priceOricleABI = await (await hre.artifacts.readArtifact("IAaveOracle")).abi;
    AavePriceOricle = new ethers.Contract(AAVE_Price_Oricle_Address, priceOricleABI, signer);
}

export const getAssetPriceOnAAVE = async (asset: string) => {
    let price = await AavePriceOricle.getAssetPrice(asset);
    return price;
}

export const getUserATokenBalance = async (aToken: Contract, userAddress: string) => {
    return (await aToken.balanceOf(userAddress));
}

export const getUserDebtTokenBalance = async (asset: string, userAddress: string, interestRateMode: number) => {
    const userReserveData = await AAVE_POOL_DATA_PROVIDER.getUserReserveData(asset, userAddress);
    return userReserveData[interestRateMode];
}

export const getMaxLeverageOnAAVE = async (asset: string, POOL: Contract, TokenName: string) => {
    let assetConfig = (await POOL.getConfiguration(asset)).data;
    let assetLTV = getLtv(assetConfig);
    // MAX Leverage = 1 / (1 - LTV)
    let maxleverage = await getMaxLeverage(assetLTV);
    console.log("   According to the AAVE %s Asset Configuration:", TokenName);
    console.log("       The Maximum leverage abilidity = ", maxleverage.toString());
    return maxleverage;
}

export const calcFlashLoanFee = async (amount: BigNumber) => {
    let Premium = await AAVE_POOL.FLASHLOAN_PREMIUM_TOTAL();
    let fee = amount.mul(Premium).div(10000);
    return fee;
}

export const calcFlashLoanAmountByRepayAmount = async (amount: BigNumber) => {
    const Premium = await AAVE_POOL.FLASHLOAN_PREMIUM_TOTAL();
    const flashLoanAmount = amount.mul(10000).div(Premium.add(10000));
    return flashLoanAmount;
}

export const depositToAave = async (signer: SignerWithAddress, accountAddress: string, assetAddress: string, amount: BigNumber) => {
    const aTokenAddress = await getAssetATokenAddress(assetAddress);
    const aToken = aTokenContract(aTokenAddress, signer);

    const balance = await getUserATokenBalance(aToken, accountAddress);
    console.log("asset address: ", assetAddress);
    console.log(`Before deposit, the ${accountAddress}'s balance: ${balance.toString()}`);

    console.log("Now, User deposit %d to AAVE", amount);
    if (assetAddress == WETHAddress) {
        await WETH_GATEWAY.connect(signer).depositETH(accountAddress, accountAddress, 0, { value: amount }); // the first params is useless
    } else {
        await AAVE_POOL.connect(signer).supply(assetAddress, amount, accountAddress, 0);
    }

    console.log("After Deposit...");
    // check if we actually have one aWETH
    const aTokenBalance = await getUserATokenBalance(aToken, accountAddress);
    console.log(`After deposit, the ${accountAddress}'s balance: ${balance.toString()}`);
}

export const calcUserAaveMaxLeverage = async (signer: Signer, accountAddress: string, assetAddress: string) => {
    const aTokenAddress = await getAssetATokenAddress(assetAddress);
    const aToken = aTokenContract(aTokenAddress, signer);
    const aTokenDecimal = await aToken.decimals();

    console.log("User address: ", accountAddress);
    console.log("Asset address: ", assetAddress);
    console.log("Now calculate user max leverage...");
    let assetPrice = await getAssetPriceOnAAVE(assetAddress);

    let userBalance = await getUserATokenBalance(aToken, accountAddress);
    const assetValue = await calcUserAssetValue(userBalance, assetPrice, aTokenDecimal);

    let maxleverage = await getMaxLeverageOnAAVE(assetAddress, AAVE_POOL, "");
    // WETH Value * MAX Leverage = MAX Borrow Cap 
    let maxBorrowCap = assetValue.mul(maxleverage);
    console.log("       The MAX amount of position (in USD)  = $%d", ethers.utils.formatUnits(maxBorrowCap, 8).toString());

    return {assetValue, maxleverage, maxBorrowCap};
}

export const calcUserLeverFlashLoanAave = async (signer: Signer, accountAddress: string, leverage: number,
    depositAssetAddress: string, longAssetAddress: string, shortAssetAddress: string) => {
    const aTokenAddress = await getAssetATokenAddress(depositAssetAddress);
    const aToken = aTokenContract(aTokenAddress, signer);
    let aTokenDecimal = await aToken.decimals();

    let depositAssetPrice = await getAssetPriceOnAAVE(depositAssetAddress!);
    let userBalance = await getUserATokenBalance(aToken, accountAddress);
    const depositValue = await calcUserAssetValue(userBalance, depositAssetPrice, aTokenDecimal);

    let shortAssetPrice = await getAssetPriceOnAAVE(shortAssetAddress);
    let shortAsstToken = ERC20Contract(shortAssetAddress, signer);
    let shortAssetDecimal = await shortAsstToken.decimals();

    let longAssetPrice = await getAssetPriceOnAAVE(longAssetAddress!);
    let longAssetToken = ERC20Contract(longAssetAddress, signer);
    let longAssetDecimal = await longAssetToken.decimals();

    console.log("   short asset: ", shortAssetAddress);
    console.log("   short asset price: ", num2Fixed(shortAssetPrice, 8));
    console.log("   long asset: ", longAssetAddress);
    console.log("   long asset price: ", num2Fixed(longAssetPrice, 8));
    console.log("   leverage: ", leverage);

    let newPosition = calcLeveragePosition(depositValue, leverage);
    console.log("       user want to leverage up their position to $%d", newPosition.toString());
    let needBorrowAmountUSD = calcNeedBorrowValue(depositValue, leverage);
    console.log("       so user need to flash loan (in USDC) = $%d", ethers.utils.formatUnits(needBorrowAmountUSD, 8).toString());

    let needBorrowAmount = calcNeedBorrowAmount(needBorrowAmountUSD, shortAssetPrice);
    console.log("       so user need to borrow short asset Amount = %d", ethers.utils.formatUnits(needBorrowAmount, 8).toString());
    let flashLoanAmount = adoptTokenDicimals(needBorrowAmount, 8, shortAssetDecimal);
    console.log("       so flash loan Amount = %s", flashLoanAmount.toString());

    let needSwapLongAssetAmount = calcNeedBorrowAmount(needBorrowAmountUSD, longAssetPrice);
    let needSwapLongAsset = adoptTokenDicimals(needSwapLongAssetAmount, 8, longAssetDecimal);
    console.log("   After swap, we need %s long asset to deposit into the Platform", num2Fixed(needSwapLongAsset, 18));

    return {
        flashLoanAmount,
        needSwapLongAsset,
    }
}

// export interface AccountData {
//     totalCollateralBase : BigNumber;
//     totalDebtBase : BigNumber;
//     availableBorrowsBase : BigNumber;
//     currentLiquidationThreshold : BigNumber;
//     ltv : BigNumber;
//     healthFactor : BigNumber;
// }
export const getTotalCollateralBase = (accountData: any): BigNumber => {
    return accountData[0];
}

export const getTotalDebtBase = (accountData: any): BigNumber => {
    return accountData[1];
}

export const showUserAccountData = async (accountData: any) => {
    console.log("");
    console.log("User Account Data:");
    // console.log(accountData[0]);
    console.log("totalCollateralBase =", num2Fixed(accountData[0], 8));
    console.log("totalDebtBase =", num2Fixed(accountData[1], 8));
    console.log("availableBorrowsBase =", num2Fixed(accountData[2], 8));
    console.log("currentLiquidationThreshold = %d%", num2Fixed(accountData[3], 2));
    console.log("ltv = %d%", num2Fixed(accountData[4], 2));
}

export const num2Fixed = (number: BigNumber, decimal: number): string => {
    return ethers.utils.formatUnits(number, decimal).toString()
}

