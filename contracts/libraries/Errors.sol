// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

library Errors {
    string public constant BYTES_OFFSET_OVERFLOW = '1'; // The offset of bytes is overflow
    string public constant BYTES_OFFSET_OUT_BOUNDS = '2'; // The offset of bytes is out of bounds
    string public constant APPROVE_FAILED = '3'; // The approve operation is failed
    string public constant ZERO_ADDRESS_NOT_VALID = '4'; // Zero address is not valid
    string public constant IS_INITIALIZED = '5'; // Contract is initialized
    string public constant IMPLEMENTATION_NOT_CONTRACT = '6'; // ERC1967: new implementation is not a contract

}
