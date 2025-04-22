import { keccak256, Network } from "ethers";
import { ethers } from "ethers";
import { config } from "../config.js";
import axios from "axios";
import Web3 from "web3";
import { readFileSync, writeFileSync } from "fs";

const GatewayRegistryABI = JSON.parse(
  readFileSync(new URL("./GatewayRegistry.json", import.meta.url))
);
const OperatorRegistryABI = JSON.parse(
  readFileSync(new URL("./Registry.json", import.meta.url))
);
const ValidatorRegistryABI = JSON.parse(
  readFileSync(new URL("./ValidatorRegistry.json", import.meta.url))
);
const tokenABI = JSON.parse(
  readFileSync(new URL("./token.json", import.meta.url))
);

import pkg from "eth-revert-reason";
import Docker from "dockerode";
import stream from "stream";
import dotenv from "dotenv";
dotenv.config();
const { RevertReason } = pkg;

export async function sendPreconfirmation(
  wallet,
  nonce,
  chainId,
  proposer,
  inputSignedTx
) {
  // Define the transaction
  const tx = {
    chainId: chainId,
    nonce: nonce,
    from: await wallet.getAddress(),
    to: "0xe21B68796fF5BdbeE8f7285B2222AAd3c6c607b5",
    value: ethers.parseEther("0.0001"),
    maxFeePerGas: ethers.parseUnits("200", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
  };
  const estimatedGas = await wallet.estimateGas(tx);
  tx.gasLimit = estimatedGas;

  const populated = await wallet.populateCall(tx);
  let signedTx = await wallet.signTransaction(populated);
  if (inputSignedTx != null && inputSignedTx != null) {
    console.log("will user user provided signed tx", inputSignedTx);
    signedTx = inputSignedTx;
  }
  console.log("signedtx", signedTx, proposer);
  // Verify signed Tx is valid

  // if (chainId === 1) { // mainnet
  //   const provider = new ethers.JsonRpcProvider(config.MAINNET_RPC);
  //   const txReceipt = await provider.call(tx);
  //   console.log("Transaction Simulation:", txReceipt);
  // } else if (chainId === 17000) { // holesky
  //   const provider = new ethers.JsonRpcProvider(config.HOLESKY_RPC);
  //   const txReceipt = await provider.call(tx);
  //   console.log("Transaction Simulation:", txReceipt);
  // } else if (chainId === 3151908) { // devnet
  //   const provider = new ethers.JsonRpcProvider(config.DEVNET_RPC);
  //   const txReceipt = await provider.call(tx);
  //   console.log("Transaction Simulation:", txReceipt);
  // } else {
  //   throw err("network not recognized, pick one of holesky, devnet, mainnet");
  // }

  /// done verification
  // const txHash = keccak256(ethers.toUtf8Bytes(signedTx));
  const txHash = keccak256(signedTx);
  const slot = proposer.slot;
  // const slot = 1
  const slotBytes = numberToLittleEndianBytes(slot);
  const txHashBytes = hexToBytes(txHash);

  const message = new Uint8Array(slotBytes.length + txHashBytes.length);
  message.set(slotBytes);
  message.set(txHashBytes, slotBytes.length);
  const messageDigest = keccak256(message);
  const signature = await wallet.signingKey.sign(messageDigest).serialized;

  const sidecar_message = new Uint8Array(slotBytes.length + txHashBytes.length);


  // const holeskyGenesisTime = 1695902
  // const decayStartTimestamp = (holeskyGenesisTime + Number(slot)*12) * 1000

  if (proposer.source === "interstate") {
    const signer = await wallet.getAddress();
    const message1 = new Uint8Array(txHashBytes.length);
    message1.set(txHashBytes);
    const messageDigest1 = keccak256(message1);
    const signature1 = await wallet.signingKey.sign(messageDigest1).serialized;
    await axios.post(`${config.ROUTER_URL}/submit`, {
      proposer,
      signed_tx: signedTx,
      sidecar_signature: signature1,
      signature,
      signer,
    });
    console.log(
      `preconfirmation ${txHash} will be sent for slot ${slot} to validator:${proposer.validator_pubkey}}`
    );
  } else if (proposer.source === "bolt") {
    sidecar_message.set(txHashBytes);
    sidecar_message.set(slotBytes, txHashBytes.length);
    const messageDigest = keccak256(sidecar_message);
    const sidecar_signature = wallet.signingKey.sign(messageDigest).serialized;

    const signer = await wallet.getAddress();
    const body = {
      proposer,
      signed_tx: signedTx,
      sidecar_signature,
      signature,
      signer,
    };
    console.log("boday", body);
    try {
      await axios.post(`${config.ROUTER_URL}/submit`, body, {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      console.log("bolt submit error: ", err);
    }

    console.log(
      `preconfirmation with tx: ${txHash} will be sent for slot ${slot} to validator with index ${proposer.validator_index}`
    );
  } else if (proposer.source === "primev") {
    try {
      const signer = await wallet.getAddress();
      await axios.post(`${config.ROUTER_URL}/submit`, {
        proposer,
        signed_tx: signedTx,
        sidecar_signature: signature,
        signature,
        signer,
      });
      console.log(
        `preconfirmation with tx: ${txHash} will be sent for slot ${slot} to validator with index ${proposer.validator_index}`
      );
    } catch (err) {
      console.log("err mev-premev", err);
    }
  }
}

export async function addWhitelist(privateKey, chain, ip_address) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.DEVNET_GATEWAY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.MAINNET_GATEWAY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_GATEWAY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  // Smart contract details
  const contractABI =
    chain === "holesky" ? GatewayRegistryABI : GatewayRegistryABI.abi; // Replace with your contract's ABI

  const contract = new web3.eth.Contract(contractABI, contractAddress);

  // Private key and account details
  // const privateKey = '0x94eb3102993b41ec55c241060f47daa0f6372e2e3ad7e91612ae36c364042e44'; // Your private key
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);

  const fromAddress = account.address;

  // Function to send the transaction
  async function addGatewayIP(ip) {
    try {
      const gasEstimate = await contract.methods
        .addGatewayIP(ip)
        .estimateGas({ from: fromAddress });

      // Create the transaction
      const tx = {
        from: fromAddress,
        to: contractAddress,
        gas: gasEstimate,
        maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"), // Set your priority fee
        maxFeePerGas: web3.utils.toWei("50", "gwei"), // Set your max fee
        data: contract.methods.addGatewayIP(ip).encodeABI(),
      };

      // Sign the transaction
      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

      // Send the transaction
      const receipt = await web3.eth.sendSignedTransaction(
        signedTx.rawTransaction
      );
      console.log("Transaction successful with hash:", receipt.transactionHash);
    } catch (error) {
      console.error("Error adding gateway IP:", error);
    }
  }

  addGatewayIP(ip_address);
}

export async function intialiseValidator(privateKey, chain, validatorAddress) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.DEVNET_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.MAINNET_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  const contractABI =
    chain === "devnet" ? ValidatorRegistryABI : ValidatorRegistryABI.abi; // Replace with your contract's ABI

  const contract = new web3.eth.Contract(contractABI, contractAddress);
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);
  const fromAddress = account.address;

  try {
    const gasEstimate = await contract.methods
      .initialize(validatorAddress, config.DEVNET_PARAMETER_CONTRACT_ADDRESS)
      .estimateGas({ from: fromAddress });

    console.log(
      "initialize:gasEstimate",
      validatorAddress,
      config.DEVNET_PARAMETER_CONTRACT_ADDRESS
    );
    const tx = {
      from: fromAddress,
      to: contractAddress,
      gas: gasEstimate,
      maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"), // Set your priority fee
      maxFeePerGas: web3.utils.toWei("50", "gwei"), // Set your max fee
      data: contract.methods
        .initialize(validatorAddress, config.DEVNET_PARAMETER_CONTRACT_ADDRESS)
        .encodeABI(),
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // Send the transaction
    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    console.log(
      "Transaction successful with hash: initialize Validator ",
      receipt.transactionHash
    );
  } catch (error) {
    console.error("Error initialize Validator  :", error);
  }
}

