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
    alphaRouterConfig
} from "../constant";
import JSBI from 'jsbi';

var tokenMap = new Map();

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