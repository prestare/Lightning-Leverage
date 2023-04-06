import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Signer } from 'ethers';
import { hre } from '../constant';
import { 
    poolAddressProvider, 
    V3_SWAP_ROUTER_ADDRESS,
} from '../address';

export const deployFlashLoan =async (signer: SignerWithAddress) => {
    let flashLoanFact = await hre.ethers.getContractFactory("FlashLoan");
    var flashLoan = await flashLoanFact.connect(signer).deploy(poolAddressProvider, V3_SWAP_ROUTER_ADDRESS, signer.address);
    await flashLoan.deployed();
    console.log(
        `flash loan deployed to ${flashLoan.address}`
      );
    return flashLoan;
}