export async function initializeRegistrySystem(
  privateKey,
  chain,
  validatorAddress
) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.HOLESKY_OPERATOR_REGISTRY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.HOLESKY_OPERATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_OPERATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  const contractABI =
    chain === "holesky" ? OperatorRegistryABI : OperatorRegistryABI.abi; // Replace with your contract's ABI

  const contract = new web3.eth.Contract(contractABI, contractAddress);
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);
  const fromAddress = account.address;
  try {
    const gasEstimate = await contract.methods
      .initializeSystem(
        validatorAddress,
        config.HOLESKY_PARAMETER_CONTRACT_ADDRESS,
        config.HOLESKY_VALIDATOR_REGISTRY_CONTRACT_ADDRESS
      )
      .estimateGas({ from: fromAddress });

    console.log(
      "initializeSystem:gasEstimate",
      validatorAddress,
      config.HOLESKY_PARAMETER_CONTRACT_ADDRESS,
      config.HOLESKY_VALIDATOR_REGISTRY_CONTRACT_ADDRESS
    );
    const tx = {
      from: fromAddress,
      to: contractAddress,
      gas: gasEstimate,
      maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"), // Set your priority fee
      maxFeePerGas: web3.utils.toWei("50", "gwei"), // Set your max fee
      data: contract.methods
        .initializeSystem(
          validatorAddress,
          config.HOLESKY_PARAMETER_CONTRACT_ADDRESS,
          config.HOLESKY_VALIDATOR_REGISTRY_CONTRACT_ADDRESS
        )
        .encodeABI(),
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // Send the transaction
    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    console.log(
      "Transaction successful with hash: initializeSystem ",
      receipt.transactionHash
    );
  } catch (error) {
    console.error("Error initializeSystem  :", error);
  }
}

