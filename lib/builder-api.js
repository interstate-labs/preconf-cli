import express from 'express';
import { recordValidatorActivity, getActiveValidators, getInactiveValidators, getValidatorStatus } from './active-validators.js';

// Create Express router for Builder API
const builderRouter = express.Router();

/**
 * Register validator endpoint - mimics the Builder API endpoint
 * POST /eth/v1/builder/validators
 */
builderRouter.post('/eth/v1/builder/validators', async (req, res) => {
  try {
    // Validate request body
    if (!Array.isArray(req.body)) {
      return res.status(400).json({
        code: 400,
        message: "Request body must be an array"
      });
    }

    const results = [];
    
    for (const validator of req.body) {
      // Validate the validator entry structure as per builder API spec
      if (!validator.message || !validator.message.pubkey || !validator.signature) {
        results.push({
          success: false,
          message: "Invalid validator entry - missing required fields"
        });
        continue;
      }

      const pubkey = validator.message.pubkey;
      const recordSuccess = await recordValidatorActivity(pubkey);
      
      results.push({
        success: recordSuccess,
        pubkey
      });
    }

    // Return 200 OK with empty response to match the Builder API spec
    // This ensures compatibility with MEV-boost which expects a 200 response
    return res.status(200).send();
  } catch (error) {
    console.error('Error in register validator endpoint:', error);
    return res.status(500).json({
      code: 500,
      message: "Internal server error"
    });
  }
});

/**
 * Get header endpoint - dummy implementation to satisfy MEV-boost requests
 * GET /eth/v1/builder/header/{slot}/{parent_hash}/{pubkey}
 */
builderRouter.get('/eth/v1/builder/header/:slot/:parent_hash/:pubkey', (req, res) => {
  // Just return a 404 to indicate we don't have a header
  // MEV-boost will continue to other builders
  res.status(404).json({
    code: 404,
    message: "No header found"
  });
});

/**
 * Submit blinded blocks endpoint - dummy implementation to satisfy MEV-boost requests
 * POST /eth/v1/builder/blinded_blocks
 */
builderRouter.post('/eth/v1/builder/blinded_blocks', (req, res) => {
  // Just return a 404 to indicate we can't process this
  // MEV-boost will continue to other builders
  res.status(404).json({
    code: 404,
    message: "Feature not supported"
  });
});

/**
 * Check if builder is healthy
 * GET /eth/v1/builder/status
 */
builderRouter.get('/eth/v1/builder/status', (_req, res) => {
  res.status(200).send();
});

// Custom endpoints for our gateway functionality

/**
 * Get all active validators
 * GET /api/validators/active
 */
builderRouter.get('/api/validators/active', async (_req, res) => {
  try {
    const activeValidators = await getActiveValidators();
    res.status(200).json(activeValidators);
  } catch (error) {
    console.error('Error getting active validators:', error);
    res.status(500).json({
      code: 500,
      message: "Internal server error"
    });
  }
});

/**
 * Get all inactive validators
 * GET /api/validators/inactive
 */
builderRouter.get('/api/validators/inactive', async (_req, res) => {
  try {
    const inactiveValidators = await getInactiveValidators();
    res.status(200).json(inactiveValidators);
  } catch (error) {
    console.error('Error getting inactive validators:', error);
    res.status(500).json({
      code: 500,
      message: "Internal server error"
    });
  }
});

/**
 * Get status of a specific validator
 * GET /api/validators/status/:pubkey
 */
builderRouter.get('/api/validators/status/:pubkey', async (req, res) => {
  try {
    const { pubkey } = req.params;
    const status = await getValidatorStatus(pubkey);
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting validator status:', error);
    res.status(500).json({
      code: 500,
      message: "Internal server error"
    });
  }
});

export default builderRouter; 