import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, utils, providers, BigNumberish } from "ethers";
import type { FanTicketV2 } from "../typechain/FanTicketV2";
import type { FanTicketFactory } from "../typechain/FanTicketFactory";
import type { MetaNetworkRoleRegistry } from "../typechain/MetaNetworkRoleRegistry";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
chai.use(solidity);

const getDeadline = (howManySecond = 3600) => Math.floor(Date.now() / 1000) + howManySecond;

type CreationPermit = {
  name: string;
  symbol: string;
  owner: string;
  tokenId: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};

describe("FanTicket Factory", function () {
  let accounts: SignerWithAddress[];
  let theNetworkManager: SignerWithAddress;
  let registry: MetaNetworkRoleRegistry;
  let factory: FanTicketFactory;

  let fanTicketA: FanTicketV2;
  let fanTicketB: FanTicketV2;

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
      factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.tokenId, permit.v, permit.r, permit.s)
    ).to.be.not.reverted;
  });

  it("refuse to create token with permit signed by non admin", async function () {
    const [ _, tokenOwner ] = accounts;
    const permit = await CreationPermitConstuctor(factory, accounts[9], "小富币", 'FWC', tokenOwner.address, 114514);

    await chai.expect(
      factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.tokenId, permit.v, permit.r, permit.s)
    ).to.be.revertedWith('FanTicketFactory::INVALID_SIGNATURE: The signer is not admin.');
  });
});


async function CreationPermitConstuctor(
  factory: FanTicketFactory,
  adminWallet: SignerWithAddress,
  name: string,
  symbol: string,
  owner: string,
  tokenId: number,
  ): Promise<CreationPermit> {
  const chainId = await adminWallet.getChainId();
  const signature = await adminWallet._signTypedData(
    {
      name: "FanTicketFactory",
      version: "1",
      chainId: chainId,
      verifyingContract: factory.address,
    },
    {
      CreationPermit: [
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        {
          name: "owner",
          type: "address",
        },
        { name: "tokenId", type: "uint32" },
      ],
    },
    {
      name, symbol, owner, tokenId
    }
  );

  const { r, s, v } = utils.splitSignature(signature);

  return {
    name, symbol, owner, tokenId,
    v,
    r,
    s
  }
}