import { BigNumber } from "ethers";
import { COMET } from "./compHelper";

interface AssetInfo {
    offset: BigNumber;
    asset: String;
    priceFeed: String;
    scale: BigNumber;
    borrowCollateralFactor: BigNumber;
    liquidateCollateralFactor: BigNumber;
    liquidationFactor:BigNumber;
    supplyCap: BigNumber;
}

export const getAssetInfo = async (assetAddress: string) => {
    return (await COMET.getAssetInfoByAddress(assetAddress));
}

export const getAssetOffset = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    return assetInfo.offset;
}

export const getAssetPriceFeed = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    return assetInfo.priceFeed;
}

export const getAssetScale = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    return assetInfo.scale;
}

export const getAssetCF = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    // borrowCollateralFactor is scaled up by 10^18
    // it need to convert it to the bps form 
    return assetInfo.borrowCollateralFactor.div(10 ** 14).toString();
}

export const getAssetLiquidCF = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    return assetInfo.liquidateCollateralFactor;
}

export const getAssetLiquFactor = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    return assetInfo.liquidationFactor;
}

export const getAssetSupplyCap = async (assetAddress: string) => {
    let assetInfo: AssetInfo = await getAssetInfo(assetAddress);
    return assetInfo.supplyCap;
}
