import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, utils } from "ethers";
import { InterChainFanTicketFactory } from "../../typechain/InterChainFanTicketFactory";
import { InterChainFanTicket } from "../../typechain/InterChainFanTicket";
import {
  TransactionOrder,
  TransferOrder,
  MintOrder,
  InterChainCreationPermit,
} from "./typing";

export const getDeadline = (howManySecond = 3600) =>
  Math.floor(Date.now() / 1000) + howManySecond;

export function RandomOrderConstuctor(
  token: InterChainFanTicket,
  from: SignerWithAddress,
  to: string,
  value: BigNumberish,
  nonce: number
): Promise<TransactionOrder> {
  const whichFn =
    nonce % 2 === 0 ? TransferOrderConstuctor : MintOrderConstuctor;
  return whichFn(token, from, to, value, nonce);
}

export async function TransferOrderConstuctor(
  token: InterChainFanTicket,
  from: SignerWithAddress,
  to: string,
  value: BigNumberish,
  nonce: number,
  validPeriod = 3600
): Promise<TransferOrder> {
  const deadline = getDeadline(validPeriod);
  const chainId = await from.getChainId();

  const signature = await from._signTypedData(
    {
      name: await token.name(),
      version: "1",
      chainId: chainId,
      verifyingContract: token.address,
    },
    {
      Transfer: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        {
          name: "value",
          type: "uint256",
        },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      from: from.address,
      to,
      value,
      nonce,
      deadline,
    }
  );

  const { r, s, v } = utils.splitSignature(signature);

  return {
    token: token.address,
    from: from.address,
    to,
    value,
    _type: 0,
    deadline,
    v,
    r,
    s,
  };
}

export async function MintOrderConstuctor(
  token: InterChainFanTicket,
  from: SignerWithAddress,
  to: string,
  value: BigNumberish,
  nonce: number
): Promise<MintOrder> {
  const deadline = getDeadline();
  const chainId = await from.getChainId();

  const signature = await from._signTypedData(
    {
      name: await token.name(),
      version: "1",
      chainId: chainId,
      verifyingContract: token.address,
    },
    {
      Mint: [
        { name: "minter", type: "address" },
        { name: "to", type: "address" },
        {
          name: "value",
          type: "uint256",
        },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    {
      minter: from.address,
      to,
      value,
      nonce,
      deadline,
    }
  );

  const { r, s, v } = utils.splitSignature(signature);

  return {
    token: token.address,
    from: from.address,
    to,
    value,
    _type: 1,
    deadline,
    v,
    r,
    s,
  };
}

export async function signEIP2612Permit(
  fanTicket: InterChainFanTicket,
  theOwner: SignerWithAddress,
  spender: string,
  targetAmount: BigNumber,
  validPeriod = 3600
) {
  const chainId = await theOwner.getChainId();
  const deadline = getDeadline(validPeriod);
  const ownerAddress = await theOwner.getAddress();
  await fanTicket.mint(ownerAddress, targetAmount);

  const msg = {
    owner: ownerAddress,
    spender,
    value: targetAmount,
    nonce: (await fanTicket.nonces(spender)).toNumber(),
    deadline,
  };

  const signature = await theOwner._signTypedData(
    {
      name: await fanTicket.name(),
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

  const { r, s, v } = utils.splitSignature(signature);
  return {
    owner: ownerAddress,
    spender,
    value: targetAmount.toString(),
    nonce: msg.nonce,
    deadline,
    v,
    r,
    s,
  };
}

export async function CreationPermitConstuctor(
  factory: InterChainFanTicketFactory,
  adminWallet: SignerWithAddress,
  originAddress: string,
  name: string,
  symbol: string,
  tokenId: number,
  originChainId: BigNumberish
): Promise<InterChainCreationPermit> {
  const chainId = await adminWallet.getChainId();
  const signature = await adminWallet._signTypedData(
    {
      name: "InterChainFanTicketFactory",
      version: "1",
      chainId: chainId,
      verifyingContract: factory.address,
    },
    {
      CreationPermit: [
        { name: "originAddress", type: "address" },
        { name: "name", type: "string" },
        { name: "symbol", type: "string" },
        { name: "tokenId", type: "uint32" },
        { name: "originChainId", type: "uint256" },
      ],
    },
    {
      originAddress,
      name,
      symbol,
      tokenId,
      originChainId: originChainId.toString(),
    }
  );

  const { r, s, v } = utils.splitSignature(signature);

  return {
    originAddress,
    name,
    symbol,
    tokenId,
    originChainId: BigNumber.from(originChainId),
    v,
    r,
    s,
  };
}
