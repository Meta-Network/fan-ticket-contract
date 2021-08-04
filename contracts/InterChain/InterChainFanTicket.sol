//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "../FanTicketV2.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract InterChainFanTicket is FanTicketV2 {
    bytes32 public constant NETWORK_ADMIN_ROLE =
        keccak256("NETWORK_ADMIN_ROLE");
    bytes32 public constant _BURN_PERMIT_TYPEHASH =
        keccak256("Burn(address from,uint256 value,uint256 nonce,uint256 deadline)");

    event InterChainFanTicketBurnt(address indexed who, uint256 value);

    address public managerRegistry;

    constructor(string memory name, string memory symbol) FanTicketV2(name, symbol) {}

    function init(address _interChainOperator, uint256 _usedForOverride) public override {
        require(!initialized, "init: already initialized");
        require(factory == msg.sender, "Init should be called from factory contract.");
        _setupRole(MINTER_ROLE, _interChainOperator);
    }

    function setManagerRegistry(address _managerRegistry) public {
        require(managerRegistry == address(0), "managerRegistry was set");
        managerRegistry = _managerRegistry;
    }

    function burnBySig(
        address from,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public isSignatureNotDead(deadline) returns (bool) {
        // reuse the `nonce` property, as nonce only associated with the signer
        bytes32 structHash = keccak256(
            abi.encode(_BURN_PERMIT_TYPEHASH, from, amount, _useNonce(from), deadline)
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == from, "InterChainFanPiao::burnBySig: invalid signature");
        _burn(from, amount);

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
        bytes32 structHash = keccak256(abi.encode(_MINT_PERMIT_TYPEHASH, minter, to, value, _useNonce(minter), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);

        bool isPermitSignerAdmin = IAccessControl(managerRegistry).hasRole(
            NETWORK_ADMIN_ROLE,
            signer
        );
        require(isPermitSignerAdmin, "InterChainFanTicket::mint: signer is not admin");


        _mint(to, value);
        return true;
    }
}