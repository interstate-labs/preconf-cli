#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import builderRouter from './lib/builder-api.js';
import { initRedisClient } from './lib/active-validators.js';
import { config } from './config.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Redis client
(async () => {
  try {
    await initRedisClient();
    console.log('Redis client initialized');
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    console.log('Falling back to in-memory storage');
  }
})();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Mount Builder API router
// This mimics the builder API to track active validators
app.use('/', builderRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Gateway server listening on port ${PORT}`);
  console.log(`Builder API endpoint available at http://localhost:${PORT}/eth/v1/builder/validators`);
  console.log(`Active validators API available at http://localhost:${PORT}/api/validators/active`);
  console.log(`Epoch duration: ${config.SECONDS_PER_SLOT * config.SLOTS_PER_EPOCH} seconds`);
}); 