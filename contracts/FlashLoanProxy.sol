// SPDX-License-Identifier: No License
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";
import "./libraries/Errors.sol";
import "hardhat/console.sol";

contract FlashLoanProxy is Ownable {
    /**
     * @dev Storage slot with the address of the current implementation.
     * This is the keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1, and is
     * validated in the constructor.
     */
    bytes32 internal constant _IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address newImplementation, bytes memory data) {
        _setImplementation(newImplementation, data);
    }

    function getImplementation() external view returns (address) {
        return _getImplementation();
    }

    function setImplementation(
        address newImplementation,
        bytes memory data
    ) external onlyOwner {
        _setImplementation(newImplementation, data);
    }

    /**
     * @dev Returns the current implementation address.
     */
    function _getImplementation() internal view returns (address) {
        return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    /**
     * @dev Stores a new address in the EIP1967 implementation slot.
     */
    function _setImplementation(
        address newImplementation,
        bytes memory data
    ) private {
        require(
            Address.isContract(newImplementation),
            Errors.IMPLEMENTATION_NOT_CONTRACT
        );
        StorageSlot
            .getAddressSlot(_IMPLEMENTATION_SLOT)
            .value = newImplementation;
        Address.functionDelegateCall(newImplementation, data);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        address impl = _getImplementation();

        assembly {
            calldatacopy(0, 0, calldatasize())
            calldatacopy(0, add(params.offset, sub(params.length, 4)), 4) // 4: selector bytes4
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        address impl = _getImplementation();

        assembly {
            calldatacopy(0, 0, calldatasize())
            calldatacopy(0, add(params.offset, sub(params.length, 4)), 4) // 4: selector bytes4
            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}
}
