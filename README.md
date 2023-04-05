# Lightning-Leverage
Leverage user position  with flash loan in diffenent lending platform


## AAVE
```
npx hardhat run .\scripts\deploy.ts --network hardhat
```

```
npx hardhat run .\scripts\deployAndLSD.ts --network hardhat
```

目前AAVE的价格是使用USD作为单位的，chainlink传输的价格保留8位小数的X/USD价格。
### AAVE资产
#### 可借出资产
- DAI
- LUSD
- USDC
- USDT
- cbETH
- CRV
- LINK
- rETH
- WBTC
- ETH
- wstETH

## Compound
目前Compound III可以使用WETH，WBTC,COMP,UNI,LINK作为抵押品，借出USDC，但是TVL比较低，而Compound v2的tvl比较高，但v2版本不支持代他人借贷，因此合约没法给compound加杠杆。
目前优先尝试使用compound v3

在考虑为Compound平台提供加杠杆功能时，需要考虑AAVE可以flash loan出什么资产，然后如何转化为Compound的抵押品，然后通过uniswap换回flash loan出的资产
### Compound资产

#### 可抵押资产
- ETH
- LINK
- COMP
- UNI
- WBTC

#### 可借出资产
- USDC
- WETH

## References

[Furucombo Flash Loan](https://docs.furucombo.app/using-furucombo-1/tutorials/flashloan-combo)

[AAVE Flash Loan](https://docs.aave.com/developers/guides/flash-loans)

[Sneak peek at Flash Loans](https://medium.com/aave/sneak-peek-at-flash-loans-f2b28a394d62)

[Uniswap V3 Flash](https://docs.uniswap.org/contracts/v3/guides/flash-integrations/calling-flash)

