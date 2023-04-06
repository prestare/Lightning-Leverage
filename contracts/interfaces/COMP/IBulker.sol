// SPDX-License-Identifier: NO LICENSE
pragma solidity ^0.8.0;

interface IBulker {
    /**
     * @title Bulker Action
     * uint public constant ACTION_SUPPLY_ASSET = 1;
     * uint public constant ACTION_SUPPLY_ETH = 2;
     * uint public constant ACTION_TRANSFER_ASSET = 3;
     * uint public constant ACTION_WITHDRAW_ASSET = 4;
     * uint public constant ACTION_WITHDRAW_ETH = 5;
     * uint public constant ACTION_CLAIM_REWARD = 6;
     */
    /**
     * @title Bulker data
     * address comet, address to,  uint amount
     */
    /**
     * @notice Executes a list of actions in order
     * @param actions The list of actions to execute in order
     * @param data The list of calldata to use for each action
     */
    function invoke(uint[] calldata actions, bytes[] calldata data) external payable;
}