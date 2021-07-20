import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, utils, providers, BigNumberish } from "ethers";
import type { FanTicketV2 } from "../typechain/FanTicketV2";
import type { FanTicketClearingHouse } from "../typechain/FanTicketClearingHouse";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
chai.use(solidity);

const getDeadline = (howManySecond = 3600) => Math.floor(Date.now() / 1000) + howManySecond;

type TransferOrder = {
  token: string;
  from: string;
  to: string;
  value: BigNumberish;
  deadline: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};

describe("Clearing House", function () {
  let accounts: SignerWithAddress[];
  let minter: SignerWithAddress;
  let fanTicketA: FanTicketV2;
  let fanTicketB: FanTicketV2;
  let clearingHouse: FanTicketClearingHouse;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    minter = accounts[0];
    const FanTicketV2 = await ethers.getContractFactory("FanTicketV2");
    const ClearingHouse = await ethers.getContractFactory("FanTicketClearingHouse");
    const fa = await FanTicketV2.deploy("Test FanTicket A", "TFPA", minter.address);
    const fb = await FanTicketV2.deploy("Test FanTicket A", "TFPB", minter.address);

    fanTicketA = (await fa.deployed()) as FanTicketV2;
    fanTicketB = (await fb.deployed()) as FanTicketV2;
    clearingHouse = await (await ClearingHouse.deploy()).deployed() as FanTicketClearingHouse
    await fanTicketA.mint(accounts[1].address, "1000000000000000000000000000000000000000000")
    await fanTicketB.mint(accounts[2].address, "1000000000000000000000000000000000000000000")
  });

  it("transfer with permits", async function () {
    const [ _, fAOwner, fBOwner, ...rest ] = accounts;

    
    const ordersOfTokenA: TransferOrder[] = await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanTicketA, clearingHouse, fAOwner, i.address, "1000000", idx)));
    const ordersOfTokenB: TransferOrder[] = await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanTicketB, clearingHouse, fBOwner, i.address, "2000000", idx)));
    const orders: TransferOrder[] = [...ordersOfTokenA, ...ordersOfTokenB];
    const estGas = await clearingHouse.estimateGas.handleTransferOrders(orders)
    const estGasForNormalTransfer = await fanTicketA.connect(fAOwner).estimateGas.transfer(fBOwner.address, '10000')

    console.info(`estimated Gas cost for ${orders.length} transfers: `, estGas.toString())
    console.info(`estimated Gas cost for 1 ERC20 normal transfers: `, estGasForNormalTransfer.toString())
    await chai.expect(
      clearingHouse.handleTransferOrders(orders)
    ).to.be.not.reverted;
    chai.expect(await fanTicketA.balanceOf(accounts[5].address)).to.be.eq(1000000)
    chai.expect(await fanTicketB.balanceOf(accounts[8].address)).to.be.eq(2000000)

    console.info(`Current GasLimit: ${(await fAOwner.provider?.getBlock('latest'))?.gasLimit.toString()}`)
    const estGasWACC = await clearingHouse.estimateGas.handleTransferOrders([
      ...await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanTicketA, clearingHouse, fAOwner, i.address, "1000000", idx + 17))),
      ...await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanTicketB, clearingHouse, fBOwner, i.address, "2000000", idx + 17)))
    ])
    const estGasForNormalTransferWACC = await fanTicketA.connect(fAOwner).estimateGas.transfer(accounts[5].address, '10000')

    console.info(`estimated Gas cost for ${orders.length} transfers (to acc with balance already): `, estGasWACC.toString())
    console.info(`estimated Gas cost for 1 ERC20 normal transfers (to acc with balance already): `, estGasForNormalTransferWACC.toString())
  });
});


async function TransferOrderConstuctor(token: FanTicketV2, clearingHouse: FanTicketClearingHouse, from: SignerWithAddress, to: string, value: BigNumberish, nonce: number): Promise<TransferOrder> {
  const deadline = getDeadline()
  const chainId = await from.getChainId();

  const signature = await from._signTypedData(
    {
      name: (await token.name()),
      version: "1",
      chainId: chainId,
      verifyingContract: token.address,
    },
    {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        {
          name: "value",
          type: "uint256",
        },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      owner: from.address,
      // the spender is the ClearingHouse who make the `transferFrom`
      spender: clearingHouse.address,
      value,
      nonce,
      deadline
    }
  );

  const { r, s, v } = utils.splitSignature(signature);

  return {
    token: token.address,
    from: from.address,
    to,
    value,
    deadline,
    v,
    r,
    s
  }
}