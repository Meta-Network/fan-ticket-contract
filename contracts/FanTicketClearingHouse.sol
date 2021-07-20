//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

interface IERC20Sig {
    function transferFromBySig(
        address sender,
        address recipient,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns(bool);

    function mintBySig(
        address minter,
        address to,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (bool);
}


contract FanTicketClearingHouse {
    struct TransferOrder {
        address token;
        address from;
        address to;
        uint value;
        uint deadline;
        bool isMint;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function handleTransferOrders(TransferOrder[] calldata orders) external {
        for (uint256 i = 0; i < orders.length; i++) {
            TransferOrder calldata order = orders[i];
            if (order.isMint) {
                IERC20Sig(order.token).mintBySig(order.from, order.to, order.value, order.deadline, order.v, order.r, order.s);
            }
            else {
                IERC20Sig(order.token).transferFromBySig(order.from, order.to, order.value, order.deadline, order.v, order.r, order.s);
            }
        }
    }
}