import axios from 'axios';
import { config } from './config.js';

async function checkProposerDuties() {
  const beaconRpc = config.HOODI_BEACON_URL;
  console.log("Using beacon URL:", beaconRpc);
  
  try {
    // Get genesis data
    const genesis_data = await axios.get(`${beaconRpc}/eth/v1/beacon/genesis`);
    const genesis_time = parseInt(genesis_data.data.data.genesis_time);
    console.log("Genesis time:", genesis_time);

    // Calculate current epoch and slot
    const now = new Date().getTime() / 1000;
    const current_epoch = Math.floor((now - genesis_time) / (config.SECONDS_PER_SLOT * config.SLOTS_PER_EPOCH));
    const current_slot = Math.floor((now - genesis_time) / config.SECONDS_PER_SLOT);
    console.log("Current epoch:", current_epoch);
    console.log("Current slot:", current_slot);

    // Get proposer duties
    const proposer_duties = await axios.get(`${beaconRpc}/eth/v1/validator/duties/proposer/${current_epoch}`);
    console.log("Available proposer duties:", proposer_duties.data.data.length);
    
    // Show some sample duties
    console.log("Sample duties:");
    if (proposer_duties.data.data.length > 0) {
      for (let i = 0; i < Math.min(5, proposer_duties.data.data.length); i++) {
        console.log(proposer_duties.data.data[i]);
      }
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
  }
}

checkProposerDuties(); 