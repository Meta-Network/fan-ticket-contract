import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import type { FanTicketV2 } from "../typechain/FanTicketV2";
import { FanTicketV2__factory } from "../typechain/factories/FanTicketV2__factory";
import type { FanTicketClearingHouse } from "../typechain/FanTicketClearingHouse";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  MintOrderConstuctor,
  TransferOrderConstuctor,
  RandomOrderConstuctor,
  CreationPermitConstuctor,
} from "./utils";
import { MintOrder, TransactionOrder } from "./typing";
import { FanTicketFactory } from "../typechain/FanTicketFactory";
import { MetaNetworkRoleRegistry } from "../typechain/MetaNetworkRoleRegistry";
chai.use(solidity);

describe("Clearing House", function () {
  let accounts: SignerWithAddress[];
  let minter: SignerWithAddress;
  let registry: MetaNetworkRoleRegistry;
  let factory: FanTicketFactory;
  let fanTicketA: FanTicketV2;
  let fanTicketB: FanTicketV2;
  let clearingHouse: FanTicketClearingHouse;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    minter = accounts[0];
    const Registry = await ethers.getContractFactory("MetaNetworkRoleRegistry");
    const Factory = await ethers.getContractFactory("FanTicketFactory");
    registry = (await (
      await Registry.deploy()
    ).deployed()) as MetaNetworkRoleRegistry;
    factory = (await (
      await Factory.deploy(registry.address)
    ).deployed()) as FanTicketFactory;
    const ClearingHouse = await ethers.getContractFactory(
      "FanTicketClearingHouse"
    );
    const [_, tokenAOwner, tokenBOwner] = accounts;
    const tokenProfiles = [
      { name: "A Coin", symbol: "AC", id: 1919, owner: tokenAOwner.address },
      { name: "B Coin", symbol: "BC", id: 810, owner: tokenBOwner.address },
    ];
    const creationPermits = await Promise.all(
      tokenProfiles.map((p) =>
        CreationPermitConstuctor(
          factory,
          minter,
          p.name,
          p.symbol,
          p.owner,
          p.id
        )
      )
    );
    await Promise.all(
      creationPermits.map((permit) =>
        factory.newFanTicket(
          permit.name,
          permit.symbol,
          permit.owner,
          permit.initialSupply,
          permit.tokenId,
          permit.v,
          permit.r,
          permit.s
        )
      )
    );

    const [tokenAAddress, tokenBAddress] = await Promise.all(
      tokenProfiles.map((p) => factory.computeAddress(p.name, p.symbol))
    );

    fanTicketA = FanTicketV2__factory.connect(tokenAAddress, tokenAOwner);
    fanTicketB = FanTicketV2__factory.connect(tokenBAddress, tokenBOwner);
    clearingHouse = (await (
      await ClearingHouse.deploy()
    ).deployed()) as FanTicketClearingHouse;
    await fanTicketA.mint(
      accounts[1].address,
      "1000000000000000000000000000000000000000000"
    );
    await fanTicketB.mint(
      accounts[2].address,
      "1000000000000000000000000000000000000000000"
    );
  });

  it("mint with permits", async function () {
    const [_, fAOwner, fBOwner, ...rest] = accounts;

    const ordersOfTokenA: MintOrder[] = await Promise.all(
      rest.map((i, idx) =>
        MintOrderConstuctor(fanTicketA, fAOwner, i.address, "1000000", idx)
      )
    );
    const ordersOfTokenB: MintOrder[] = await Promise.all(
      rest.map((i, idx) =>
        MintOrderConstuctor(fanTicketB, fBOwner, i.address, "2000000", idx)
      )
    );
    const orders: TransactionOrder[] = [...ordersOfTokenA, ...ordersOfTokenB];
    await chai.expect(clearingHouse.handleTransferOrders(orders)).to.be.not
      .reverted;
    chai
      .expect(await fanTicketA.balanceOf(accounts[5].address))
      .to.be.eq(1000000);
    chai
      .expect(await fanTicketB.balanceOf(accounts[8].address))
      .to.be.eq(2000000);
  });

  it("transfer with permits", async function () {
    const [_, fAOwner, fBOwner, ...rest] = accounts;

    const ordersOfTokenA: TransactionOrder[] = await Promise.all(
      rest.map((i, idx) =>
        TransferOrderConstuctor(fanTicketA, fAOwner, i.address, "1000000", idx)
      )
    );
    const ordersOfTokenB: TransactionOrder[] = await Promise.all(
      rest.map((i, idx) =>
        TransferOrderConstuctor(fanTicketB, fBOwner, i.address, "2000000", idx)
      )
    );
    const orders: TransactionOrder[] = [...ordersOfTokenA, ...ordersOfTokenB];
    const estGas = await clearingHouse.estimateGas.handleTransferOrders(orders);
    const estGasForNormalTransfer = await fanTicketA
      .connect(fAOwner)
      .estimateGas.transfer(fBOwner.address, "10000");

    console.info(
      `estimated Gas cost for ${orders.length} transfers: `,
      estGas.toString()
    );
    console.info(
      `estimated Gas cost for 1 ERC20 normal transfers: `,
      estGasForNormalTransfer.toString()
    );
    await chai.expect(clearingHouse.handleTransferOrders(orders)).to.be.not
      .reverted;
    chai
      .expect(await fanTicketA.balanceOf(accounts[5].address))
      .to.be.eq(1000000);
    chai
      .expect(await fanTicketB.balanceOf(accounts[8].address))
      .to.be.eq(2000000);

    console.info(
      `Current GasLimit: ${(
        await fAOwner.provider?.getBlock("latest")
      )?.gasLimit.toString()}`
    );
    const estGasWACC = await clearingHouse.estimateGas.handleTransferOrders([
      ...(await Promise.all(
        rest.map((i, idx) =>
          TransferOrderConstuctor(
            fanTicketA,
            fAOwner,
            i.address,
            "1000000",
            idx + 17
          )
        )
      )),
      ...(await Promise.all(
        rest.map((i, idx) =>
          TransferOrderConstuctor(
            fanTicketB,
            fBOwner,
            i.address,
            "2000000",
            idx + 17
          )
        )
      )),
    ]);
    const estGasForNormalTransferWACC = await fanTicketA
      .connect(fAOwner)
      .estimateGas.transfer(accounts[5].address, "10000");

    console.info(
      `estimated Gas cost for ${orders.length} transfers (to acc with balance already): `,
      estGasWACC.toString()
    );
    console.info(
      `estimated Gas cost for 1 ERC20 normal transfers (to acc with balance already): `,
      estGasForNormalTransferWACC.toString()
    );
  });

  it("transfer&mint mixed clearing", async function () {
    const [_, fAOwner, fBOwner, ...rest] = accounts;

    const ordersOfTokenA: TransactionOrder[] = await Promise.all(
      rest.map((i, idx) =>
        RandomOrderConstuctor(fanTicketA, fAOwner, i.address, "1000000", idx)
      )
    );
    const ordersOfTokenB: TransactionOrder[] = await Promise.all(
      rest.map((i, idx) =>
        RandomOrderConstuctor(fanTicketB, fBOwner, i.address, "2000000", idx)
      )
    );
    const orders: TransactionOrder[] = [...ordersOfTokenA, ...ordersOfTokenB];
    await chai.expect(clearingHouse.handleTransferOrders(orders)).to.be.not
      .reverted;
    chai
      .expect(await fanTicketA.balanceOf(accounts[5].address))
      .to.be.eq(1000000);
    chai
      .expect(await fanTicketB.balanceOf(accounts[8].address))
      .to.be.eq(2000000);
  });
});
