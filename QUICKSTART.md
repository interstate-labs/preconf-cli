# Validator Monitoring Quick Start Guide

## Overview

This implementation tracks active MEV-boost instances by mimicking the Builder API endpoints that MEV-boost calls every epoch (approximately 6.4 minutes). This allows us to identify which validators are currently active without relying on the static validator.json file.

## Setup Instructions

### 1. Install Redis (Optional)

For production use, Redis is recommended for persistent storage:

```bash
# On macOS
brew install redis
brew services start redis

# On Ubuntu
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
```

If Redis is not available, the system will automatically fall back to in-memory storage.

### 2. Start the Validator Monitoring Server

```bash
# Start the server
npm run start-gateway
```

The server will be available at http://localhost:8000 (or the port you specify).

### 3. Configure MEV-boost to Use Your Server

Configure MEV-boost to use your server as a relay:

```bash
mev-boost -relay http://your-server-address:8000
```

When MEV-boost instances call the server's registerValidator endpoint (`/eth/v1/builder/validators`), they will be recorded as active.

## Usage

### Check Active Validators

```bash
# Get a list of all active validators
curl http://localhost:8000/api/validators/active

# Get a list of inactive validators
curl http://localhost:8000/api/validators/inactive

# Check the status of a specific validator
curl http://localhost:8000/api/validators/status/{pubkey}
```

### Integrate with Existing Tools

The system replaces the static validator.json approach with a dynamic tracking system. The CLI and API have been updated to check for active validators through this new monitoring system.

## Troubleshooting

- If the server fails to connect to Redis, it will automatically fall back to in-memory storage.
- Check the server logs for any errors or connection issues.
- Ensure your MEV-boost instances are correctly configured to use your server as a relay.

## For Helder Network

This implementation will work with the Helder network. Make sure to point your MEV-boost instances on Helder to this server, and they will be tracked as active when they call the registerValidator endpoint. 