import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ethers } from 'hardhat';
import { SupportedChainId, Token } from '@uniswap/sdk-core';
import {
    WETHAddress,
    DaiAddress,
    USDCAddress,
} from './address';
import { 
    AlphaRouter,
    ChainId,
    AlphaRouterConfig
} from '@uniswap/smart-order-router';
import { Protocol } from '@uniswap/router-sdk';

export const hre: HardhatRuntimeEnvironment = require('hardhat');

export const WETH_TOKEN = new Token(
    SupportedChainId.MAINNET,
    WETHAddress,
    18,
    'WETH',
    'Wrapped Ether'
)

export const USDC_TOKEN = new Token(
    SupportedChainId.MAINNET,
    USDCAddress,
    6,
    'USDC',
    'USD//C'
)

export const DAI_TOKEN = new Token(
    SupportedChainId.MAINNET,
    DaiAddress,
    18,
    'DAI',
    'Dai Stablecoin'
)

export const mainnetUrl = 'https://eth-mainnet.g.alchemy.com/v2/azWjXVXAgsi9y3eCTE7hhJqfDfsNY8qC';
// export const mainnetUrl = 'http://127.0.0.1:8545/';

export const mainnetProvider = new ethers.providers.JsonRpcProvider(mainnetUrl);

export const router = new AlphaRouter({
    chainId: ChainId.MAINNET,
    provider: mainnetProvider,
})

export const alphaRouterConfig: AlphaRouterConfig = {
    maxSplits: 1,
    protocols: [Protocol.V3]
}

export const flashAssetList = {
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
}
