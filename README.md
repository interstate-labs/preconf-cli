# Preconf-CLI Validator Monitoring

This project provides a mechanism to track active MEV-boost instances by monitoring calls to the Builder API's registerValidator endpoint. It replaces the static validator.json approach with a dynamic Redis-based tracking system.

## Overview

MEV-boost instances call the Builder API's registerValidator endpoint every epoch (approximately 6.4 minutes). This project sets up a server that mimics the Builder API endpoints and records which validators are actively calling these endpoints. This helps identify which validators are currently active.

## Features

- **API Server**: Mimics the Builder API endpoints to track validator activity
- **Redis Storage**: Stores validator activity data in Redis (with an in-memory fallback)
- **CLI Commands**: Convenient commands to manage the validator monitoring system
- **API Endpoints**: Exposes endpoints to query active and inactive validators

## Requirements

- Node.js v16+
- Redis (optional, will fall back to in-memory storage if Redis is not available)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd preconf-cli

# Install dependencies
npm install
```

## Usage

### Start the Validator Monitoring Server

```bash
# Using the CLI command
npm run preconf-cli start-validator-monitor

# Or directly
npm run start-gateway
```

### Available API Endpoints

- `POST /eth/v1/builder/validators` - Mimics the Builder API endpoint for registering validators
- `GET /api/validators/active` - Get a list of active validators
- `GET /api/validators/inactive` - Get a list of inactive validators
- `GET /api/validators/status/:pubkey` - Check the status of a specific validator

### Example: Query Active Validators

```bash
curl http://localhost:8000/api/validators/active
```

## Configuration

Configuration is done through environment variables and the config.js file:

- `PORT` - Port to run the server on (default: 8000)
- `SECONDS_PER_SLOT` and `SLOTS_PER_EPOCH` - Used to calculate the epoch duration

## How it Works

1. MEV-boost instances call the registerValidator endpoint every epoch (6.4 minutes)
2. Our server records these calls in Redis (or in-memory storage)
3. If a validator hasn't called within the last epoch, it's considered inactive
4. The system exposes APIs to query active/inactive validators

This approach replaces the static validator.json file with a dynamic tracking system. 