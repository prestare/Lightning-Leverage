import {
    AlphaRouter,
    ChainId,
    SwapOptionsSwapRouter02,
    AlphaRouterConfig,
    SwapRoute,
    SwapType,
} from '@uniswap/smart-order-router';
import { pack } from '@ethersproject/solidity'
import { Protocol } from '@uniswap/router-sdk';
import { Pool, Route } from '@uniswap/v3-sdk';
import { TradeType, CurrencyAmount, Currency, Percent, SupportedChainId, Token } from '@uniswap/sdk-core';
import { Contract, ethers } from 'ethers'
import {
    V3_SWAP_ROUTER_ADDRESS,
    WETHAddress,
    DaiAddress,
    USDCAddress,
    WALLET_ADDRESS
} from './address';
import JSBI from 'jsbi';
import {
    WethABI
} from './ABI'

import { HardhatRuntimeEnvironment } from 'hardhat/types';

const hre: HardhatRuntimeEnvironment = require('hardhat');

const mainnetUrl = 'https://eth-mainnet.g.alchemy.com/v2/azWjXVXAgsi9y3eCTE7hhJqfDfsNY8qC';
// const mainnetUrl = "http://127.0.0.1:8545/";
const mainnetProvider = new ethers.providers.JsonRpcProvider(mainnetUrl);

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

const router = new AlphaRouter({
    chainId: ChainId.MAINNET,
    provider: mainnetProvider,
})

const alphaRouterConfig: AlphaRouterConfig = {
    maxSplits: 1,
    protocols: [Protocol.V3]
}

// async function main() {
//     const swapRouterAbi = await (await hre.artifacts.readArtifact("ISwapRouter")).abi;
//     const uniswapSwapRouter = new ethers.Contract(V3_SWAP_ROUTER_ADDRESS, swapRouterAbi);
//     const swapContract = await hre.ethers.getContractFactory("Swap");
    
//     const account = await hre.ethers.getSigner("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
//     const WETH = new ethers.Contract(WETHAddress, WethABI, account);
//     console.log(await mainnetProvider.getNetwork());
//     registryToken('WETH', WETH_TOKEN);
//     registryToken('USDC', USDC_TOKEN);
//     registryToken('DAI', DAI_TOKEN);

//     const amountIn = 1;
//     const realAmountIn = fromReadableAmount(
//         amountIn,
//         WETH_TOKEN.decimals
//     ).toString();
//     const slippageTolerance = new Percent(50, 10_1000);

//     const swap = await swapContract.deploy(V3_SWAP_ROUTER_ADDRESS);
//     await swap.deployed();
//     console.log(
//         `swap has been deployed at ${swap.address}`
//     )

//     const tx1 = await WETH.deposit({value: realAmountIn})
//     const WETHBalance1 = await WETH.balanceOf(account.address);
//     console.log("WETHB: ", WETHBalance1);

//     const approveAmount = fromReadableAmount(
//         2 * amountIn,
//         WETH_TOKEN.decimals
//     ).toString();
//     const tx2 = await WETH.approve(swap.address, approveAmount);
//     console.log('approve.')

//     const route = await swapRoute(
//         'WETH',
//         realAmountIn,
//         'USDC',
//         slippageTolerance
//     )

//     if (route == null || route.methodParameters == undefined) throw 'No route loaded';

//     console.log(...route.trade.swaps);
//     const { route: routePath, outputAmount } = route.trade.swaps[0];
//     const minimumAmount = route.trade.minimumAmountOut(slippageTolerance, outputAmount).quotient;
//     const path = encodeRouteToPath(routePath, false);

//     console.log(`minimum Amount: ${minimumAmount}`);
//     console.log(`route path: ${path}`);

//     console.log(`You'll get ${route.quote.toFixed()} of ${USDC_TOKEN.symbol}`);
//     // output quote minus gas fees
//     console.log(`Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
//     console.log(`Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
//     console.log(`Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
//     console.log(`Gas Used: ${route.estimatedGasUsed.toString()}`);
//     console.log(`Gas Price Wei: ${route.gasPriceWei}`);