export async function registerProtocol(privateKey, chain, protocolAddress) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.DEVNET_OPERATOR_REGISTRY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.MAINNET_OPERATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_OPERATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  // Smart contract details
  const contractABI =
    chain === "holesky" ? OperatorRegistryABI : OperatorRegistryABI.abi; // Replace with your contract's ABI

  // Create contract instance
  const contract = new web3.eth.Contract(contractABI, contractAddress);

  // Private key and account details
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);
  const fromAddress = account.address;

  // Function to send the transaction
  try {
    const gasEstimate = await contract.methods
      .registerProtocol(protocolAddress)
      .estimateGas({ from: fromAddress });
    console.log("registerProtocol");
    console.log("gasEstimate:registerProtocol", gasEstimate);
    // Create the transaction
    const tx = {
      from: fromAddress,
      to: contractAddress,
      gas: gasEstimate,
      maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"), // Set your priority fee
      maxFeePerGas: web3.utils.toWei("50", "gwei"), // Set your max fee
      data: contract.methods.registerProtocol(protocolAddress).encodeABI(),
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // Send the transaction
    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    console.log(
      "Transaction successful with hash: registerProtocol",
      receipt.transactionHash
    );
  } catch (error) {
    console.error("Error Registering protocol :", error);
  }

  registerProtocol();
}

export async function registerOperator(
  privateKey,
  chain,
  operatorAddress,
  endpointUrl
) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.DEVNET_OPERATOR_REGISTRY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.MAINNET_OPERATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_OPERATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  // Smart contract details
  const contractABI =
    chain === "holesky" ? OperatorRegistryABI : OperatorRegistryABI.abi; // Replace with your contract's ABI

  // Create contract instance
  const contract = new web3.eth.Contract(contractABI, contractAddress);

  // Private key and account details
  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);
  const fromAddress = account.address;
  try {
    // console.log("ENdp",endpointUrl);
    const gasEstimate = await contract.methods
      .enrollOperatorNode(
        operatorAddress,
        endpointUrl,
        endpointUrl,
        endpointUrl
      )
      .estimateGas({ from: fromAddress });

    // Create the transaction
    const tx = {
      from: fromAddress,
      to: contractAddress,
      gas: gasEstimate,
      maxPriorityFeePerGas: web3.utils.toWei("2", "gwei"), // Set your priority fee
      maxFeePerGas: web3.utils.toWei("50", "gwei"), // Set your max fee
      data: contract.methods
        .enrollOperatorNode(
          operatorAddress,
          endpointUrl,
          endpointUrl,
          endpointUrl
        )
        .encodeABI(),
    };

    // Sign the transaction
    const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // Send the transaction
    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );
    console.log(
      "Transaction successful with hash:adding operator",
      receipt.transactionHash
    );
  } catch (error) {
    console.error("Error adding operator :", error);
  }
}

