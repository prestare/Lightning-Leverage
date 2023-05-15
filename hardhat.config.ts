import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
const dotenv = require("dotenv");
dotenv.config();
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version:"0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        }
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },

  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: "https://eth-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_ID,
        // blockNumber: 16818600
      },
      gasPrice: 0,
      initialBaseFeePerGas: 0,
      loggingEnabled: false,
      // blockGasLimit: 150000000
    },
    local: {
      url: "http://127.0.0.1:8545/"
    },
    localhost: {
      url: "http://120.53.224.174:8545",
      chainId: 2,
    },
  }
};

export default config;
