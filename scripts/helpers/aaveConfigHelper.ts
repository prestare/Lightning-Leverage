import { BigNumber } from "ethers";

const LTV_MASK =                       "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000"; 
const LIQUIDATION_THRESHOLD_MASK =     "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000FFFF"; 
const LIQUIDATION_BONUS_MASK =         "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000FFFFFFFF"; 
const DECIMALS_MASK =                  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00FFFFFFFFFFFF"; 
const ACTIVE_MASK =                    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFF"; 
const FROZEN_MASK =                    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFDFFFFFFFFFFFFFF"; 
const BORROWING_MASK =                 "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFBFFFFFFFFFFFFFF"; 
const STABLE_BORROWING_MASK =          "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF7FFFFFFFFFFFFFF"; 
const PAUSED_MASK =                    "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFFFFFFFFFFF"; 
const BORROWABLE_IN_ISOLATION_MASK =   "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFDFFFFFFFFFFFFFFF"; 
const SILOED_BORROWING_MASK =          "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFBFFFFFFFFFFFFFFF"; 
const RESERVE_FACTOR_MASK =            "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF0000FFFFFFFFFFFFFFFF"; 
const BORROW_CAP_MASK =                "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF000000000FFFFFFFFFFFFFFFFFFFF"; 
const SUPPLY_CAP_MASK =                "0xFFFFFFFFFFFFFFFFFFFFFFFFFF000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFF"; 
const LIQUIDATION_PROTOCOL_FEE_MASK =  "0xFFFFFFFFFFFFFFFFFFFFFF0000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"; 
const EMODE_CATEGORY_MASK =            "0xFFFFFFFFFFFFFFFFFFFF00FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"; 
const UNBACKED_MINT_CAP_MASK =         "0xFFFFFFFFFFF000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"; 
const DEBT_CEILING_MASK =              "0xF0000000000FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"; 

const LIQUIDATION_THRESHOLD_START_BIT_POSITION = 16;
const LIQUIDATION_BONUS_START_BIT_POSITION = 32;
const RESERVE_DECIMALS_START_BIT_POSITION = 48;
const IS_ACTIVE_START_BIT_POSITION = 56;
const IS_FROZEN_START_BIT_POSITION = 57;
const BORROWING_ENABLED_START_BIT_POSITION = 58;
const STABLE_BORROWING_ENABLED_START_BIT_POSITION = 59;
const IS_PAUSED_START_BIT_POSITION = 60;
const BORROWABLE_IN_ISOLATION_START_BIT_POSITION = 61;
const SILOED_BORROWING_START_BIT_POSITION = 62;
/// @dev bit 63 reserved

const RESERVE_FACTOR_START_BIT_POSITION = 64;
const BORROW_CAP_START_BIT_POSITION = 80;
const SUPPLY_CAP_START_BIT_POSITION = 116;
const LIQUIDATION_PROTOCOL_FEE_START_BIT_POSITION = 152;
const EMODE_CATEGORY_START_BIT_POSITION = 168;
const UNBACKED_MINT_CAP_START_BIT_POSITION = 176;
const DEBT_CEILING_START_BIT_POSITION = 212;

export const getLtv = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const LTV: bigint = (configInt & ~BigInt(LTV_MASK));
    return LTV;
}

export const getLiquidationThreshold = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const liquThreshold: bigint = (configInt & ~BigInt(LIQUIDATION_THRESHOLD_MASK)) >> BigInt(LIQUIDATION_THRESHOLD_START_BIT_POSITION);
    return liquThreshold;
}

export const getLiquidationBonus = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const LiquidationBonus: bigint = (configInt & ~BigInt(LIQUIDATION_BONUS_MASK)) >> BigInt(LIQUIDATION_BONUS_START_BIT_POSITION);
    return LiquidationBonus;
}

export const getDecimals = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const decimals: bigint = (configInt & ~BigInt(DECIMALS_MASK)) >> BigInt(RESERVE_DECIMALS_START_BIT_POSITION);
    return decimals;
}
export const getActive = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const active: bigint = configInt & ~BigInt(ACTIVE_MASK);
    return (active != 0n);
}

export const getFrozen = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const frozen: bigint = configInt & ~BigInt(FROZEN_MASK);
    return (frozen != 0n);
}

export const getPaused = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const pause: bigint = configInt & ~BigInt(PAUSED_MASK);
    return (pause != 0n);
}

export const getBorrowableInIsolation = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const borrowableInIsolation: bigint = configInt & ~BigInt(BORROWABLE_IN_ISOLATION_MASK);
    return (borrowableInIsolation != 0n);
}

export const getSiloedBorrowing = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const siloedBorrowing: bigint = configInt & ~BigInt(SILOED_BORROWING_MASK);
    return (siloedBorrowing != 0n);
}

export const getBorrowingEnabled = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const borrowingEnabled: bigint = configInt & ~BigInt(BORROWING_MASK);
    return (borrowingEnabled != 0n);
}

export const getStableRateBorrowingEnabled = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const stableRateBorrowingEnabled: bigint = configInt & ~BigInt(STABLE_BORROWING_MASK);
    return (stableRateBorrowingEnabled != 0n);
}

export const getReserveFactor = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const reserveFactor: bigint = (configInt & ~BigInt(RESERVE_FACTOR_MASK)) >> BigInt(RESERVE_FACTOR_START_BIT_POSITION);
    return reserveFactor;
}

export const getBorrowCap = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const borrowCap: bigint = (configInt & ~BigInt(BORROW_CAP_MASK)) >> BigInt(BORROW_CAP_START_BIT_POSITION);
    return borrowCap;
}

export const getSupplyCap = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const supplyCap: bigint = (configInt & ~BigInt(SUPPLY_CAP_MASK)) >> BigInt(SUPPLY_CAP_START_BIT_POSITION);
    return supplyCap;
}

export const getDebtCeiling = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const debtCeiling: bigint = (configInt & ~BigInt(DEBT_CEILING_MASK)) >> BigInt(DEBT_CEILING_START_BIT_POSITION);
    return debtCeiling;
}

export const getLiquidationProtocolFee = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const liquidationProtocolFee: bigint = (configInt & ~BigInt(LIQUIDATION_PROTOCOL_FEE_MASK)) >> BigInt(LIQUIDATION_PROTOCOL_FEE_START_BIT_POSITION);
    return liquidationProtocolFee;
}

export const getUnbackedMintCap = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const unbackedMintCap: bigint = (configInt & ~BigInt(UNBACKED_MINT_CAP_MASK)) >> BigInt(UNBACKED_MINT_CAP_START_BIT_POSITION);
    return unbackedMintCap;
}

export const getEModeCategory = (config: BigNumber) => {
    const configInt: bigint = config.toBigInt();
    const EModeCategory: bigint = (configInt & ~BigInt(EMODE_CATEGORY_MASK)) >> BigInt(EMODE_CATEGORY_START_BIT_POSITION);
    return EModeCategory;
}