export async function addValidator(privateKey, chain, operatorAddress) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.DEVNET_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.MAINNET_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  // Smart contract details
  const contractABI =
    chain === "devnet" ? ValidatorRegistryABI : ValidatorRegistryABI.abi; // Replace with your contract's ABI

  // Create contract instance
  const contract = new web3.eth.Contract(contractABI, contractAddress);

  // console.log(contract.methods);

  const validators = await contract.methods.fetchAllValidatorNodes().call();
  console.log("Fetched Validator Nodes: ", validators);
  const validatorDetails = [];
  for (let i = 0; i < validators.length; i++) {
    console.log(i);
    console.log("Validator Details:", validators[i]);
    validatorDetails.push(validators[i]);
  }



  const owner = await contract.methods.owner().call();
  // console.log("owner ", owner);

  const account = web3.eth.accounts.privateKeyToAccount(`0x${privateKey}`);
  const fromAddress = account.address;
  try {
    const validators = await fetchValidators();
    // console.log("validator", validators);
    let pkArray = [];

    // const publicKey =
    //   "0xa03c2a82374e04b2e0594c4ce14fb3f225b46f13188f0d8002a523c7dcfb939ae4856053c2c9c695374d7c3685df1ca5";

    // pkArray.push(temp);
    // pkArray.push([
    //   [
    //     "0xa03c2a82374e04b2e0594c4ce14fb3f2",
    //     "0x25b46f13188f0d8002a523c7dcfb939a",
    //   ],
    //   [
    //     "0xe4856053c2c9c695374d7c3685df1ca5",
    //     "0x00000000000000000000000000000000",
    //   ],
    // ]);

    // [[["0xa03c2a82374e04b2e0594c4ce14fb3f2","0x25b46f13188f0d8002a523c7dcfb939a"],["0xe4856053c2c9c695374d7c3685df1ca5","0x00000000000000000000000000000000"]]]

    // console.log("Pkar", pkArray);
    let rpcArray = "http://162.55.190.235:9061";

    console.log(validators.length);
    for (let i = 0; i < validators.length; i++) {


      const publicKey = validators[i];
      // console.log("publoc", publicKey);

      const pubkeyX = [
        publicKey.slice(2, 34)
          ? `0x${publicKey.slice(2, 34)}`
          : "0x00000000000000000000000000000000",
        publicKey.slice(34, 66)
          ? `0x${publicKey.slice(34, 66)}`
          : "0x00000000000000000000000000000000",
      ];

      // console.log("pubkeyX", pubkeyX);

      const pubkeyY = [
        publicKey.slice(66, 98)
          ? `0x${publicKey.slice(66, 98)}`
          : "0x00000000000000000000000000000000",
        publicKey.slice(98, 130)
          ? `0x${publicKey.slice(98, 130)}`
          : "0x00000000000000000000000000000000",
      ];

      // console.log("pubkeyY", pubkeyY);

      pkArray.push([pubkeyX, pubkeyY]);


    }

    // rpcArray.push();
    // console.log("parra", pkArray);
    // [
    //   [
    //     "0x12c8765aa3dcf5a1b2e5c7d2bc8f9e8a0f90e6d9f8b02a7d3c5b4879d7f6e934",
    //     "0x34f5678aa3df56a1b2e5c7d2bc8f9e8a0f90e6d9f8b02a7d3c5b4879d7f6f123",
    //   ],
    //   [
    //     "0x1b4c28fa7c3421345eafdc903d2bce74d5c76b42ed9a8b1c3f6d7f8b3e4f5d67",
    //     "0x45c5678bb4cd23b2e5d7d8c1b9f123e8a0f12e9b3d7c5f6e4b9f8a1c2d34567",
    //   ],
    // ];
    //  rpcArray.push[("")];
    // }
    // for (let i = 0; i < validators.length; i++) {

    //   pkArray.push({
    //     x: [
    //       BigInt(`${validators[i].pubkey.slice(0, 64)}`),
    //       BigInt(`0x0${validators[i].pubkey.slice(64, 128)}`),
    //     ],
    //     y: [
    //       BigInt(`0x0${validators[i].pubkey.slice(128, 192)}`),
    //       BigInt(`0x0${validators[i].pubkey.slice(192, 256)}`),
    //     ],
    //   });
    //   rpcArray.push("http://162.55.190.235:32798");
    // }

    // console.log("bi", contract.methods);
    // console.log(
    //   pkArray,
    //   rpcArray,
    //   operatorAddress,
    //   config.MAXIMUM_GAS_COMMITMENT
    // );
    // const gasEstimate = await contract.methods
    //   .bulkEnrollValidatorsWithVerification(
    //     pkArray,
    //     rpcArray,
    //     config.MAXIMUM_GAS_COMMITMENT
    //   )
    //   .estimateGas({ from: fromAddress });

    // console.log("gasEstimate", gasEstimate);

    // // Create the transaction
    // const tx = {
    //   from: fromAddress,
    //   to: contractAddress,
    //   gas: gasEstimate,
    //   maxPriorityFeePerGas: web3.utils.toWei("20", "gwei"), // Set your priority fee
    //   maxFeePerGas: web3.utils.toWei("70", "gwei"), // Set your max fee
    //   data: contract.methods
    //     .bulkEnrollValidatorsWithVerification(
    //       pkArray,
    //       rpcArray,
    //       config.MAXIMUM_GAS_COMMITMENT
    //     )
    //     .encodeABI(),
    // };

    // // Sign the transaction
    // const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);

    // // Send the transaction
    // const receipt = await web3.eth.sendSignedTransaction(
    //   signedTx.rawTransaction
    // );
    // console.log(
    //   "Transaction successful with hash:adding validator",
    //   receipt.transactionHash
    // );
  } catch (error) {
    console.error("Error adding validator :", error);
  }
}

