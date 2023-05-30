import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { hre } from '../constant';
import {
    bulker_ADDRESS,
    cUSDC_comet_ADDRESS,
    poolAddressProvider,
    USDCAddress,
    V3_SWAP_ROUTER_ADDRESS,
    WETH_GATEWAY_ADDRESS,
} from '../address';
import { ethers } from 'ethers';
import { ContractNames, deployAndSave } from './contracts-helps';

/**
 * Deploys all the contracts for flashLoan and returns the flashLoanProxy contract object.
 * @param signer The signer required for deployment.
 * @returns The flashLoanProxy contract object.
 */
export const deployAll = async (signer: SignerWithAddress) => {
    const pathLib = await deployPathLibrary(signer);
    const swapLogic = await deploySwapLogicLibrary(signer, pathLib);
    const flashLoan = await deployFlashLoan(signer, pathLib, swapLogic)
    const flashLoanProxy = await deployFlashLoanProxy(signer, flashLoan.address);
    const flashLoanGateway = await deployFlashLoanGateway(signer, pathLib,swapLogic)

    return {flashLoanProxy, flashLoanGateway};
}

export const deployFlashLoanProxy = async (signer: SignerWithAddress, implementation: string) => {
    const flashLoanProxyFact = await hre.ethers.getContractFactory("FlashLoanProxy");
    const data = encodeInitData();
    const flashLoanProxy = await flashLoanProxyFact.connect(signer).deploy(implementation, data);
    
    return deployAndSave(
        flashLoanProxy,
        ContractNames.FlashLoanProxy
    )
}

export const deployFlashLoan = async (signer: SignerWithAddress, pathLib: ethers.Contract, swapLogic: ethers.Contract) => {
    const flashLoanFact = await hre.ethers.getContractFactory("FlashLoan", {
        libraries: {
            Path: pathLib.address,
            SwapLogic: swapLogic.address
        }
    });
    const flashLoan = await flashLoanFact.connect(signer).deploy();
    
    return deployAndSave(
        flashLoan,
        ContractNames.FlashLoan
    )
}

export const deployFlashLoanGateway = async (signer: SignerWithAddress, pathLib: ethers.Contract, swapLogic: ethers.Contract) => {
    const flashLoanGatewayFact = await hre.ethers.getContractFactory("FlashLoanGateway", {
        libraries: {
            Path: pathLib.address,
            SwapLogic: swapLogic.address
        }
    });
    let flashLoanGateway = await flashLoanGatewayFact.connect(signer).deploy(poolAddressProvider, V3_SWAP_ROUTER_ADDRESS, cUSDC_comet_ADDRESS, WETH_GATEWAY_ADDRESS, bulker_ADDRESS);
    
    return deployAndSave(
        flashLoanGateway,
        ContractNames.FlashLoanGateway
    )
}

export const deployPathLibrary = async (signer: SignerWithAddress) => {
    const pathLibraryFact = await hre.ethers.getContractFactory("Path");
    const pathLibrary = await pathLibraryFact.connect(signer).deploy();
    
    return deployAndSave(
        pathLibrary,
        ContractNames.Path
    )
}

export const deploySwapLogicLibrary = async (signer: SignerWithAddress, pathLib: ethers.Contract) => {
    const swapLogicLibraryFact = await hre.ethers.getContractFactory("SwapLogic", {
        libraries: {
            Path: pathLib.address
        }
    });
    const swapLogicLibrary = await swapLogicLibraryFact.connect(signer).deploy();
    
    return deployAndSave(
        swapLogicLibrary,
        ContractNames.SwapLogic
    )
}

const encodeInitData = () => {
    let data = ethers.utils.defaultAbiCoder.encode(["address", "address", "address", "address"],
        [poolAddressProvider, cUSDC_comet_ADDRESS, V3_SWAP_ROUTER_ADDRESS, USDCAddress]);
    data = ethers.utils.solidityPack(["bytes4", "bytes"], ["0xf8c8765e", data]);

    return data;
}
