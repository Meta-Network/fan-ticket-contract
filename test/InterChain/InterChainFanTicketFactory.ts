import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { utils, BigNumberish } from "ethers";
import type { InterChainFanTicketFactory } from "../../typechain/InterChainFanTicketFactory";
import type { MetaNetworkRoleRegistry } from "../../typechain/MetaNetworkRoleRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Event } from "ethers";
import { CreationPermitConstuctor } from "./utils";
import {  InterChainFanTicketFactory__factory } from "../../typechain/factories/InterChainFanTicketFactory__factory";
import {  InterChainFanTicket__factory } from "../../typechain/factories/InterChainFanTicket__factory";
chai.use(solidity);

const ZERO_ADDRESS = '0x' + (Array(40).fill('0').join(''))

describe("InterChain FanTicketFactory", function () {
  let accounts: SignerWithAddress[];
  let theNetworkManager: SignerWithAddress;
  let registry: MetaNetworkRoleRegistry;
  let factory: InterChainFanTicketFactory;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    theNetworkManager = accounts[0];
    const Registry = await ethers.getContractFactory("MetaNetworkRoleRegistry");
    const Factory = await ethers.getContractFactory("InterChainFanTicketFactory") as InterChainFanTicketFactory__factory;
    registry = (await (
      await Registry.deploy()
    ).deployed()) as MetaNetworkRoleRegistry;
    factory = await (
      await Factory.deploy(registry.address)
    ).deployed();
  });

  it("created by permit and computed address are matched", async function () {
    const [_, tokenOwner] = accounts;
    const name = "小富币";
    const symbol = "FWC";
    const computedAddress = await factory.computeAddress(name, symbol);
    console.info(
      `For Token with name '${name}' and symbol '${symbol}' will be deployed at: ${computedAddress}`
    );
    const permit = await CreationPermitConstuctor(
      factory,
      theNetworkManager,
      ZERO_ADDRESS,
      name,
      symbol,
      114514,
      1
    );
    const newTx = factory.newFanTicket(
      permit.name,
      permit.symbol,
      permit.tokenId,
      permit.originChainId,
      permit.originAddress,      
      permit.v,
      permit.r,
      permit.s
    );
    await chai.expect(newTx).to.be.not.reverted;

    const res = await newTx;
    const receipt = await res.wait();
    const findNewFanTicketEvent: Event = receipt.events?.filter((item) => {
      if (!item || !item.args) return false;
      return item.args[1] === name;
    })[0] as Event;
    const actualDeployedAt = (findNewFanTicketEvent.args as string[])[2];
    console.info(`Token actually deployed at: ${actualDeployedAt}`);
    chai.expect(computedAddress).to.be.eq(actualDeployedAt);
  });

  it("fail to call init twice", async function () {
    const [_, tokenOwner] = accounts;
    const [ name, symbol ] = [ "小富币", "FWC" ];
    const permit = await CreationPermitConstuctor(
      factory,
      theNetworkManager,
      ZERO_ADDRESS,
      name, symbol,
      114514,
      1
    );
    await chai.expect(
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
    ).to.be.not.reverted;
    const address = await factory.computeAddress(name, symbol);
    const token = InterChainFanTicket__factory.connect(address, tokenOwner);
    // call it
    await chai.expect(
      token.init(ZERO_ADDRESS)
    ).to.be.reverted;

  });

  it("refuse to create token with same symbol", async function () {
    const [_, tokenOwnerA, tokenOwnerB] = accounts;
    const permit = await CreationPermitConstuctor(
      factory,
      theNetworkManager,
      ZERO_ADDRESS,
      "小富币",
      "FWC",
      114514,
      1
    );
    await chai.expect(
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
    ).to.be.not.reverted;
    // different name, same symbol
    const permitB = await CreationPermitConstuctor(
      factory,
      theNetworkManager,
      ZERO_ADDRESS,
      "小FU币",
      "FWC",
      114514,
      1
    );
    await chai
      .expect(
        factory.newFanTicket(
          permitB.name,
          permitB.symbol,
          permitB.tokenId,
          permit.originChainId,
          permit.originAddress,
          permitB.v,
          permitB.r,
          permitB.s
        )
      )
      .to.be.revertedWith("Token have been created on this factory");
  });

  it("refuse to create token with permit signed by non admin", async function () {
    const [_, tokenOwner] = accounts;
    const permit = await CreationPermitConstuctor(
      factory,
      accounts[9],
      ZERO_ADDRESS,
      "小富币",
      "FWC",
      114514,
      1
    );

    await chai
      .expect(
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
      .to.be.revertedWith(
        "FanTicketFactory::INVALID_SIGNATURE: The signer is not admin."
      );
  });

});