export async function getValidators(privateKey, chain) {
  let rpcUrl = config.DEVNET_RPC;
  let contractAddress = config.DEVNET_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;

  if (chain === "mainnet") {
    rpcUrl = config.MAINNET_RPC;
    contractAddress = config.MAINNET_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  if (chain === "holesky") {
    rpcUrl = new Web3(config.HOLESKY_RPC);
    contractAddress = config.HOLESKY_VALIDATOR_REGISTRY_CONTRACT_ADDRESS;
  }

  const web3 = new Web3(rpcUrl);

  // Smart contract details
  const contractABI =
    chain === "holesky" ? GatewayRegistry : GatewayRegistry.abi; // Replace with your contract's ABI

  // Create contract instance

  const contract = new web3.eth.Contract(contractABI, contractAddress);

  // Function to get validators
  async function fetchValidators() {
    try {
      const validators = await contract.methods.getValidators().call();
      console.log("Validator Details:", validatorDetails);
      return validators; // Return the details for further processing if needed
    } catch (error) {
      console.error("Error fetching validator details:", error);
    }
  }

  return fetchValidators();
}

export async function checkSidecarInitialSetup(network) {
  const docker = new Docker();
  const cbId = "cb_pbs";
  const sidecarId = "mev-sidecar-api";
  const cb_container = docker.getContainer(cbId);
  const sidecar_container = docker.getContainer(sidecarId);

  let sidecarConnectedToBeacon = false;
  let cbConnectedToRelay = false;
  let sidecarConnectedToCb = false;
  let relayConnected = false;

  let logStream = new stream.PassThrough();
  logStream.on("data", function (chunk) {
    const line = chunk.toString("utf8");
    console.log(line);
  });

  cb_container.logs(
    {
      stdout: true,
      stderr: true,
      tail: "100",
    },
    function (err, lines) {
      if (err) {
        console.log("err", err);
      }
      const line = lines.toString("utf8");
      if (line.includes("get_header_with_proofs")) {
        cbConnectedToRelay = true;
        sidecarConnectedToCb = true;
        relayConnected = true;
      } // from commit boost logs
    }
  );

  sidecar_container.logs(
    {
      stdout: true,
      stderr: true,
      tail: "100",
    },
    function (err, buffer) {
      if (err) {
        console.log("err", err);
      }
      const data = buffer.toString("utf8");
      if (data.includes("Got received a new head event"))
        sidecarConnectedToBeacon = true; // from sidecar logs
      if (data.includes("got valid proofs of header"))
        sidecarConnectedToCb = true;
    }
  );

  setTimeout(async function () {
    if (sidecarConnectedToBeacon)
      console.log("Sidecar is connected to beacon node.");
    else
      console.log(
        "Sidecar isn't connected to beacon node properly. Set correctly the BEACON_API_URL to beacon node api url in .config file"
      );

    if (sidecarConnectedToCb)
      console.log("Sidecar is connected to commit boost.");
    else
      console.log(
        "Sidecar isn't connected to commit boost properly. Set correctly the COLLECTOR_URL to commit boost url in .config file "
      );

    if (cbConnectedToRelay) console.log("Commit boost is connected to realy");
    else
      console.log(
        "Commit boost isn't connected to relay properly. Set correctly the relay to relay url in cb-config.toml"
      );

    if (
      sidecarConnectedToBeacon &&
      sidecarConnectedToCb &&
      cbConnectedToRelay
    ) {
      console.log("Sidecar is set up properly !!!");
      console.log("Sending preconf request to sidecar for test");
      let wallet;
      switch (network) {
        case "devnet": {
          const networkInstance = new Network("kurtosis", 3151908);
          const provider = new ethers.JsonRpcProvider(
            process.env.DEVNET_RPC,
            networkInstance,
            { staticNetwork: networkInstance }
          );
          wallet = new ethers.Wallet(
            process.env.PRECONF_TX_SENDER_PVK,
            provider
          );
          break;
        }
        case "holesky": {
          const provider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC);
          wallet = new ethers.Wallet(
            process.env.PRECONF_TX_SENDER_PVK,
            provider
          );
          break;
        }
        case "mainnet": {
          const provider = new ethers.JsonRpcProvider(process.env.MAINNET_RPC);
          wallet = new ethers.Wallet(
            process.env.PRECONF_TX_SENDER_PVK,
            provider
          );
          break;
        }
        default:
          break;
      }
      // checking by sending 0.001 ETH
      const price = {
        "type": "eth",
        "amount": "0.001"
      };

      await sendPreconfirmationToSidecar(wallet, network, price);
    }
  }, 4000);
}

