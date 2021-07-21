//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { FanTicketV2 } from "./FanTicketV2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";


contract FanTicketFactory is Ownable, EIP712 {
    /**
        ___  ___     _          _   _      _                      _    
        |  \/  |    | |        | \ | |    | |                    | |   
        | .  . | ___| |_ __ _  |  \| | ___| |___      _____  _ __| | __
        | |\/| |/ _ \ __/ _` | | . ` |/ _ \ __\ \ /\ / / _ \| '__| |/ /
        | |  | |  __/ || (_| | | |\  |  __/ |_ \ V  V / (_) | |  |   < 
        \_|  |_/\___|\__\__,_| \_| \_/\___|\__| \_/\_/ \___/|_|  |_|\_\
     */
    string public BASED_ON = "https://meta.io";
    address public managerRegistry;
    mapping(string => address) public symbolToAddress;
    mapping(uint32 => address) public tokenIdToAddress;
    bytes32 public constant salt = keccak256("Meta Network FanTicket");
    bytes32 public constant NETWORK_ADMIN_ROLE = keccak256("NETWORK_ADMIN_ROLE");
    bytes32 public constant CREATION_PERMIT_TYPEHASH =
        keccak256("CreationPermit(string name,string symbol,address owner,uint256 initialSupply,uint32 tokenId)");

    event NewFanTicket(
        string indexed symbol,
        string name,
        address tokenAddress
    );

    constructor(address _managerRegistry) EIP712("FanTicketFactory", "1") {
        managerRegistry = _managerRegistry;
    }

    function computeCreationCodeWithArgs(
        string memory _name,
        string memory _symbol
    ) public view returns (bytes memory result) {
        result = abi.encodePacked(
            tokenCreationCode(),
            abi.encode(_name, _symbol)
        );
    }

    function computeAddress(string memory _name, string memory _symbol)
        public
        view
        returns (address predictedAddress)
    {
        /// This complicated expression just tells you how the address
        /// can be pre-computed. It is just there for illustration.
        /// You actually only need ``new D{salt: salt}(arg)``.
        bytes32 digest = keccak256(
                    abi.encodePacked(
                        hex"ff",
                        address(this),
                        salt,
                        keccak256(computeCreationCodeWithArgs(_name, _symbol))
                    )
        );
        predictedAddress = address(
            uint160(
                uint256(digest)
            )
        );
    }

    function _newFanTicket(
        string memory _name,
        string memory _symbol,
        address owner,
        uint256 initialSupply
    ) internal returns(address newToken) {
        FanTicketV2 _token = new FanTicketV2{salt: salt}(
            _name,
            _symbol
        );
        _token.init(owner, initialSupply);
        newToken = address(_token);
        symbolToAddress[_symbol] = newToken;
        emit NewFanTicket(_name, _symbol, newToken);
    }

    function newAPeggedToken(
        string calldata name,
        string calldata symbol,
        address owner,
        uint256 initialSupply,
        uint32 tokenId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(symbolToAddress[symbol] == address(0), "Token have been created on this factory");

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            CREATION_PERMIT_TYPEHASH,
            keccak256(bytes(name)),
            keccak256(bytes(symbol)),
            owner,
            initialSupply,
            tokenId
        )));
        address signer = ECDSA.recover(digest, v, r, s);
        bool isPermitSignerAdmin =
            IAccessControl(managerRegistry).hasRole(NETWORK_ADMIN_ROLE, signer);
        require(
            // Permit signer must be the admin in the manager Registry
            isPermitSignerAdmin,
            "FanTicketFactory::INVALID_SIGNATURE: The signer is not admin."
        );
        // Create it if signature was right
        address newTokenAddress = _newFanTicket(name, symbol, owner, initialSupply);
        tokenIdToAddress[tokenId] = newTokenAddress;
    }
    function tokenCreationCode() public view returns (bytes memory) {
        return type(FanTicketV2).creationCode;
    }
}