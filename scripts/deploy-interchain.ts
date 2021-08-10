import { promises as fs } from 'fs';
import { JsonRpcProvider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { InterChainFanTicketFactory__factory } from '../typechain/factories/InterChainFanTicketFactory__factory';
import { MetaNetworkRoleRegistry__factory } from '../typechain/factories/MetaNetworkRoleRegistry__factory';
import { utils } from 'ethers';
import { config as loadEnvConfig } from "dotenv";
import { BigNumberish } from 'ethers';

// require('dotenv').config({})

type AddressBook = {
  Registry?: string;
  Factory?: string;
}



async function deployRegistry(wallet: Wallet, gasPrice: BigNumberish) {
  console.log('Deploying MetaNetworkRoleRegistry...');
  const deployTx = await new MetaNetworkRoleRegistry__factory(wallet).deploy({ gasPrice });
  console.log('Deploy TX: ', deployTx.deployTransaction.hash);
  await deployTx.deployed();
  console.log('MetaNetworkRoleRegistry deployed at ', deployTx.address);
  return deployTx.address;
}


async function deployFactory(wallet: Wallet, gasPrice: BigNumberish, registry: string){
  console.log('Deploying InterChain FanTicket Factory...');
  const factoryDeployTx = await new InterChainFanTicketFactory__factory(
    wallet
  ).deploy(registry, { gasPrice });
  console.log(`Deploy TX: ${factoryDeployTx.deployTransaction.hash}`);
  await factoryDeployTx.deployed();
  console.log(`Factory deployed at ${factoryDeployTx.address}`);
  return factoryDeployTx.address;
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
  const sharedAddressPath = `${process.cwd()}/addresses/interchain/${args.chainId}.json`;
  // @ts-ignore
  const addressBook = JSON.parse(await fs.readFile(sharedAddressPath)) as AddressBook;
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

  addressBook.Registry = await deployRegistry(wallet, gasPrice);

  addressBook.Factory = await deployFactory(wallet, gasPrice, addressBook.Registry);

  await fs.writeFile(sharedAddressPath, JSON.stringify(addressBook, null, 2));
  console.log(`Contracts deployed and configured. ☼☽`);
}

start().catch((e: Error) => {
  console.error(e);
  process.exit(1);
});