export async function getProposer() {
  try {
    // const { data } = await axios.get(`${config.HOLESKY_BOLT_GATEWAY_URL}/api/v1/proposers/lookahead?activeOnly=true&futureOnly=true`);
    const { data } = await axios.get(`${config.ROUTER_URL}/proposer`);
    console.log("data is", data);
    if (data != []) return data;
    else return;
  } catch (err) {
    console.log("err", err);
    return;
  }
}

export async function getWallet(network, pvk) {
  if (network === "mainnet") {
    const provider = new ethers.JsonRpcProvider(config.MAINNET_RPC);
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  } else if (network === "holesky") {
    const provider = new ethers.JsonRpcProvider(config.HOLESKY_RPC);
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  } else if (network === "devnet") {
    const network = new Network("kurtosis", 3151908);
    const provider = new ethers.JsonRpcProvider(config.DEVNET_RPC, network, {
      staticNetwork: network,
    });
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  } else if (network === "helder") {
    const network = new Network("helder", 7014190335);
    const provider = new ethers.JsonRpcProvider(config.HELDER_RPC, network, {
      staticNetwork: network,
    });
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  }

  else if (network === "hoodi") {
    const network = new Network("hoodi", 7014190335);
    const provider = new ethers.JsonRpcProvider(config.HOODI_RPC, network, {
      staticNetwork: network,
    });
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  }
}

export function sleep(sec) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), sec * 1000);
  });
}

// Function to convert a number to a little-endian byte array
function numberToLittleEndianBytes(num) {
  const buffer = new ArrayBuffer(8); // Assuming slot_number is a 64-bit integer
  const view = new DataView(buffer);
  view.setUint32(0, num, true); // true for little-endian

  let ary = new Uint8Array(buffer);
  return ary.reverse();
}

