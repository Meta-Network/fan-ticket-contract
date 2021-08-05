import { BigNumberish } from "ethers";

export type TransferOrder = {
  token: string;
  from: string;
  to: string;
  value: BigNumberish;
  _type: number;
  deadline: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};

export type MintOrder = {
  token: string;
  from: string;
  to: string;
  value: BigNumberish;
  _type: number;
  deadline: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};

export type TransactionOrder = TransferOrder | MintOrder;

export type InterChainCreationPermit = {
  originAddress: string;
  name: string;
  symbol: string;
  tokenId: BigNumberish;
  originChainId: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};
