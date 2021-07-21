import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { utils } from "ethers";
import type { FanTicketV2 } from "../typechain/FanTicketV2";
import { BigNumber } from "ethers";
import { CreationPermitConstuctor, getDeadline } from "./utils";
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
    [ minter ] = accounts;
    const Registry = await ethers.getContractFactory("MetaNetworkRoleRegistry");
    const Factory = await ethers.getContractFactory("FanTicketFactory");
    let registry = await (await Registry.deploy()).deployed() as MetaNetworkRoleRegistry;
    let factory = await (await Factory.deploy(registry.address)).deployed() as FanTicketFactory
    const tokenProfiles = [
      {name:  "A Coin", symbol: 'AC', id: 1919, owner: minter.address },
    ]
    const creationPermits = await Promise.all(tokenProfiles.map(p => CreationPermitConstuctor(factory, minter, p.name, p.symbol, p.owner, p.id)))
    await Promise.all(creationPermits.map(permit => 
        factory.newAPeggedToken(permit.name, permit.symbol, permit.owner, permit.initialSupply, permit.tokenId, permit.v, permit.r, permit.s)
      )
    );

    const [tokenAAddress] = await Promise.all(tokenProfiles.map(p => factory.computeAddress(p.name, p.symbol)));

    fanTicket = FanTicketV2__factory.connect(tokenAAddress, minter)
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
    await chai.expect(fanTicket.connect(accounts[2]).mint(someoneElse, "1145141919810000000")).to.be.reverted;
  });

  // EIP2612 ERC20 Premit related
  it("transfer with good Permit", async function () {
    const [ theOwner, theGasPayer, theReceiver] = accounts;
    const chainId = await minter.getChainId();
    const deadline = getDeadline()
    const targetAmount = BigNumber.from("114514191981000000")
    const tokenOwner =  theOwner.address;
    await fanTicket.mint(tokenOwner, targetAmount);

    const spender =  theGasPayer.address;
    const msg = {
      owner: tokenOwner,
      spender,
      value: targetAmount,
      nonce: (await fanTicket.nonces(spender)).toNumber(),
      deadline,
    };

    const signature = await theOwner._signTypedData(
      {
        name: (await fanTicket.name()),
        version: "1",
        chainId: chainId,
        verifyingContract: fanTicket.address,
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
      msg
    );

    chai.expect(signature).to.be.not.null;
    const { r, s, v } = utils.splitSignature(signature);

    await chai.expect(
      fanTicket.permit(tokenOwner,spender, targetAmount, deadline, v, r,s)
    ).to.be.not.reverted;
    
    await chai.expect(
      fanTicket.connect(theGasPayer).transferFrom(tokenOwner, await theReceiver.address, targetAmount)
    ).to.be.not.reverted; 
  });

  it("revert if permit was outdated", async function () {
    const [ theOwner, theGasPayer] = accounts;
    const chainId = await minter.getChainId();
    // deadline is 1 hours ago from now
    const deadline = getDeadline(-3600)
    const targetAmount = BigNumber.from("114514191981000000")
    const tokenOwner =  theOwner.address;
    await fanTicket.mint(tokenOwner, targetAmount);

    const spender =  theGasPayer.address;
    const msg = {
      owner: tokenOwner,
      spender,
      value: targetAmount,
      nonce: (await fanTicket.nonces(spender)).toNumber(),
      deadline,
    };

    const signature = await theOwner._signTypedData(
      {
        name: (await fanTicket.name()),
        version: "1",
        chainId: chainId,
        verifyingContract: fanTicket.address,
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
      msg
    );

    chai.expect(signature).to.be.not.null;
    const { r, s, v } = utils.splitSignature(signature);

    await chai.expect(
      fanTicket.permit(tokenOwner,spender, targetAmount, deadline, v, r,s)
    ).to.be.reverted;
  });

});
