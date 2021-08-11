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

interface IICParking {
    function deposit(
        address token,
        address sender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function withdraw(
        address token,
        address who,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}


contract FanTicketClearingHouse {
    enum TxType { Transfer, Mint, Permit, InterChainDeposit, InterChainWithdraw }
    struct TransferOrder {
        address token;
        address from;
        address to;
        uint value;
        uint deadline;
        TxType _type;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    function handleTransferOrders(TransferOrder[] calldata orders) external {
        for (uint256 i = 0; i < orders.length; i++) {
            TransferOrder calldata order = orders[i];
            if (order._type == TxType.InterChainDeposit) {
                // reuse `order.to`
                IICParking(order.to).deposit(order.token, order.from, order.value, order.deadline, order.v, order.r, order.s);
            }
            else if (order._type == TxType.InterChainWithdraw) {
                // reuse `order.from`
                IICParking(order.from).withdraw(order.token, order.to, order.value, order.deadline, order.v, order.r, order.s);
            }
            else if (order._type == TxType.Mint) {
                IERC20Sig(order.token).mintBySig(order.from, order.to, order.value, order.deadline, order.v, order.r, order.s);
            }
            else if (order._type == TxType.Transfer) {
                IERC20Sig(order.token).transferFromBySig(order.from, order.to, order.value, order.deadline, order.v, order.r, order.s);
            } else {
                // It's `permit()` then.
                ERC20Permit(order.token).permit(order.from, order.to, order.value, order.deadline, order.v, order.r, order.s);
            }
        }
    }
}