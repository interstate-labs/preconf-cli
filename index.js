#! /usr/bin/env node

// import { program } from 'commander'
// import list from './commands/list'

import { Command } from 'commander';
import { createPreconfPayload, getWallet, sendPreconfirmation } from './lib/index.js';

const program = new Command();

async function main() {
  program
    .description("My Node CLI")
    .requiredOption("-n, --network <type>", "devnet or holesky")
    .requiredOption("-p, --pvk <type>", "Private key to sign a transaction")
    .action(run);
  await program.parseAsync(process.argv);
}


async function run(options) {
  const pvk = options['pvk'];
  const network = options["network"];
  if(!(network==="devnet" || network==="holesky")) {
    console.log('Network can be only "devnet" or "holesky"');
    return;
  }
  const wallet = await getWallet(network, pvk);
  // const nonce = 0;
  let chainId = 0;
  if(network === "devnet"){
    chainId = 3151908;
  }else{
    chainId = 17000;
  }
  const nonce = await wallet.getNonce();
  const { payload, txHash, rpc } = await createPreconfPayload(wallet, nonce, chainId);
  payload['rpc'] = rpc;
  sendPreconfirmation(payload)
}

main()