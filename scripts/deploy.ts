import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { BigNumber, Contract, ethers, Signer } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { impersonateAccount } from "@nomicfoundation/hardhat-network-helpers";
import { 
  poolAddressProvider, 
  WALLET_ADDRESS
} from './address';
import { deployFlashLoan } from './helpers/deployHelper';

const hre: HardhatRuntimeEnvironment = require('hardhat');
async function main() {
  await impersonateAccount(WALLET_ADDRESS);
  const fakeSigner: SignerWithAddress = await hre.ethers.getSigner(WALLET_ADDRESS);
  const flashLoan = await deployFlashLoan(fakeSigner);
  console.log("Now flash loan contract deployed to: ", flashLoan.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
