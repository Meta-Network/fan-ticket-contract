//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "../interfaces/IFanTicketV2.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import { IInterChainParking } from "../interfaces/IInterChainParking.sol";


contract InterChainParking is IInterChainParking, AccessControl, EIP712 {
    mapping(address => uint256) public depositsForToken;
    // token address => receiver address => nonce
    mapping(address => mapping(address => uint256)) public withdrawNonces;

    bytes32 public constant _WITHDRAW_PERMIT_TYPEHASH =
        keccak256(
            "Withdraw(address token,address to,uint256 value,uint256 nonce,uint256 deadline)"
        );

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");


    constructor(address _op) EIP712("InterChainParking", "1") {
        _setupRole(OPERATOR_ROLE, _op);
    }


    function deposit(
        address token,
        address sender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        IFanTicketV2(token).transferFromBySig(
            sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
        // solidity 0.8 enable SafeMath by default
        depositsForToken[token] += value;
    }

    function withdraw(
        address token,
        address who,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    _WITHDRAW_PERMIT_TYPEHASH,
                    token,
                    who,
                    value,
                    withdrawNonces[token][who]++,
                    deadline
                )
            )
        );
        address signer = ECDSA.recover(digest, v, r, s);
        require(hasRole(OPERATOR_ROLE, signer), "withdraw: Invalid signature");
        // solidity 0.8 enable SafeMath by default
        depositsForToken[token] -= value;
        IERC20(token).transfer(who, value);
    }
}
