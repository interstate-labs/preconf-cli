#! /usr/bin/env node

// import { program } from 'commander'
// import list from './commands/list'

import { Command } from 'commander';
import {sendPreconfirmationToSidecar, getProposer, getWallet, sendPreconfirmation, sleep, addWhitelist, addValidator, getValidators, checkSidecarInitialSetup, initializeRegistrySystem, registerProtocol, registerOperator,intialiseValidator } from './lib/index.js';

const program = new Command();

async function main() {
  // const wallet = await getWallet("helder", "6d35c1bdf469031cfe3cbaddd57ca69a36835a39c2a6f2cefc17c804851b0635");
  const wallet = await getWallet("hoodi", "2cb26dcd8b503c3a708448fb27ebd2f725ef1a1305014ec0e44a9f89d204ee0e");

  let price = {
    "type": "eth",
    "amount": "0.001"
  };

  sendPreconfirmationToSidecar(wallet, 'hoodi', price);

  price = {
    "type": "0x0643D39D47CF0ea95Dbea69Bf11a7F8C4Bc34968",
    "amount": "500"
  };

  // sendPreconfirmationToSidecar(wallet, 'devnet', price);

  // let options = {};
  // options['pvk'] = "c205b54d994e5285fffe8b890d48ce9396366c8c811c521e00df2abc268d1f14";
  // options["network"] = "holesky";
  // handleSend(options)


  return;

  program
    .name('preconf-cli')
    .description('CLI tool for testing preconfirmations on devnet or holesky or mainnet networks')
    .version('1.0.15');

  program
    .command('send-preconf')
    .description('Send a preconfirmation transaction to the specified network')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, or mainnet)")
    .option("-p, --pvk <type>", "[Optional] Private key used to sign the transaction")
    .option("-t, --tx <type>", "[Optional] rawSignedTx you would like to send")
    .addHelpText('after', `
Example:
  $ preconf-cli send-preconf -n devnet
  $ preconf-cli send-preconf -n holesky -p <your-private-key>
  $ preconf-cli send-preconf -n hoodi -p <your-private-key>
  $ preconf-cli send-preconf -n mainnet -p <your-private-key> -tx <your-signed-tx>
    `)
    .action(handleSend);

  program
    .command('whitelist-gateway')
    .description('Whitelist an entity to be allowed to make preconfirmation requests (typically a gateway)')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .requiredOption("-p, --pvk <type>", "[Required] Private key used to sign the transaction")
    .requiredOption("-i, --ip <type>", "[Required] IP Address of the entity that should be whitelisted to make preconfirmation requests on the network")
    .addHelpText('after', `
Example:
  $ preconf-cli whitelist-gateway -n devnet -p <your-private-key> -ip <your-ip-address>
  $ preconf-cli whitelist-gateway -n holesky -p <your-private-key> -ip <your-ip-address>
  $ preconf-cli whitelist-gateway -n hoodi -p <your-private-key> -ip <your-ip-address>
  $ preconf-cli whitelist-gateway -n mainnet -p <your-private-key> -ip <your-ip-address>
    `)
    .action(handleWhitelist);

  program
    .command('init-registry-system')
    .description('Initialize the registry system.')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .requiredOption("-p, --pvk <type>", "[Required] Private key used to sign the transaction")
    .requiredOption("-k, --pubk <type>", "[Required] Public Key of the address to be initialized")
    .addHelpText('after', `
Example:
  $ preconf-cli init-registry-system -n devnet -p <your-private-key> -k <public-key>
  $ preconf-cli init-registry-system -n holesky -p <your-private-key> -k <public-key>
  $ preconf-cli init-registry-system -n hoodi -p <your-private-key> -k <public-key>
  $ preconf-cli init-registry-system -n mainnet -p <your-private-key> -k <public-key>
    `)
    .action(handleInitializeRegistrySystem);

  program
    .command('register-protocol')
    .description('Register the protocol with the given address.')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .requiredOption("-p, --pvk <type>", "[Required] Private key used to sign the transaction")
    .requiredOption("-k, --pubk <type>", "[Required] Public Key of the protocol address to be initialized")
    .addHelpText('after', `
Example:
  $ preconf-cli register-protocol -n devnet -p <your-private-key> -k <public-key>
  $ preconf-cli register-protocol -n holesky -p <your-private-key> -k <public-key>
  $ preconf-cli register-protocol -n hoodi -p <your-private-key> -k <public-key>
  $ preconf-cli register-protocol -n mainnet -p <your-private-key> -k <public-key>
    `)
    .action(handleRegisterProtocol);

  program
    .command('register-operator')
    .description('Register the operator with the sidecar url.')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .requiredOption("-p, --pvk <type>", "[Required] Private key used to sign the transaction")
    .requiredOption("-k, --pubk <type>", "[Required] Public Key of the operator address to be initialized")
    .requiredOption("-i, --ip <type>", "[Required] IP Address with port number of the sidecar")
    .addHelpText('after', `
Example:
  $ preconf-cli register-operator -n devnet -p <your-private-key> -k <public-key> -i <your-ip-address>
  $ preconf-cli register-operator -n holesky -p <your-private-key> -k <public-key> -i <your-ip-address>
  $ preconf-cli register-operator -n hoodi -p <your-private-key> -k <public-key> -i <your-ip-address>
  $ preconf-cli register-operator -n mainnet -p <your-private-key> -k <public-key> -i <your-ip-address>
    `)
    .action(handleRegisterOperator);

    program
    .command('intialise-validator')
    .description('Register the validators with public key of operator address.')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .requiredOption("-p, --pvk <type>", "[Required] Private key used to sign the transaction")
    .requiredOption("-k, --pubk <type>", "[Required] Public Key of the operator to be registered")
    .addHelpText('after', `
Example:
  $ preconf-cli intialise-validator -n devnet -p <your-private-key> -k <validator-public-key>
  $ preconf-cli intialise-validator -n holesky -p <your-private-key> -k <validator-public-key>
  $ preconf-cli intialise-validator -n hoodi -p <your-private-key> -k <validator-public-key>
  $ preconf-cli intialise-validator -n mainnet -p <your-private-key> -k <validator-public-key>
    `)
    .action(intialiseValidatoSystem);

  program
    .command('register-validator')
    .description('Register the validators with public key of operator address.')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .requiredOption("-p, --pvk <type>", "[Required] Private key used to sign the transaction")
    .requiredOption("-k, --pubk <type>", "[Required] Public Key of the operator to be registered")
    .addHelpText('after', `
Example:
  $ preconf-cli register-validator -n devnet -p <your-private-key> -k <validator-public-key>
  $ preconf-cli register-validator -n holesky -p <your-private-key> -k <validator-public-key>
  $ preconf-cli register-validator -n hoodi -p <your-private-key> -k <validator-public-key>
  $ preconf-cli register-validator -n mainnet -p <your-private-key> -k <validator-public-key>
    `)
    .action(handleRegisterValidator);

  program
    .command('get-active-ips')
    .description('Get active validators (ip address & port)')
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .addHelpText('after', `
Example:
  $ preconf-cli get-active-ips -n devnet
  $ preconf-cli get-active-ips -n holesky
  $ preconf-cli get-active-ips -n hoodi
  $ preconf-cli get-active-ips -n mainnet
    `)
    .action(getValidators);


  program
    .command('healthcheck-sidecar')
    .description('Pings the sidecar and expects an ack to ensure the sidecar is responsive')
    .requiredOption("-i, --ip <type>", "[Required] IP Address of the sidecar")
    .requiredOption("-mp, --metrics_port <type>", "[Required] Port number of the metrics website in sidecar")
    .addHelpText('after', `
Example:
  $ preconf-cli healthcheck-sidecar -i <your-ip-address> -mp <port number of metrics website in sidecar>
    `)
    .action(healthcheckSidecar);

  program
    .command('check-sidecar-setup')
    .description('Check all components related to sidecar setup are working properly')
    .action(checkSidecarSetup)
    .requiredOption("-n, --network <type>", "[Required] Network to use (devnet, holesky, hoodi, mainnet)")
    .addHelpText('after', `
Example:
  $ preconf-cli check-sidecar-setup -n devnet
  $ preconf-cli check-sidecar-setup -n holesky
  $ preconf-cli check-sidecar-setup -n hoodi
  $ preconf-cli check-sidecar-setup -n mainnet
    `);

  await program.parseAsync(process.argv);
}


