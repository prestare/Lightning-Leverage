// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

abstract contract IWstETH {
    /** 
     * @param _stETHAmount amount of stETH to wrap in exchange for wstETH
     * @return Amount of wstETH user receives after wrap
     */
    function wrap(uint256 _stETHAmount) external virtual returns (uint256);

    /**
     * @notice Exchanges wstETH to stETH
     * @param _wstETHAmount amount of wstETH to uwrap in exchange for stETH
     * @return Amount of stETH user receives after unwrap
     */
    function unwrap(uint256 _wstETHAmount) external virtual returns (uint256);

    // wstETH balanceOf is public not external
    // so cant use func balanceOf in IERC20
    function balanceOf(address account) public view virtual returns (uint256);

}