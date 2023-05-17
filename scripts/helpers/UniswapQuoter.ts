import {
    SwapOptionsSwapRouter02,
    SwapRoute,
    SwapType,
} from '@uniswap/smart-order-router';
import { pack } from '@ethersproject/solidity'
import { Pool, Route } from '@uniswap/v3-sdk';
import { TradeType, CurrencyAmount, Currency, Percent, SupportedChainId, Token } from '@uniswap/sdk-core';
import { WALLET_ADDRESS } from "../address";
import {
    router,
    alphaRouterConfig,
    WETH_TOKEN,
    WBTC_TOKEN,
    USDC_TOKEN,
    DAI_TOKEN
} from "../constant";
import JSBI from 'jsbi';

let tokenMap = new Map();


let keys = ["WETH", "WBTC", "USDC", "DAI"];
let tokens = [WETH_TOKEN, WBTC_TOKEN, USDC_TOKEN, DAI_TOKEN]

for (let i = 0; i < keys.length && i < tokens.length; i++) {
    registryToken(keys[i], tokens[i])
}



export function registryToken(key: string, token: Token) {
    tokenMap.set(key, token);
}

export function getToken(key: string): Token {
    return tokenMap.get(key)
}

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
    // console.log("Begin to route");
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

export async function swapRouteExactOutPut(inToken: string, amountOut: string, outToken: string, slippageTolerance: Percent): Promise<SwapRoute | null> {
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
    // console.log("Begin to route");
    return router.route(
        CurrencyAmount.fromRawAmount(
            OUT_TOKEN,
            amountOut
        ),
        IN_TOKEN,
        TradeType.EXACT_OUTPUT,
        options,
        alphaRouterConfig
    )
}

export const quoterUniswap = async (fromToken:string, toToken:string, amount:string, slippage: number, exactOut: boolean, encodePathExactOut: boolean) => {
    console.log("");
    console.log("Quoter Asset Swap");
    const slippageTolerance = new Percent(slippage, 10_000);
    let route;
    
    if (exactOut) {
        route = await swapRouteExactOutPut(
            fromToken,
            amount,
            toToken,
            slippageTolerance
        )
    } else {
        route = await swapRoute(
            fromToken,
            amount,
            toToken,
            slippageTolerance
          );
    }
    
    console.log("slippage Torlerance: %s",slippageTolerance.toFixed())
    const toTokenObj = getToken(toToken);

    return processRoute(route!, slippageTolerance, toTokenObj, exactOut, encodePathExactOut);
}

export const processRoute = (route: SwapRoute, slippageTolerance: Percent, toToken: Token, exactOut: boolean, encodePathExactOut: boolean) => {
    if (route == null || route.methodParameters == undefined) throw 'No route loaded';

    let mValue; // minimumAmount or maximumAmount, according to `exactOut`
    const { route: routePath} = route.trade.swaps[0];
    const path = encodeRouteToPath(routePath, encodePathExactOut);

    if (exactOut) {
        const {inputAmount} = route.trade.swaps[0];
        mValue = route.trade.maximumAmountIn(slippageTolerance, inputAmount).quotient.toString();
        console.log(`   You'll pay: ${inputAmount.toFixed()} of ${toToken.symbol}`);
        console.log(`   maximum Input Amount: ${mValue}`);
    } else {
        const {outputAmount} = route.trade.swaps[0];
        mValue = route.trade.minimumAmountOut(slippageTolerance, outputAmount).quotient.toString();
        console.log(`   You'll get ${outputAmount.toFixed()} of ${toToken.symbol}`);
        console.log(`   minimum Output Amount: ${mValue}`);
    }

    console.log(`   route path: ${path}`);
    // output quote minus gas fees
    console.log(`   Gas Adjusted Quote: ${route.quoteGasAdjusted.toFixed()}`);
    console.log(`   Gas Used Quote Token: ${route.estimatedGasUsedQuoteToken.toFixed()}`);
    console.log(`   Gas Used USD: ${route.estimatedGasUsedUSD.toFixed()}`);
    console.log(`   Gas Used: ${route.estimatedGasUsed.toString()}`);
    console.log(`   Gas Price Wei: ${route.gasPriceWei}`);

    const paths = route.route[0].tokenPath.map(value => value.symbol);

    console.log(`   route paths: ${paths}`);
    console.log(`   trade: ${route.trade}`);
    const single = paths.length == 2;
    return {
        mValue,
        single,
        path
    }
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