async function checkSidecarSetup(options) {
  const network = options['network'];
  console.log("Starting to check sidecar setup...");
  await checkSidecarInitialSetup(network);
}


async function healthcheckSidecar(options) {
  const ip_address = options['ip'];
  const metricsPort = options['metrics_port'];
  const url = "http://" + ip_address + ":" + metricsPort;

  try {
    const res = await fetch(url);
    if (res.ok) {
      console.log(`Sidecar is running on ${ip_address}`);
    }
  } catch (err) {
    console.log(`No sidecar running on ${ip_address}`);
  }

}

async function handleWhitelist(options) {
  const pvk = options['pvk'];
  const network = options["network"] ?? null;
  const ip_address = options['ip'];

  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }
  // TODO: Implement whitelist gateway functionality
  console.log(`Whitelisting gateway with IP ${ip_address} on network ${network}`);

  await addWhitelist(pvk, network, ip_address);
}

async function handleSend(options) {
  console.log("handling send")
  const pvk = options['pvk'] ?? "0x94eb3102993b41ec55c241060f47daa0f6372e2e3ad7e91612ae36c364042e44";
  const network = options["network"];
  const tx = options['tx'] ?? null;  // Will be null if tx is undefined


  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }
  const wallet = await getWallet(network, pvk);

  // const nonce = 0;
  let chainId = 0;
  if (network === "devnet") {
    chainId = 3151908;
  } else if (network === "holesky") {
    chainId = 17000;
  } else if (network === "hoodi") {
    chainId = 560048;
  } else if (network === "mainnet") {
    chainId = 1;
  }

  let nonce = await wallet.getNonce();
  // nonce = 3
  console.log('nonce', nonce);
  // let slot = await getLatestSlot(chainId);
  console.log('trying to get proposer');
  let proposer = await getProposer(chainId);
  let count = 1;
  
  while (!proposer) {
    proposer = await getProposer(chainId);
    count++;
    console.log(`tried ${count} times to find proposers, but not.`);

    await sleep(12)
  }

  // proposer = {
  //   slot: 3629801,
  //   validator_index: 1914685,
  //   sidecar_url: "http://95.216.145.221:9061",
  //   source: "interstate",
  //   validator_pubkey: "0x8a0fe780ad25de79582e8f95f6d795e08ab161df55842d1af3b02d591ab01c837e6d97e7d40d4b1cad1b94134b64e840",
  // }
  console.log('proposer', proposer)
  const data = await sendPreconfirmation(wallet, nonce, chainId, proposer, tx);
}

