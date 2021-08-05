import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { utils } from "ethers";
import type { InterChainFanTicket } from "../../typechain/InterChainFanTicket";
import type { InterChainParking } from "../../typechain/InterChainParking";
import { BigNumber } from "ethers";
import { CreationPermitConstuctor, getDeadline, MintOrderConstuctor, ParkingWithdrawConstuctor, signEIP2612Permit, TransferOrderConstuctor } from "./utils";
import { InterChainFanTicket__factory } from "../../typechain/factories/InterChainFanTicket__factory";
import { InterChainFanTicketFactory } from "../../typechain/InterChainFanTicketFactory";
import { InterChainParking__factory } from "../../typechain/factories/InterChainParking__factory";
import { MetaNetworkRoleRegistry } from "../../typechain/MetaNetworkRoleRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
chai.use(solidity);

const ZERO_ADDRESS = '0x' + (Array(40).fill('0').join(''))

describe("InterChain FanTicket v2", function () {
  let accounts: SignerWithAddress[];
  let networkAdmin: SignerWithAddress;
  let fanTicket: InterChainFanTicket;
  let parkingLot: InterChainParking;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    [networkAdmin] = accounts;
    const Registry = await ethers.getContractFactory("MetaNetworkRoleRegistry");
    const Factory = await ethers.getContractFactory("InterChainFanTicketFactory");
    const Parking = await ethers.getContractFactory("InterChainParking");
    let registry = (await (
      await Registry.deploy()
    ).deployed()) as MetaNetworkRoleRegistry;
    registry.grantRole(await registry.NETWORK_ADMIN_ROLE(), networkAdmin.address);
    let factory = (await (
      await Factory.deploy(registry.address)
    ).deployed()) as InterChainFanTicketFactory;

    parkingLot = (await (
      await Parking.deploy(networkAdmin.address)
    ).deployed()) as InterChainParking;

    const tokenProfiles = [
      { name: "A Coin", symbol: "AC", id: 1919 },
    ];
    const creationPermits = await Promise.all(
      tokenProfiles.map((p) =>
        CreationPermitConstuctor(
          factory,
          networkAdmin,
          ZERO_ADDRESS,
          p.name,
          p.symbol,
          p.id,
          1
        )
      )
    );
    await Promise.all(
      creationPermits.map((permit) =>
        factory.newFanTicket(
          permit.name,
          permit.symbol,
          permit.tokenId,
          permit.originChainId,
          permit.originAddress,
          permit.v,
          permit.r,
          permit.s
        )
      )
    );

    const [tokenAAddress] = await Promise.all(
      tokenProfiles.map((p) => factory.computeAddress(p.name, p.symbol))
    );

    fanTicket = InterChainFanTicket__factory.connect(tokenAAddress, networkAdmin);
  });

  it("direct mint disabled", async function () {
    const addr = networkAdmin.address;
    await chai.expect(fanTicket.mint(addr, "1145141919810000000")).to.be.revertedWith('Disabled direct mint for InterChainFanTicket');
  });

  it("fail to mint as non minter", async function () {
    const someoneElse = accounts[2].address;
    await chai.expect(
      fanTicket.connect(accounts[2]).mint(someoneElse, "1145141919810000000")
    ).to.be.reverted;
  });

  // EIP2612 ERC20 Premit related
  it("Mint with good Permit", async function () {
    const [_a, _, theReceiver] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const nonce = await fanTicket.nonces(networkAdmin.address);
    const permit = await MintOrderConstuctor(fanTicket, networkAdmin, theReceiver.address, targetAmount, nonce.toNumber())

    await chai.expect(
      fanTicket.mintBySig(networkAdmin.address, theReceiver.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
  });

  it("Revert with bad mint Permit", async function () {
    const [_a, another, theReceiver] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const nonce = await fanTicket.nonces(another.address);
    const permit = await MintOrderConstuctor(fanTicket, another, theReceiver.address, targetAmount, nonce.toNumber())

    await chai.expect(
      fanTicket.mintBySig(another.address, theReceiver.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.reverted;
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

  // parking
  it("Good to deposit", async function () {
    const [_a, _b, theOwner] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const networkAdminNonce = await fanTicket.nonces(networkAdmin.address);
    const permit = await MintOrderConstuctor(fanTicket, networkAdmin, theOwner.address, targetAmount, networkAdminNonce.toNumber())

    await chai.expect(
      fanTicket.mintBySig(networkAdmin.address, theOwner.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
    const myNonce = await fanTicket.nonces(theOwner.address);
    const tPermit = await TransferOrderConstuctor(fanTicket, theOwner, parkingLot.address, targetAmount, myNonce.toNumber())

    await chai.expect(
      parkingLot.deposit(fanTicket.address, tPermit.from, tPermit.value, tPermit.deadline, tPermit.v, tPermit.r, tPermit.s)
    ).to.be.not.reverted;
  });

  it("Good to withdraw", async function () {
    const [_a, _b, theOwner] = accounts;
    const targetAmount = BigNumber.from("114514191981000000");
    const networkAdminNonce = await fanTicket.nonces(networkAdmin.address);
    const permit = await MintOrderConstuctor(fanTicket, networkAdmin, theOwner.address, targetAmount, networkAdminNonce.toNumber())

    await chai.expect(
      fanTicket.mintBySig(networkAdmin.address, theOwner.address, targetAmount, permit.deadline, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
    const myNonce = await fanTicket.nonces(theOwner.address);
    const tPermit = await TransferOrderConstuctor(fanTicket, theOwner, parkingLot.address, targetAmount, myNonce.toNumber())

    await chai.expect(
      parkingLot.deposit(fanTicket.address, tPermit.from, tPermit.value, tPermit.deadline, tPermit.v, tPermit.r, tPermit.s)
    ).to.be.not.reverted;

    const withdrawNonces = await parkingLot.withdrawNonces(fanTicket.address, theOwner.address);

    const pWithdrawPermit = await ParkingWithdrawConstuctor(parkingLot, fanTicket.address, networkAdmin, theOwner.address, targetAmount, withdrawNonces.toNumber())

    await parkingLot.withdraw(fanTicket.address, pWithdrawPermit.who, tPermit.value, tPermit.deadline, tPermit.v, tPermit.r, tPermit.s)

    // await chai.expect(
    //   parkingLot.withdraw(fanTicket.address, pWithdrawPermit.who, tPermit.value, tPermit.deadline, tPermit.v, tPermit.r, tPermit.s)
    // ).to.be.not.reverted;
  });
});
