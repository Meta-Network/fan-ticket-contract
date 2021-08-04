//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IFanTicketV2.sol";


contract FanTicketV2 is IFanTicketV2, ERC20, ERC20Permit, AccessControl {
    address public factory;
    bool initialized = false;
    // Create a new role identifier for the minter role
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    // hash for EIP712
    bytes32 public constant _MINT_PERMIT_TYPEHASH =
        keccak256("Mint(address minter,address to,uint256 value,uint256 nonce,uint256 deadline)");
    bytes32 public constant _TRANFER_TYPEHASH =
        keccak256("Transfer(address from,address to,uint256 value,uint256 nonce,uint256 deadline)");

    constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
        factory = msg.sender;
    }

    function init(address _owner, uint256 initialSupply) public {
        require(!initialized, "already initialized");
        require(factory == msg.sender, "Init should be called from factory contract.");
        _setupRole(MINTER_ROLE, _owner);
        _mint(_owner, initialSupply);
    }

    modifier isSignatureNotDead(uint256 deadline) {
        require(block.timestamp <= deadline, "ERC20Permit::signature expired deadline");
        _;
    }

    function mint(address to, uint256 value) public override onlyRole(MINTER_ROLE) {
        _mint(to, value);
    }

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
        bytes32 structHash = keccak256(abi.encode(_MINT_PERMIT_TYPEHASH, minter, to, value, _useNonce(minter), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);

        require(signer == minter, "ERC20Permit::mint: invalid signature");
        require(hasRole(MINTER_ROLE, signer), "mint: you are not the minter");

        _mint(to, value);
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