async function handleInitializeRegistrySystem(options) {
  const pvk = options['pvk'];
  const network = options["network"] ?? null;
  const publicKey = options['pubk'];

  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }

  console.log(`Initialize the registry system on network ${network}`);

  await initializeRegistrySystem(pvk, network, publicKey);
}

async function handleRegisterValidator(options) {
  const pvk = options['pvk'];
  const network = options["network"] ?? null;
  const operator_address = options['pubk'];

  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }

  console.log(`Registering validator with public key ${operator_address} on network ${network}`);

  await addValidator(pvk, network, operator_address);
}

async function intialiseValidatoSystem(options) {
  const pvk = options['pvk'];
  const network = options["network"] ?? null;
  const operator_address = options['pubk'];

  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }

  console.log(`Registering validator with public key ${operator_address} on network ${network}`);

  await intialiseValidator(pvk, network, operator_address);
}

async function handleRegisterProtocol(options) {
  const pvk = options['pvk'];
  const network = options["network"] ?? null;
  const publicKey = options['pubk'];

  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }

  console.log(`Registering protocol with given address on network ${network}`);

  await registerProtocol(pvk, network, publicKey);
}

async function handleRegisterOperator(options) {
  const pvk = options['pvk'];
  const network = options["network"] ?? null;
  const publicKey = options['pubk'];
  const ip_address = options['ip'];

  if (!(network === "devnet" || network === "holesky" || network === "hoodi" || network === "mainnet")) {
    console.log('Network can be only "devnet", "holesky", "hoodi", or "mainnet"');
    return;
  }

  console.log(`Registering operator with address ${publicKey} and ip address ${ip_address} on network ${network}`);

  await registerOperator(pvk, network, publicKey, ip_address);
}

main()

