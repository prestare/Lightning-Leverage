import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { hre } from '../constant';
import {
    cUSDC_comet_ADDRESS,
    poolAddressProvider,
    USDCAddress,
    V3_SWAP_ROUTER_ADDRESS,
} from '../address';
import { ethers } from 'ethers';

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

export const deployFlashLoan = async (signer: SignerWithAddress, pathLib: ethers.Contract) => {
    let flashLoanFact = await hre.ethers.getContractFactory("FlashLoan", {
        libraries: {
            Path: pathLib.address
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

const encodeInitData = () => {
    let data = ethers.utils.defaultAbiCoder.encode(["address", "address", "address", "address"],
        [poolAddressProvider, cUSDC_comet_ADDRESS, V3_SWAP_ROUTER_ADDRESS, USDCAddress]);
    data = ethers.utils.solidityPack(["bytes4", "bytes"], ["0xf8c8765e", data]);

    return data;
}
