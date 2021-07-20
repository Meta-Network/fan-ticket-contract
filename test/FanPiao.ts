import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, utils, providers } from "ethers";
import type { FanPiaoV2 } from "../typechain/FanPiaoV2";
import { BigNumber } from "ethers";
chai.use(solidity);

const getDeadline = (howManySecond = 3600) => Math.floor(Date.now() / 1000) + howManySecond;

describe("FanPiao v2", function () {
  let accounts: Signer[];
  let minter: Signer;
  let fanpiao: FanPiaoV2;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    minter = accounts[0];
    const FanPiaoV2 = await ethers.getContractFactory("FanPiaoV2");
    const ck = await FanPiaoV2.deploy("Test FanPiao", "TFP", await minter.getAddress());

    fanpiao = (await ck.deployed()) as FanPiaoV2;
  });

  it("mint as the preset minter", async function () {
    const addr = await minter.getAddress();
    const tx = await fanpiao.mint(addr, "1145141919810000000");
    await tx.wait();
    const balance = await fanpiao.balanceOf(addr);
    chai.expect(balance.toString()).to.eq("1145141919810000000");
  });

  it("fail to mint as non minter", async function () {
    const someoneElse = await accounts[2].getAddress();
    await chai.expect(fanpiao.connect(accounts[2]).mint(someoneElse, "1145141919810000000")).to.be.reverted;
  });

  it("fail minting if acting as non-minter", async function () {
    const addr = await minter.getAddress();
    await chai.expect(fanpiao.connect(accounts[1]).mint(addr, "1145141919810000000")).to
      .reverted;
  });

  // EIP2612 ERC20 Premit related
  it("transfer with good Permit", async function () {
    const [ theOwner, theGasPayer, theReceiver] = accounts;
    const chainId = await minter.getChainId();
    const deadline = getDeadline()
    const targetAmount = BigNumber.from("114514191981000000")
    const tokenOwner = await theOwner.getAddress();
    await fanpiao.mint(tokenOwner, targetAmount);

    const spender = await theGasPayer.getAddress();
    const msg = {
      owner: tokenOwner,
      spender,
      value: targetAmount,
      nonce: (await fanpiao.nonces(spender)).toNumber(),
      deadline,
    };

    const signature = await (theOwner as providers.JsonRpcSigner)._signTypedData(
      {
        name: (await fanpiao.name()),
        version: "1",
        chainId: chainId,
        verifyingContract: fanpiao.address,
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
      fanpiao.permit(tokenOwner,spender, targetAmount, deadline, v, r,s)
    ).to.be.not.reverted;
    
    await chai.expect(
      fanpiao.connect(theGasPayer).transferFrom(tokenOwner, await theReceiver.getAddress(), targetAmount)
    ).to.be.not.reverted; 
  });

  it("revert if permit was outdated", async function () {
    const [ theOwner, theGasPayer] = accounts;
    const chainId = await minter.getChainId();
    // deadline is 1 hours ago from now
    const deadline = getDeadline(-3600)
    const targetAmount = BigNumber.from("114514191981000000")
    const tokenOwner = await theOwner.getAddress();
    await fanpiao.mint(tokenOwner, targetAmount);

    const spender = await theGasPayer.getAddress();
    const msg = {
      owner: tokenOwner,
      spender,
      value: targetAmount,
      nonce: (await fanpiao.nonces(spender)).toNumber(),
      deadline,
    };

    const signature = await (theOwner as providers.JsonRpcSigner)._signTypedData(
      {
        name: (await fanpiao.name()),
        version: "1",
        chainId: chainId,
        verifyingContract: fanpiao.address,
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
      fanpiao.permit(tokenOwner,spender, targetAmount, deadline, v, r,s)
    ).to.be.reverted;
  });

});
