import { keccak256, Network } from "ethers";
import { ethers } from "ethers";
import axios from "axios";
import dotenv from 'dotenv';
dotenv.config();

export async function createPreconfPayload(
  wallet,
  nonce,
  chainId,
){
   // Define the transaction
   const tx = {
    chainId: chainId,
    nonce: nonce,
    from: await wallet.getAddress(),
    to: "0xdeaDDeADDEaDdeaDdEAddEADDEAdDeadDEADDEaD",
    value: ethers.parseEther("0.0069420"),
    maxFeePerGas: ethers.parseUnits("200", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
    data: "0xdeadbeef",
  };

  const estimatedGas = await wallet.estimateGas(tx);
  tx.gasLimit = estimatedGas;

  const populated = await wallet.populateCall(tx);
  const signedTx = await wallet.signTransaction(populated);
  const txHash = keccak256(signedTx);

  // const {data: preconfers} = await axios.get(`${DEVNET_GATEWAY_URL}/preconfers`)

  // Create a signature over the request fields "slot" and "tx" using the same signer
  // to authenticate the preconfirmation request through bolt.
  let slot = await getLatestSlot();
  // const nextPreconfer = preconfers.find((preconfer)=>preconfer.slot>slot)
  // if(!nextPreconfer) return { payload: undefined, txHash: undefined, rpc: undefined };
  // slot = nextPreconfer.slot
  slot += 4;
  const slotBytes = numberToLittleEndianBytes(slot);
  const txHashBytes = hexToBytes(txHash);
  const message = new Uint8Array(slotBytes.length + txHashBytes.length);
  message.set(slotBytes);
  message.set(txHashBytes, slotBytes.length);

  const messageDigest = keccak256(message);
  const signature = wallet.signingKey.sign(messageDigest).serialized;

  // return { payload: { slot, tx: signedTx, signature }, txHash, rpc: nextPreconfer.rpc };
  return { payload: { slot, tx: signedTx, signature }, txHash, rpc: process.env.INTERSTATE_SIDECAR_URL };

}

export async function getLatestSlot(){
  const slotResponse = await fetch(`${process.env.DEVNET_GATEWAY_URL}/latest-slot`).then(
    (response) => response.json(),
  );
  return Number(slotResponse.slot);
}

export async function getWallet(network, pvk){
  if(network==="devnet"){
    const network = new Network('kurtosis', 3151908)
    const provider = new ethers.JsonRpcProvider(process.env.DEVNET_RPC, network, { staticNetwork: network });
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  }else if(network==="holesky"){
    const network = new Network('holesky', 17000)
    const provider = new ethers.JsonRpcProvider(process.env.HOLESKY_RPC, network, { staticNetwork: network });
    const wallet = new ethers.Wallet(pvk, provider);
    return wallet;
  }

}

export async function sendPreconfirmation(payload) {
  try{
    const { data } = await axios.post(`${process.env.DEVNET_GATEWAY_URL}/preconfirmation`, payload);
    console.log(data);
    console.log(`Preconfirmation response was successful in slot ${data.slot}`);
  }catch(err){
    console.log('err:', err);
  }
}

// Function to convert a number to a little-endian byte array
function numberToLittleEndianBytes(num) {
  const buffer = new ArrayBuffer(8); // Assuming slot_number is a 64-bit integer
  const view = new DataView(buffer);
  view.setUint32(0, num, true); // true for little-endian
  return new Uint8Array(buffer);
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
