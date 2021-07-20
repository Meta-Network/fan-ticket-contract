//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract FanTicketClearingHouse {
    struct TransferOrder {
        address token;
        address from;
        address to;
        uint value;
        uint deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function handleTransferOrders(TransferOrder[] calldata orders) external {
        for (uint256 i = 0; i < orders.length; i++) {
            TransferOrder calldata order = orders[i];
            // Tip: permit `spender` is the ClearingHouse contract
            // because the allowance is based on the `transferFrom` caller, which is this contract.
            ERC20Permit(order.token).permit(order.from, address(this), order.value, order.deadline, order.v, order.r, order.s);
            IERC20(order.token).transferFrom(order.from, order.to, order.value);
        }
    }
}