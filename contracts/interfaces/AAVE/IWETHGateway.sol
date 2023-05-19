// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.10;

import {IERC20} from "../IERC20.sol";

/**
 * @title IAToken
 * @author Aave
 * @notice Defines the basic interface for an AToken.
 */
interface IWETHGateway {
    function depositETH(
        address,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;
}