// Function to decode a hex string to a byte array
function hexToBytes(hex) {
  hex = hex.replace(/^0x/, ""); // Remove "0x" prefix if present
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function publicKeyToAddress(web3, publicKey) {
  // Step 1: Remove the '0x' prefix if present
  if (publicKey.startsWith("0x")) {
    publicKey = publicKey.slice(2);
  }

  // Step 2: Hash the public key using Keccak-256
  const hash = web3.utils.keccak256(publicKey);

  // Step 3: Extract the last 40 characters (20 bytes) to get the address
  const address = "0x" + hash.slice(-40);
  return address;
}

async function getAvailableProposerDuties(network) {
  let chainId = 0;
  let beaconRpc = "";

  switch (network) {
    case "devnet":
      chainId = 3151908;
      beaconRpc = config.DEVNET_BEACON_URL;
      break;
    case "holesky":
      chainId = 17000;
      beaconRpc = config.HOLESKY_BEACON_URL;
      break;
    case "mainnet":
      chainId = 1;
      beaconRpc = config.MAINNET_BEACON_URL;
      break;
    case "helder":
      chainId = 7014190335;
      beaconRpc = config.HELDER_BEACON_URL;
      break;
    case "hoodi":
      chainId = 560048;
      beaconRpc = config.HOODI_BEACON_URL;
      break;
    default:
      break;
  }
  const genesis_data = await axios.get(`${beaconRpc}/eth/v1/beacon/genesis`);
  const genesis_time = parseInt(genesis_data.data.data.genesis_time);
  console.log("genesis_time", genesis_time);

  const now = new Date().getTime() / 1000;

  const current_epoch = Math.floor((now - genesis_time) / (config.SECONDS_PER_SLOT * config.SLOTS_PER_EPOCH));
  const current_slot = Math.floor((now - genesis_time) / config.SECONDS_PER_SLOT);
  console.log("current_slot", current_slot);
  const proposer_duties = await axios.get(`${beaconRpc}/eth/v1/validator/duties/proposer/${current_epoch}`);
  const available_duties = proposer_duties.data.data;
  
  // For testing purposes: If using Hoodi network, bypass validator check
  if (network === "hoodi") {
    console.log("Using Hoodi network - bypassing validator check for testing purposes");
    // Just return the next available proposer duty
    for (let i = 0; i < available_duties.length; i++) {
      if (parseInt(available_duties[i].slot) > current_slot) {
        console.log("Found future proposer:", available_duties[i]);
        return [available_duties[i]];
      }
    }
  }
  
  // Normal flow for other networks
  const validators = await fetchValidators();
  let result = [];
  for (let i = 0; i < available_duties.length; i++) {
    if (parseInt(available_duties[i].slot) <= current_slot) {
      continue;
    }
    if (validators.findIndex(x => x == available_duties[i].pubkey) != -1) {
      result.push(available_duties[i]);
    }
  }
  return result;
}

export async function sendPreconfirmationToSidecar(wallet, network, price) {
  let chainId = 0;

  switch (network) {
    case "devnet":
      chainId = 3151908;
      break;
    case "holesky":
      chainId = 17000;
      break;
    case "mainnet":
      chainId = 1;
      break;
    case "helder":
      chainId = 7014190335;
      break;
    case "hoodi":
      chainId = 560048;
      break;
    default:
      break;
  }
  let proposer_duties = await getAvailableProposerDuties(network);
  
  // Limit the number of retries
  let retryCount = 0;
  const maxRetries = 3;
  
  let proposer_timer = async () => {
    proposer_duties = await getAvailableProposerDuties(network);
    if (proposer_duties.length == 0) {
      console.log("No Available Proposer!");
      retryCount++;
      if (retryCount < maxRetries) {
        await proposer_timer();
      } else {
        console.log(`Reached maximum retry attempts (${maxRetries}). Please check your validators.json file.`);
        if (network === "hoodi") {
          console.log("For testing with Hoodi network, make sure you're using the modified getAvailableProposerDuties function.");
        }
        return;
      }
    }
  }
  
  await proposer_timer();
  
  // If we still don't have proposer duties after retries, exit
  if (proposer_duties.length == 0) {
    console.log("Could not find any available proposer duties. Exiting.");
    return;
  }
  
  const slot = parseInt(proposer_duties[0].slot);
  console.log("Sending preconfirmation to the slot ", slot);
  const sender = await wallet.getAddress();
  const nonce = await wallet.getNonce("pending");
  // const nonce = await wallet.provider.send("eth_getTransactionCount", [sender, "pending"]).then((n) => parseInt(n, 16));
  console.log("nonce", nonce);
  const feeData = await wallet.provider.getFeeData();
  let tx = null;

  if (price.type == "eth") {
    // Define the transaction that send eth
    tx = {
      nonce,
      chainId: chainId,
      from: sender,
      to: "0xe21B68796fF5BdbeE8f7285B2222AAd3c6c607b5",
      value: ethers.parseEther(price.amount),
      maxFeePerGas: ethers.parseUnits("300", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("40", "gwei"),
      data: "0xdeadbeef",
    };
  } else {
    // Define ERC-20 contract
    const tokenContractAddress = price.type;
    // const tokenContractAddress = "0x0643D39D47CF0ea95Dbea69Bf11a7F8C4Bc34968"; // Replace with actual token address
    const to = "0xE25583099BA105D9ec0A67f5Ae86D90e50036425"; // Receiver
    // Encode ERC-20 transfer function
    const tokenInterface = new ethers.Interface(tokenABI);

    const sendAmount = ethers.parseUnits(price.amount, 18);  // 5000 token, decimal is 18
    const dataField = tokenInterface.encodeFunctionData("transfer", [to, sendAmount]);

    // Define the transaction for ERC-20 transfer
    tx = {
      nonce,
      chainId: chainId,
      to: tokenContractAddress, // Send to token contract
      value: 0n, // No ETH sent
      maxFeePerGas: ethers.parseUnits("300", "gwei"), // Corrected
      maxPriorityFeePerGas: ethers.parseUnits("40", "gwei"), // Corrected
      data: dataField, // Encoded transfer function
    };
  }

  const estimatedGas = await wallet.estimateGas(tx);
  tx.gasLimit = estimatedGas;
  console.log("estimatedGas", estimatedGas);

  const signedTx = await wallet.signTransaction(tx);

  const txHash = keccak256(signedTx);
  // const txHash = keccak256(ethers.Transaction.from(tx).serialized);

  const txHashBytes = hexToBytes(txHash);
  const slotBytes = numberToLittleEndianBytes(slot);


  const message = new Uint8Array(txHashBytes.length + slotBytes.length);

  message.set(slotBytes);
  message.set(txHashBytes, slotBytes.length);

  const messageDigest = keccak256(message);
  const signature = await wallet.signingKey.sign(messageDigest).serialized;

  console.log("GATEWAY_URL", config.GATEWAY_URL);
  // return;
  try {
    const { data } = await axios.post(`${config.GATEWAY_URL}/api/v1/preconfirmation`, {
      txs: [signedTx],
      sender,
      slot,
      signature,
      chain_id: chainId,
    });

    console.log('res', data);
    if (data.signed_contraints_list && data.signed_contraints_list.length > 0) {
      console.log('message details:', JSON.stringify(data.signed_contraints_list[0].message, null, 2));
    }
    console.log("txs", signedTx);
    console.log(
      `sent preconfirmation tx: ${txHash} at slot ${slot} at nonce ${nonce}`
    );


  } catch (err) {
    console.log("Error sending preconfirmation:");
    console.error(err.message);
    
    if (err.response) {
      console.log("Response status:", err.response.status);
      if (err.response.data) {
        console.log("Response data:", err.response.data);
      }
    } else {
      console.log("No response from server. Check your network connection or gateway URL.");
      console.log("Gateway URL:", config.GATEWAY_URL);
    }
  }

}


export async function fetchValidators() {
  try {
    const validatorsJson = await readFileSync(new URL("./validators.json", import.meta.url));
    return JSON.parse(validatorsJson);
  } catch (error) {
    console.error("Error fetching validators:", error);
    return [];
  }
}
