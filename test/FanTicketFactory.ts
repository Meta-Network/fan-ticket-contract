import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { utils, BigNumberish } from "ethers";
import type { FanTicketFactory } from "../typechain/FanTicketFactory";
import type { MetaNetworkRoleRegistry } from "../typechain/MetaNetworkRoleRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Event } from "ethers";
import { CreationPermitConstuctor } from "./utils";
chai.use(solidity);



describe("FanTicket Factory", function () {
  let accounts: SignerWithAddress[];
  let theNetworkManager: SignerWithAddress;
  let registry: MetaNetworkRoleRegistry;
  let factory: FanTicketFactory;


  beforeEach(async function () {
    accounts = await ethers.getSigners();
    theNetworkManager = accounts[0];
    const Registry = await ethers.getContractFactory("MetaNetworkRoleRegistry");
    const Factory = await ethers.getContractFactory("FanTicketFactory");
    registry = await (await Registry.deploy()).deployed() as MetaNetworkRoleRegistry;
    factory = await (await Factory.deploy(registry.address)).deployed() as FanTicketFactory
  });

  it("create token with permits", async function () {
    const [ _, tokenOwner ] = accounts;
    const permit = await CreationPermitConstuctor(factory, theNetworkManager, "小富币", 'FWC', tokenOwner.address, 114514);
    await chai.expect(
      factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.initialSupply, permit.tokenId, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
  });

  it("refuse to create token with same symbol", async function () {
    const [ _, tokenOwnerA, tokenOwnerB ] = accounts;
    const permit = await CreationPermitConstuctor(factory, theNetworkManager, "小富币", 'FWC', tokenOwnerA.address, 114514);
    await chai.expect(
      factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.initialSupply, permit.tokenId, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
    // different name, same symbol
    const permitB = await CreationPermitConstuctor(factory, theNetworkManager, "小FU币", 'FWC', tokenOwnerB.address, 114514);
    await chai.expect(
      factory.newAPeggedToken(permitB.name, permitB.symbol, permitB.owner, permitB.initialSupply, permitB.tokenId, permitB.v, permitB.r, permitB.s)
    ).to.be.revertedWith("Token have been created on this factory");
  });

  it("refuse to create token with permit signed by non admin", async function () {
    const [ _, tokenOwner ] = accounts;
    const permit = await CreationPermitConstuctor(factory, accounts[9], "小富币", 'FWC', tokenOwner.address, 114514);

    await chai.expect(
      factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.initialSupply, permit.tokenId, permit.v, permit.r, permit.s)
    ).to.be.revertedWith('FanTicketFactory::INVALID_SIGNATURE: The signer is not admin.');
  });

  it("computed creation address are matched", async function () {
    const [ _, tokenOwner ] = accounts;
    const name = '小富币'
    const symbol = 'FWC'
    const computedAddress = await factory.computeAddress(name, symbol);
    console.info(`For Token with name '${name}' and symbol '${symbol}' will be deployed at: ${computedAddress}`)
    const permit = await CreationPermitConstuctor(factory, theNetworkManager, name, symbol, tokenOwner.address, 114514);
    const newTx = factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.initialSupply, permit.tokenId, permit.v, permit.r, permit.s)
    await chai.expect(
      newTx
    ).to.be.not.reverted;

    const res = await newTx;
    const receipt = await res.wait()
    const findNewFanTicketEvent: Event = receipt.events?.filter((item) => {
      if (!item || !item.args) return false;
      return item.args[1] === symbol;
    })[0] as Event
    const actualDeployedAt = (findNewFanTicketEvent.args as string[])[2]
    console.info(`Token actually deployed at: ${actualDeployedAt}`)
    chai.expect(computedAddress).to.be.eq(actualDeployedAt)
  });
});

