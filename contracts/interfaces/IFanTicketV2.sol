//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IFanTicketV2 {
    function mint(address to, uint256 value) external;

    function mintBySig(
        address minter,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool);

    function transferFromBySig(
        address sender,
        address recipient,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool);
}