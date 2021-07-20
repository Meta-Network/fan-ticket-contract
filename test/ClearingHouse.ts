import chai from "chai";
import { solidity } from "ethereum-waffle";
import { ethers } from "hardhat";
import { Signer, utils, providers, BigNumberish } from "ethers";
import type { FanPiaoV2 } from "../typechain/FanPiaoV2";
import type { FanPiaoClearingHouse } from "../typechain/FanPiaoClearingHouse";
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
  let fanpiaoA: FanPiaoV2;
  let fanpiaoB: FanPiaoV2;
  let clearingHouse: FanPiaoClearingHouse;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    minter = accounts[0];
    const FanPiaoV2 = await ethers.getContractFactory("FanPiaoV2");
    const ClearingHouse = await ethers.getContractFactory("FanPiaoClearingHouse");
    const fa = await FanPiaoV2.deploy("Test FanPiao A", "TFPA", minter.address);
    const fb = await FanPiaoV2.deploy("Test FanPiao A", "TFPB", minter.address);

    fanpiaoA = (await fa.deployed()) as FanPiaoV2;
    fanpiaoB = (await fb.deployed()) as FanPiaoV2;
    clearingHouse = await (await ClearingHouse.deploy()).deployed() as FanPiaoClearingHouse
    await fanpiaoA.mint(accounts[1].address, "1000000000000000000000000000000000000000000")
    await fanpiaoB.mint(accounts[2].address, "1000000000000000000000000000000000000000000")
  });

  it("transfer with permits", async function () {
    const [ _, fAOwner, fBOwner, ...rest ] = accounts;

    
    const ordersOfTokenA: TransferOrder[] = await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanpiaoA, clearingHouse, fAOwner, i.address, "1000000", idx)));
    const ordersOfTokenB: TransferOrder[] = await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanpiaoB, clearingHouse, fBOwner, i.address, "2000000", idx)));
    const orders: TransferOrder[] = [...ordersOfTokenA, ...ordersOfTokenB];
    const estGas = await clearingHouse.estimateGas.handleTransferOrders(orders)
    const estGasForNormalTransfer = await fanpiaoA.connect(fAOwner).estimateGas.transfer(fBOwner.address, '10000')

    console.info(`estimated Gas cost for ${orders.length} transfers: `, estGas.toString())
    console.info(`estimated Gas cost for 1 ERC20 normal transfers: `, estGasForNormalTransfer.toString())
    await chai.expect(
      clearingHouse.handleTransferOrders(orders)
    ).to.be.not.reverted;
    chai.expect(await fanpiaoA.balanceOf(accounts[5].address)).to.be.eq(1000000)
    chai.expect(await fanpiaoB.balanceOf(accounts[8].address)).to.be.eq(2000000)

    console.info(`Current GasLimit: ${(await fAOwner.provider?.getBlock('latest'))?.gasLimit.toString()}`)
    const estGasWACC = await clearingHouse.estimateGas.handleTransferOrders([
      ...await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanpiaoA, clearingHouse, fAOwner, i.address, "1000000", idx + 17))),
      ...await Promise.all(rest.map((i, idx) => TransferOrderConstuctor(fanpiaoB, clearingHouse, fBOwner, i.address, "2000000", idx + 17)))
    ])
    const estGasForNormalTransferWACC = await fanpiaoA.connect(fAOwner).estimateGas.transfer(accounts[5].address, '10000')

    console.info(`estimated Gas cost for ${orders.length} transfers (to acc with balance already): `, estGasWACC.toString())
    console.info(`estimated Gas cost for 1 ERC20 normal transfers (to acc with balance already): `, estGasForNormalTransferWACC.toString())
  });
});


async function TransferOrderConstuctor(token: FanPiaoV2, clearingHouse: FanPiaoClearingHouse, from: SignerWithAddress, to: string, value: BigNumberish, nonce: number): Promise<TransferOrder> {
  const deadline = getDeadline()
  const chainId = await from.getChainId();

  const signature = await (from as unknown as providers.JsonRpcSigner)._signTypedData(
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