import { BigNumberish } from "ethers";

export type TransferOrder = {
  token: string;
  from: string;
  to: string;
  value: BigNumberish;
  isMint: false;
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
  isMint: true;
  deadline: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};

export type TransactionOrder = TransferOrder | MintOrder;

export type CreationPermit = {
  name: string;
  symbol: string;
  owner: string;
  tokenId: BigNumberish;
  initialSupply: BigNumberish;
  v: BigNumberish;
  r: string;
  s: string;
};
