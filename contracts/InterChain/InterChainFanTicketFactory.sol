//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {InterChainFanTicket} from "./InterChainFanTicket.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract InterChainFanTicketFactory is Ownable, EIP712 {
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
    
    // new fields for InterChain
    // Original Token's ChainId
    mapping(uint32 => uint256) public tokenIdToOriginChainId;
    // Original Token's addres
    mapping(uint32 => address) public tokenIdToOriginAddress;


    bytes32 public constant salt = keccak256("Meta Network InterChain-FanTicket");
    bytes32 public constant NETWORK_ADMIN_ROLE =
        keccak256("NETWORK_ADMIN_ROLE");
    bytes32 public constant CREATION_PERMIT_TYPEHASH =
        keccak256(
            "CreationPermit(address originAddress,string name,string symbol,uint32 tokenId,uint256 originChainId)"
        );

    event NewFanTicket(
        string indexed symbol,
        string name,
        address tokenAddress
    );

    constructor(address _managerRegistry) EIP712("InterChainFanTicketFactory", "1") {
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
        predictedAddress = address(uint160(uint256(digest)));
    }

    function _newFanTicket(
        string memory _name,
        string memory _symbol,
        address owner
    ) internal returns (address newToken) {
        InterChainFanTicket _token = new InterChainFanTicket{salt: salt}(_name, _symbol);
        _token.init(owner, 0);
        _token.setManagerRegistry(managerRegistry);
        newToken = address(_token);
        symbolToAddress[_symbol] = newToken;
        emit NewFanTicket(_symbol, _name, newToken);
    }

    function newFanTicket(
        string calldata name,
        string calldata symbol,
        address owner,
        uint32 tokenId,
        uint256 originChainId,
        address originAddress,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(
            symbolToAddress[symbol] == address(0),
            "Token have been created on this factory"
        );

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CREATION_PERMIT_TYPEHASH,
                    originAddress,
                    keccak256(bytes(name)),
                    keccak256(bytes(symbol)),
                    owner,
                    tokenId,
                    originChainId
                )
            )
        );
        address signer = ECDSA.recover(digest, v, r, s);
        bool isPermitSignerAdmin = IAccessControl(managerRegistry).hasRole(
            NETWORK_ADMIN_ROLE,
            signer
        );
        require(
            // Permit signer must be the admin in the manager Registry
            isPermitSignerAdmin,
            "InterChainFanTicketFactory::INVALID_SIGNATURE: The signer is not admin."
        );
        // Create it if signature was right
        address newTokenAddress = _newFanTicket(
            name,
            symbol,
            owner
        );
        tokenIdToAddress[tokenId] = newTokenAddress;
        tokenIdToOriginChainId[tokenId] = originChainId;
        tokenIdToOriginAddress[tokenId] = originAddress;
    }

    function tokenCreationCode() public view returns (bytes memory) {
        return type(InterChainFanTicket).creationCode;
    }
}
