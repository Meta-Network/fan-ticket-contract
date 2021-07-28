import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { utils } from "ethers";
import type { FanTicketV2 } from "../typechain/FanTicketV2";
import { BigNumber } from "ethers";
import { CreationPermitConstuctor, getDeadline, signEIP2612Permit, TransferOrderConstuctor } from "./utils";
import { FanTicketV2__factory } from "../typechain/factories/FanTicketV2__factory";
import { FanTicketFactory } from "../typechain/FanTicketFactory";
import { MetaNetworkRoleRegistry } from "../typechain/MetaNetworkRoleRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
chai.use(solidity);

describe("FanTicket v2", function () {
  let accounts: SignerWithAddress[];
  let minter: SignerWithAddress;
  let fanTicket: FanTicketV2;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    [minter] = accounts;
    const Registry = await ethers.getContractFactory("MetaNetworkRoleRegistry");
    const Factory = await ethers.getContractFactory("FanTicketFactory");
    let registry = (await (
      await Registry.deploy()
    ).deployed()) as MetaNetworkRoleRegistry;
    let factory = (await (
      await Factory.deploy(registry.address)
    ).deployed()) as FanTicketFactory;
    const tokenProfiles = [
      { name: "A Coin", symbol: "AC", id: 1919, owner: minter.address },
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

    const [tokenAAddress] = await Promise.all(
      tokenProfiles.map((p) => factory.computeAddress(p.name, p.symbol))
    );

    fanTicket = FanTicketV2__factory.connect(tokenAAddress, minter);
  });

  it("mint as the preset minter", async function () {
    const addr = minter.address;
    const tx = await fanTicket.mint(addr, "1145141919810000000");
    await tx.wait();
    const balance = await fanTicket.balanceOf(addr);
    chai.expect(balance.toString()).to.eq("1145141919810000000");
  });

  it("fail to mint as non minter", async function () {
    const someoneElse = accounts[2].address;
    await chai.expect(
      fanTicket.connect(accounts[2]).mint(someoneElse, "1145141919810000000")
    ).to.be.reverted;
  });

  // EIP2612 ERC20 Premit related
  it("transfer with good Permit", async function () {
    const [theOwner, _, theReceiver] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const tokenOwner = theOwner.address;
    chai.expect(await fanTicket.balanceOf(tokenOwner)).to.be.eq(0)
    await fanTicket.mint(tokenOwner, targetAmount);
    const nonce = await fanTicket.nonces(theOwner.address);
    const permit = await TransferOrderConstuctor(fanTicket, theOwner, theReceiver.address, targetAmount, nonce.toNumber())

    await chai.expect(
      fanTicket.transferFromBySig(tokenOwner, theReceiver.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
  });

  it("revert transfer if permit was outdated", async function () {
    const [theOwner, _, theReceiver] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const tokenOwner = theOwner.address;
    chai.expect(await fanTicket.balanceOf(tokenOwner)).to.be.eq(0)
    await fanTicket.mint(tokenOwner, targetAmount);
    const nonce = await fanTicket.nonces(theOwner.address);
    const permit = await TransferOrderConstuctor(fanTicket, theOwner, theReceiver.address, targetAmount, nonce.toNumber(), -60)

    await chai.expect(
      fanTicket.transferFromBySig(tokenOwner, theReceiver.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.revertedWith('ERC20Permit::signature expired deadline');
  });

  it("revert transfer if permit was good, but insufficient fund", async function () {
    const [theOwner, _, theReceiver] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const tokenOwner = theOwner.address;
    chai.expect(await fanTicket.balanceOf(tokenOwner)).to.be.eq(0)
    const nonce = await fanTicket.nonces(theOwner.address);
    const permit = await TransferOrderConstuctor(fanTicket, theOwner, theReceiver.address, targetAmount, nonce.toNumber())

    await chai.expect(
      fanTicket.transferFromBySig(tokenOwner, theReceiver.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
  });
});
