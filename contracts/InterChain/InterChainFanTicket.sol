//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "../interfaces/IFanTicketV2.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract InterChainFanTicket is IFanTicketV2, ERC20, ERC20Permit {
    address public factory;
    bool initialized = false;

    bytes32 public constant NETWORK_ADMIN_ROLE =
        keccak256("NETWORK_ADMIN_ROLE");

    // to => nonce
    mapping(address => uint256) public mintNonces;

    // hash for EIP712
    bytes32 public constant _MINT_PERMIT_TYPEHASH =
        keccak256("Mint(address minter,address to,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant _TRANFER_TYPEHASH =
        keccak256("Transfer(address from,address to,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant _BURN_PERMIT_TYPEHASH =
        keccak256("Burn(address from,address to,uint256 value,uint256 nonce,uint256 deadline)");

    event InterChainFanTicketMint(address indexed who, uint256 value);
    event InterChainFanTicketBurnt(address indexed who, address burntToTarget, uint256 value);

    address public managerRegistry;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
        factory = msg.sender;
    }

    function init(address _managerRegistry) public {
        require(!initialized, "init: already initialized");
        require(factory == msg.sender, "Init should be called from factory contract.");
        managerRegistry = _managerRegistry;
    }

    modifier isSignatureNotDead(uint256 deadline) {
        require(block.timestamp <= deadline, "ERC20Permit::signature expired deadline");
        _;
    }

    function mint(address to, uint256 value) external override {
        revert("Disabled direct mint for InterChainFanTicket");
    }

    function burnBySig(
        address from,
        address to,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public isSignatureNotDead(deadline) returns (bool) {
        // reuse the `nonce` property, as nonce only associated with the signer
        bytes32 structHash = keccak256(
            abi.encode(_BURN_PERMIT_TYPEHASH, from, to, amount, _useNonce(from), deadline)
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == from, "InterChainFanPiao::burnBySig: invalid signature");
        _burn(from, amount);

        emit InterChainFanTicketBurnt(from, to, amount);
        return true;
    }

    function burn(
        address to,
        uint256 amount
    ) public returns (bool) {
        _burn(msg.sender, amount);

        emit InterChainFanTicketBurnt(msg.sender, to, amount);
        return true;
    }

    /**
     * Minter here should be some admin
     */
    function mintBySig(
        address minter,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override isSignatureNotDead(deadline) returns (bool) {
        // reuse the `nonce` property, as nonce only associated with the signer
        bytes32 structHash = keccak256(abi.encode(_MINT_PERMIT_TYPEHASH, minter, to, value, mintNonces[to]++, deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);

        bool isPermitSignerAdmin = IAccessControl(managerRegistry).hasRole(
            NETWORK_ADMIN_ROLE,
            signer
        );
        require(isPermitSignerAdmin, "InterChainFanTicket::mint: signer is not admin");


        _mint(to, value);

        emit InterChainFanTicketMint(to, value);
        return true;
    }

    function transferFromBySig(
        address sender,
        address recipient,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override isSignatureNotDead(deadline) returns (bool) {
        // reuse the `nonce` property, as nonce only associated with the signer
        bytes32 structHash = keccak256(
            abi.encode(_TRANFER_TYPEHASH, sender, recipient, amount, _useNonce(sender), deadline)
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == sender, "ERC20Permit::transferFrom: invalid signature");
        _transfer(sender, recipient, amount);

        return true;
    }
}