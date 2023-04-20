// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.10;

import {IERC20} from '../IERC20.sol';


/**
 * @title IAToken
 * @author Aave
 * @notice Defines the basic interface for an AToken.
 */
interface IAToken is IERC20 {
    function permit(
    address owner,
    address spender,
    uint256 value,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;
}