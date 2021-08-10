import { promises as fs } from 'fs';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { InterChainParking__factory } from '../typechain/factories/InterChainParking__factory';
import { MetaNetworkRoleRegistry__factory } from '../typechain/factories/MetaNetworkRoleRegistry__factory';
import { FanTicketFactory__factory } from '../typechain/factories/FanTicketFactory__factory';
import { FanTicketClearingHouse__factory } from '../typechain/factories/FanTicketClearingHouse__factory';
import { utils } from 'ethers';
import { config as loadEnvConfig } from "dotenv";
import { BigNumberish } from 'ethers';

// require('dotenv').config({})

type AddressBook = {
  Registry?: string;
  Factory?: string;
  ClearingHouse?: string;
  Parking?: string;
}

async function deployInterChainParking(wallet: Wallet, gasPrice: BigNumberish, networkOperator: string) {
  // Parking Contract
  console.log('Deploying Parking...');
  const parkingDeployTx = await new InterChainParking__factory(
    wallet
  ).deploy(networkOperator, { gasPrice });
  console.log(`Deploy TX: ${parkingDeployTx.deployTransaction.hash}`);
  await parkingDeployTx.deployed();
  console.log(`Parking deployed at ${parkingDeployTx.address}`);
  return parkingDeployTx.address;
}

async function start() {
  const args = require('minimist')(process.argv.slice(2));

  if (!args.chainId) {
    throw new Error('--chainId chain ID is required');
  }
  const loadEnvFile = `.env.${args.chainId}`;
  console.info(`Loading local env file: ${loadEnvFile}`)
  loadEnvConfig({
    path: loadEnvFile
  })
  const gasPrice = utils.parseUnits(args.gasPrice || '20', 'gwei');

  const provider = new JsonRpcProvider(process.env.RPC_ENDPOINT);
  const wallet = new Wallet(`0x${process.env.PRIVATE_KEY}`, provider);
  const sharedAddressPath = `${process.cwd()}/addresses/${args.chainId}.json`;
  // @ts-ignore
  const addressBook = JSON.parse(await fs.readFile(sharedAddressPath)) as AddressBook;


  if (!addressBook.Parking) {
    const networkOperator = wallet.address;

    // Deploying Parking Contract
    addressBook.Parking = await deployInterChainParking(wallet, gasPrice, networkOperator);
  }

  if (addressBook.ClearingHouse) {
    throw new Error(
      `ClearingHouse already exists in address book at ${sharedAddressPath}. Please move it first so it is not overwritten`
    );
  }
  if (addressBook.Factory) {
    throw new Error(
      `Factory already exists in address book at ${sharedAddressPath}. Please move it first so it is not overwritten`
    );
  }
  if (addressBook.Registry) {
    throw new Error(
      `Registry already exists in address book at ${sharedAddressPath}. Please move it first so it is not overwritten`
    );
  }

  console.log('Deploying MetaNetworkRoleRegistry...');
  const deployTx = await new MetaNetworkRoleRegistry__factory(wallet).deploy({ gasPrice });
  console.log('Deploy TX: ', deployTx.deployTransaction.hash);
  await deployTx.deployed();
  console.log('MetaNetworkRoleRegistry deployed at ', deployTx.address);
  addressBook.Registry = deployTx.address;

  console.log('Deploying FanTicket Factory...');
  const factoryDeployTx = await new FanTicketFactory__factory(
    wallet
  ).deploy(addressBook.Registry, { gasPrice });
  console.log(`Deploy TX: ${factoryDeployTx.deployTransaction.hash}`);
  await factoryDeployTx.deployed();
  console.log(`Factory deployed at ${factoryDeployTx.address}`);
  addressBook.Factory = factoryDeployTx.address;

  console.log('Deploying Clearing House...');
  const clearingDeployTx = await new FanTicketClearingHouse__factory(
    wallet
  ).deploy({ gasPrice });
  console.log(`Deploy TX: ${clearingDeployTx.deployTransaction.hash}`);
  await clearingDeployTx.deployed();
  console.log(`Factory deployed at ${clearingDeployTx.address}`);
  addressBook.ClearingHouse = clearingDeployTx.address;

  await fs.writeFile(sharedAddressPath, JSON.stringify(addressBook, null, 2));
  console.log(`Contracts deployed and configured. ☼☽`);
}

start().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
