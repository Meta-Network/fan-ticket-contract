//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";


contract MetaNetworkRoleRegistry is AccessControl {
    bytes32 public constant NETWORK_ADMIN_ROLE = keccak256("NETWORK_ADMIN_ROLE");

    mapping(address => bool) public isInBlacklist;

    event Enlist(
        address indexed operator,
        uint256 indexed datetime,
        address[] list
    );
    event Delist(
        address indexed operator,
        uint256 indexed datetime,
        address[] list
    );
    event HandoverAdmin(address from, address to);

    constructor() {
        _setupRole(NETWORK_ADMIN_ROLE, msg.sender);
    }

    modifier onlyAdmins() {
        require(hasRole(NETWORK_ADMIN_ROLE, msg.sender), "You're not the admin");
        _;
    }

    function enlistPeoplesInBanList(address[] memory list) public onlyAdmins {
        for (uint8 i = 0; i < list.length; i++) {
            address who = list[i];
            isInBlacklist[who] = true;
        }
        emit Enlist(msg.sender, block.timestamp, list);
    }

    function delistPeoplesInBanList(address[] memory list) public onlyAdmins {
        for (uint8 i = 0; i < list.length; i++) {
            address who = list[i];
            isInBlacklist[who] = false;
        }
        emit Delist(msg.sender, block.timestamp, list);
    }
}
