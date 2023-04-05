// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.10;

interface IWETH {
  function deposit() external payable;

  function withdraw(uint256 wad) external;

  function approve(address guy, uint256 wad) external returns (bool);

  function balanceOf(address) external returns (uint256);

  function transferFrom(
    address src,
    address dst,
    uint256 wad
  ) external returns (bool);
}
