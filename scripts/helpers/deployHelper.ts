import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { hre } from '../constant';
import {
    cUSDC_comet_ADDRESS,
    poolAddressProvider,
    USDCAddress,
    V3_SWAP_ROUTER_ADDRESS,
} from '../address';
import { ethers } from 'ethers';


/**
 * Deploys all the contracts for flashLoan and returns the flashLoanProxy contract object.
 * @param signer The signer required for deployment.
 * @returns The flashLoanProxy contract object.
 */
export const deployAll = async (signer: SignerWithAddress) => {
    const pathLib = await deployPathLibrary(signer);
    const swapLogic = await deploySwapLogicLibrary(signer);
    const flashLoan = await deployFlashLoan(signer, pathLib, swapLogic)
    const flashLoanProxy = await deployFlashLoanProxy(signer, flashLoan.address);

    return flashLoanProxy;
}

export const deployFlashLoanProxy = async (signer: SignerWithAddress, implementation: string) => {
    const flashLoanProxyFact = await hre.ethers.getContractFactory("FlashLoanProxy");
    const data = encodeInitData();
    let flashLoanProxy = await flashLoanProxyFact.connect(signer).deploy(implementation, data);
    await flashLoanProxy.deployed();
    console.log(
        `flashLoanProxy deployed to ${flashLoanProxy.address}`
    );

    return flashLoanProxy;
}

export const deployFlashLoan = async (signer: SignerWithAddress, pathLib: ethers.Contract, swapLogic: ethers.Contract) => {
    let flashLoanFact = await hre.ethers.getContractFactory("FlashLoan", {
        libraries: {
            Path: pathLib.address,
            swapLogic: swapLogic.address
        }
    });
    var flashLoan = await flashLoanFact.connect(signer).deploy();
    await flashLoan.deployed();
    console.log(
        `flash loan deployed to ${flashLoan.address}`
    );
    return flashLoan;
}

export const deployPathLibrary = async (signer: SignerWithAddress) => {
    const pathLibraryFact = await hre.ethers.getContractFactory("Path");
    const pathLibrary = await pathLibraryFact.connect(signer).deploy();
    await pathLibrary.deployed();
    console.log(
        `Path library deployed to ${pathLibrary.address}`
    );
    return pathLibrary;
}

export const deploySwapLogicLibrary = async (signer: SignerWithAddress) => {
    const swapLogicLibraryFact = await hre.ethers.getContractFactory("SwapLogic");
    const swapLogicLibrary = await swapLogicLibraryFact.connect(signer).deploy();
    await swapLogicLibrary.deployed();
    console.log(
        `SwapLogic library deployed to ${swapLogicLibrary.address}`
    );
    return swapLogicLibrary;
}

const encodeInitData = () => {
    let data = ethers.utils.defaultAbiCoder.encode(["address", "address", "address", "address"],
        [poolAddressProvider, cUSDC_comet_ADDRESS, V3_SWAP_ROUTER_ADDRESS, USDCAddress]);
    data = ethers.utils.solidityPack(["bytes4", "bytes"], ["0xf8c8765e", data]);

    return data;
}
