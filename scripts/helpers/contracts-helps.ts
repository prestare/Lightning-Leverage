import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import FileSync from 'lowdb/adapters/FileSync';
import low from 'lowdb';


const hre: HardhatRuntimeEnvironment = require('hardhat');

export const getDb = () => low(new FileSync('./deployed-contracts-flashloan.json'));

export enum ContractNames {
    Path = 'Path',
    SwapLogic = 'SwapLogic',
    FlashLoan = 'FlashLoan',
    FlashLoanProxy = 'FlashLoanProxy',
    FlashLoanGateway = 'FlashLoanGateway',
}

export const registerContractInJsonDb = async (contractId: string, contractInstance: Contract) => {
    const currentNetwork = hre.network.name;
    const FORK: boolean = process.env.FORK === 'true' ? true : false;
    if (FORK || (currentNetwork !== 'hardhat' && !currentNetwork.includes('coverage'))) {
        console.log(`*** ${contractId} ***\n`);
        console.log(`Network: ${currentNetwork}`);
        console.log(`tx: ${contractInstance.deployTransaction.hash}`);
        console.log(`contract address: ${contractInstance.address}`);
        console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
        console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
        console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
        console.log(`\n******`);
        console.log();
    }

    await getDb()
        .set(`${contractId}.${currentNetwork}`, {
            address: contractInstance.address,
            deployer: contractInstance.deployTransaction.from,
        })
        .write();
};

export const getDbProperty = async (contractId: string, network: string) => {
    // await getDb().read();
    // console.log(network);
    const result = getDb().get(`${contractId}.${network}`).value()
    // console.log(getDb().get(`ReserveLogic.${network}`).value());
    return result
}

export const rawInsertContractAddressInDb = async (id: string, address: string) =>
    await getDb()
        .set(`${id}.${hre.network.name}`, {
            address,
        })
        .write();

export const deployAndSave = async (
    contract: Contract,
    contractName: string,
): Promise<Contract> => {
    await contract.deployed();
    await registerContractInJsonDb(contractName, contract);
    return contract;
}

export const getPathLib = async (address?: string) => {
    const contractName = ContractNames.Path;
    return await getContract(contractName, address);
};

export const getSwapLogicLib = async (address?: string) => {
    const contractName = ContractNames.SwapLogic;
    return await getContract(contractName, address);
};

export const getFlashLoan = async (address?: string) => {
    const contractName = ContractNames.FlashLoan;
    return await getContract(contractName, address);
};

export const getFlashLoanProxy = async (address?: string) => {
    const contractName = ContractNames.FlashLoanProxy;
    return await getContract(contractName, address);
};

export const getFlashLoanGateway = async (address?: string) => {
    const contractName = ContractNames.FlashLoanGateway;
    return await getContract(contractName, address);
};

export const getContract = async (contractName: string, address?: string) => {
    return await (await hre.ethers.getContractFactory(contractName)).attach(
        address || (
            await getDb().get(`${contractName}.${hre.network.name}`).value()
        ).address,
    )
}