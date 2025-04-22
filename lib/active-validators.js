import { createClient } from 'redis';
import { config } from '../config.js';

// Create Redis client
let redisClient = null;

// Constants
const EPOCH_DURATION_MS = config.SECONDS_PER_SLOT * config.SLOTS_PER_EPOCH * 1000; // 6.4 minutes in ms
const VALIDATOR_ACTIVITY_KEY_PREFIX = 'validator:activity:';
const VALIDATOR_PUBKEYS_SET = 'active:validators:set';

/**
 * Initialize Redis client
 */
export async function initRedisClient() {
  if (redisClient) return redisClient;
  
  try {
    redisClient = createClient();
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error', err);
    });
    
    await redisClient.connect();
    console.log('Redis client connected successfully');
    return redisClient;
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    // Fallback to in-memory storage if Redis connection fails
    redisClient = createInMemoryStore();
    return redisClient;
  }
}

/**
 * Create a simple in-memory store as fallback
 */
function createInMemoryStore() {
  const store = new Map();
  const sets = new Map();
  
  return {
    set: async (key, value) => store.set(key, value),
    get: async (key) => store.get(key),
    sadd: async (key, ...members) => {
      if (!sets.has(key)) sets.set(key, new Set());
      const set = sets.get(key);
      members.forEach(member => set.add(member));
      return members.length;
    },
    smembers: async (key) => {
      if (!sets.has(key)) return [];
      return Array.from(sets.get(key));
    },
    isReady: true
  };
}

/**
 * Record validator activity when registerValidator is called
 * @param {string} pubkey - Validator public key
 * @returns {Promise<boolean>} - Success status
 */
export async function recordValidatorActivity(pubkey) {
  try {
    const client = redisClient || await initRedisClient();
    if (!client.isReady) throw new Error('Redis client not ready');
    
    const timestamp = Date.now();
    const key = `${VALIDATOR_ACTIVITY_KEY_PREFIX}${pubkey}`;
    
    await client.set(key, timestamp);
    await client.sAdd(VALIDATOR_PUBKEYS_SET, pubkey);
    
    return true;
  } catch (error) {
    console.error(`Error recording validator activity for ${pubkey}:`, error);
    return false;
  }
}

/**
 * Get all active validators (those that have called registerValidator within the last epoch)
 * @returns {Promise<Array<{pubkey: string, lastSeen: number}>>} - List of active validators
 */
export async function getActiveValidators() {
  try {
    const client = redisClient || await initRedisClient();
    if (!client.isReady) throw new Error('Redis client not ready');
    
    const pubkeys = await client.sMembers(VALIDATOR_PUBKEYS_SET);
    const result = [];
    const now = Date.now();
    
    for (const pubkey of pubkeys) {
      const key = `${VALIDATOR_ACTIVITY_KEY_PREFIX}${pubkey}`;
      const lastSeen = await client.get(key);
      
      if (lastSeen && (now - parseInt(lastSeen)) <= EPOCH_DURATION_MS) {
        result.push({
          pubkey,
          lastSeen: parseInt(lastSeen)
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error getting active validators:', error);
    return [];
  }
}

/**
 * Get all inactive validators (those that haven't called registerValidator within the last epoch)
 * @returns {Promise<Array<{pubkey: string, lastSeen: number}>>} - List of inactive validators
 */
export async function getInactiveValidators() {
  try {
    const client = redisClient || await initRedisClient();
    if (!client.isReady) throw new Error('Redis client not ready');
    
    const pubkeys = await client.sMembers(VALIDATOR_PUBKEYS_SET);
    const result = [];
    const now = Date.now();
    
    for (const pubkey of pubkeys) {
      const key = `${VALIDATOR_ACTIVITY_KEY_PREFIX}${pubkey}`;
      const lastSeen = await client.get(key);
      
      if (!lastSeen || (now - parseInt(lastSeen)) > EPOCH_DURATION_MS) {
        result.push({
          pubkey,
          lastSeen: lastSeen ? parseInt(lastSeen) : null
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error getting inactive validators:', error);
    return [];
  }
}

/**
 * Get validator activity status
 * @param {string} pubkey - Validator public key
 * @returns {Promise<{active: boolean, lastSeen: number|null}>} - Validator status
 */
export async function getValidatorStatus(pubkey) {
  try {
    const client = redisClient || await initRedisClient();
    if (!client.isReady) throw new Error('Redis client not ready');
    
    const key = `${VALIDATOR_ACTIVITY_KEY_PREFIX}${pubkey}`;
    const lastSeen = await client.get(key);
    
    if (!lastSeen) {
      return { active: false, lastSeen: null };
    }
    
    const now = Date.now();
    const active = (now - parseInt(lastSeen)) <= EPOCH_DURATION_MS;
    
    return {
      active,
      lastSeen: parseInt(lastSeen)
    };
  } catch (error) {
    console.error(`Error getting status for validator ${pubkey}:`, error);
    return { active: false, lastSeen: null };
  }
} 