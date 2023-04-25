// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import "./Errors.sol";

library Path {
    /// @dev The length of the bytes encoded address
    uint256 private constant ADDR_SIZE = 20;
    /// @dev The length of the bytes encoded fee
    uint256 private constant FEE_SIZE = 3;
    /// @dev The offset of a single token address and pool fee
    uint256 private constant NEXT_OFFSET = ADDR_SIZE + FEE_SIZE;
    /// @dev The offset of an encoded pool key
    uint256 private constant POP_OFFSET = NEXT_OFFSET + ADDR_SIZE;

    /// @notice Decodes the first pool in path
    /// @param path The bytes encoded swap path
    /// @return tokenA The first token of the given pool
    /// @return tokenB The second token of the given pool
    /// @return fee The fee level of the pool
    function decodeFirstPool(
        bytes memory path
    ) internal pure returns (address tokenA, address tokenB, uint24 fee) {
        tokenA = toAddress(path, 0);
        fee = toUint24(path, ADDR_SIZE);
        tokenB = toAddress(path, NEXT_OFFSET);
    }

    function decodeLastPool(
        bytes memory path
    ) internal pure returns (address tokenA, address tokenB, uint24 fee) {
        uint256 len = path.length;
        tokenA = toAddress(path, len - POP_OFFSET);
        fee = toUint24(path, len - NEXT_OFFSET);
        tokenB = toAddress(path, len - ADDR_SIZE);
    }

    /// @dev toAddress decodes bytes to address
    function toAddress(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (address) {
        require(_start + 20 >= _start, Errors.BYTES_OFFSET_OVERFLOW);
        require(_bytes.length >= _start + 20, Errors.BYTES_OFFSET_OUT_BOUNDS);
        address tempAddress;

        assembly {
            tempAddress := div(
                mload(add(add(_bytes, 0x20), _start)),
                0x1000000000000000000000000
            )
        }

        return tempAddress;
    }

    /// @dev toUint24 decodes bytes to uint24
    function toUint24(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (uint24) {
        require(_start + 3 >= _start, Errors.BYTES_OFFSET_OVERFLOW);
        require(_bytes.length >= _start + 3, Errors.BYTES_OFFSET_OUT_BOUNDS);
        uint24 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x3), _start))
        }

        return tempUint;
    }

    /// @dev toBool decodes bytes to bool
    function toBool(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (bool tempBool) {
        require(_start + 1 >= _start, Errors.BYTES_OFFSET_OVERFLOW);
        require(_bytes.length >= _start + 1, Errors.BYTES_OFFSET_OUT_BOUNDS);
        uint8 temp;

        assembly {
            temp := mload(add(add(_bytes, 0x1), _start))
        }

        if (temp == 1) {
            tempBool = true;
        }

        return tempBool;
    }

    /// @dev toUint256 decodes bytes to uint256
    function toUint256(
        bytes memory _bytes,
        uint256 _start
    ) internal pure returns (uint256) {
        require(_start + 32 >= _start, Errors.BYTES_OFFSET_OVERFLOW);
        require(_bytes.length >= _start + 32, Errors.BYTES_OFFSET_OUT_BOUNDS);
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }
}