//     const paths = route.route[0].tokenPath.map(value => value.symbol);
//     console.log(`route paths: ${paths}`);
//     console.log(`trade: ${route.trade}`);
//     const single = route.methodParameters.calldata.includes('5ae401dc');

//     let params = {
//         path: path,
//         single: single,
//         recipient: account.address,
//         amountIn: realAmountIn,
//         amountOutMinimum: minimumAmount.toString()
//     }

//     const amountOut1 = await swap.swap(params);
//     console.log("amountOut1: ", amountOut1);

//     const WETHBalance2 = await WETH.balanceOf(account.address);
//     console.log("WETHB: ", WETHBalance2);

//     params.single = false;
//     const amountOut11 = await swap.swap(params);
//     console.log("amountOut11: ", amountOut11);

//     const WETHBalance3 = await WETH.balanceOf(account.address);
//     console.log("WETHB: ", WETHBalance3);

// }

// // // We recommend this pattern to be able to use async/await everywhere
// // // and properly handle errors.
// main().catch((error) => {
//     console.error(error);
//     process.exitCode = 1;
// });

/**
 * Uses Uniswap's smart order router to compute optimal swap route.
 * @param inToken in token
 * @param amountIn the amount of input tokens to send
 * @param outToken out token
 * @param slippageTolerance tolerable slippage
 */
export async function swapRoute(inToken: string, amountIn: string, outToken: string, slippageTolerance: Percent): Promise<SwapRoute | null> {
    const IN_TOKEN = getToken(inToken);
    // console.log(IN_TOKEN);
    const OUT_TOKEN = getToken(outToken);
    // console.log(OUT_TOKEN);

    if (IN_TOKEN === undefined || OUT_TOKEN === undefined) throw 'incorrect inToken or outToken';

    const options: SwapOptionsSwapRouter02 = {
        recipient: WALLET_ADDRESS,
        slippageTolerance: slippageTolerance,
        deadline: Math.floor(Date.now() / 1000 + 1800),
        type: SwapType.SWAP_ROUTER_02
    }
    console.log("Begin to route");
    return router.route(
        CurrencyAmount.fromRawAmount(
            IN_TOKEN,
            amountIn
        ),
        OUT_TOKEN,
        TradeType.EXACT_INPUT,
        options,
        alphaRouterConfig
    )
}

/**
 * Converts a route to a hex encoded path
 * @param route the v3 path to convert to an encoded path
 * @param exactOutput whether the route should be encoded in reverse, for making exact output swaps
 */
export function encodeRouteToPath(route: Route<Currency, Currency>, exactOutput: boolean): string {
    const firstInputToken: Token = route.input.wrapped

    const { path, types } = route.pools.reduce(
        (
            { inputToken, path, types }: { inputToken: Token; path: (string | number)[]; types: string[] },
            pool: Pool,
            index
        ): { inputToken: Token; path: (string | number)[]; types: string[] } => {
            const outputToken: Token = pool.token0.equals(inputToken) ? pool.token1 : pool.token0
            if (index === 0) {
                return {
                    inputToken: outputToken,
                    types: ['address', 'uint24', 'address'],
                    path: [inputToken.address, pool.fee, outputToken.address]
                }
            } else {
                return {
                    inputToken: outputToken,
                    types: [...types, 'uint24', 'address'],
                    path: [...path, pool.fee, outputToken.address]
                }
            }
        },
        { inputToken: firstInputToken, path: [], types: [] }
    )

    return exactOutput ? pack(types.reverse(), path.reverse()) : pack(types, path)
}

/**
 * Converts readable amount to JSBI form
 * @param amount the number to count decimals
 * @param decimals currency decimals
 */
export function fromReadableAmount(amount: number, decimals: number): JSBI {
    const extraDigits = Math.pow(10, countDecimals(amount))
    const adjustedAmount = amount * extraDigits
    return JSBI.divide(
        JSBI.multiply(
            JSBI.BigInt(adjustedAmount),
            JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))
        ),
        JSBI.BigInt(extraDigits)
    )
}

/**
 * Counts decimals of a number
 * @param x the number to count decimals
 */
function countDecimals(x: number) {
    if (Math.floor(x) === x) {
        return 0
    }
    return x.toString().split('.')[1].length || 0
}