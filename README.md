# Arbitrum Orbit x Celestia Scripts

TypeScript scripts to deploy an Arbitrum Orbit rollup using an existing RollupCreator contract.

## 📋 Prerequisites

- Node.js 18+
- At least 0.5 Sepolia ETH for deployment (or other funds depending on parent chain)
- Parent chain RPC Url

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:

- `@arbitrum/orbit-sdk` - Orbit deployment SDK
- `@arbitrum/sdk` - Arbitrum SDK
- `ethers@5` - Ethereum library
- `dotenv` - Environment variables
- `typescript` - TypeScript compiler
- `tsx` - TypeScript executor

### 2. Configure Environment

Edit `.env` with your values:

```bash
# Deployment Wallet
PRIVATE_KEY=your_private_key_here

# Data Availability Provider (Celestia)
DA_PROVIDER_URL=

# Optional: Advanced DA Provider settings
DA_PROVIDER_RETRIES=3
DA_PROVIDER_RETRY_ERRORS=websocket: close.*|dial tcp .*|.*i/o timeout|.*connection reset by peer|.*connection refused
DA_PROVIDER_ARG_LOG_LIMIT=2048
DA_PROVIDER_WS_MESSAGE_SIZE_LIMIT=268435456

# If you want separate keys for batch poster and validator
# If not set, will use PRIVATE_KEY for both
BATCH_POSTER_PRIVATE_KEY=optional_separate_key
VALIDATOR_PRIVATE_KEY=optional_separate_key

# RPC URLs
PARENT_CHAIN_RPC=https://rpc.sepolia.org
PARENT_CHAIN_ID=
# Optional: Use Alchemy or Infura for better reliability
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY

# Etherscan API (for verifying contracts)
ETHERSCAN_API_KEY=your_etherscan_api_key

# Your Orbit Chain Configuration (change this to be unique)
CHAIN_ID=412346
CHAIN_NAME=My Orbit Chain

# Validators (comma-separated addresses if using multiple validators)
VALIDATOR_ADDRESSES=0xYourValidatorAddress1,0xYourValidatorAddress2

# Batch Poster (address that will post transaction batches if set)
BATCH_POSTER_ADDRESS=0xYourBatchPosterAddress

# Optional: Use custom ERC-20 token as gas token (leave empty for ETH)
NATIVE_TOKEN_ADDRESS=

# Wasm root used for validation (find latest one here https://github.com/celestiaorg/nitro/releases?q=consensus&expanded=true)
WASM_ROOT=0xf4daee8f6e64e300e0aa25ee193f39281c5023bcdfa6fb6298f4154091d61df1

# Optional: Custom RollupCreator address (using default one in sepolia)
ROLLUP_CREATOR_ADDRESS=0x91120076656d3f19E14c70453bBD353b098631C4

DATA_AVAILABILITY_COMMITTEE=true
MAX_DATA_SIZE=117964
MAX_FEE_PER_GAS=100000000

```

### 3. Check Balance

```bash
npm run check-balance
```

Make sure you have at least 0.5 Sepolia ETH.

### 4. Deploy Your Rollup

```bash
npm run deploy
```

This will:

- ✅ Create a new Orbit rollup on Sepolia
- ✅ Use your custom RollupCreator (if specified) or default Arbitrum contracts
- ✅ Deploy all necessary contracts
- ✅ Configure validators and batch poster
- ✅ Save deployment info to `deployments/`

### 6. Parse Deployment

```bash
npm run parse-deployment
```

This extracts all contract addresses from the deployment transaction and updates the deployment file.


## 🔧 Configuration Options

### `.env` Variables

| Variable | Required | Description | Default | Example |
|----------|----------|-------------|---------|---------|
| **Deployment** |
| `PRIVATE_KEY` | ✅ Yes | Deployer wallet private key (without 0x prefix) | - | `abc123...` |
| `PARENT_CHAIN_RPC` | ✅ Yes | Sepolia RPC endpoint | - | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `PARENT_CHAIN_BEACON_RPC` | ✅ Yes | Sepolia Beacon API endpoint | `https://ethereum-sepolia-beacon-api.publicnode.com` | - |
| `PARENT_CHAIN_ID` | No | Parent chain ID (Sepolia) | `11155111` | - |
| `WASM_ROOT` | ✅ Yes | WASM module root hash | - | `0x8b104a2e80ac6165dc58b9048de12f301d70b02a0ab51396c22b4b4b802a16a4` |
| `ROLLUP_CREATOR_ADDRESS` | ✅ Yes | RollupCreator 3.1 contract address | - | `0x91120076656d3f19E14c70453bBD353b098631C4` |
| **Chain Configuration** |
| `CHAIN_ID` | No | Your L2 chain ID (must be unique) | `412346` | `987654321` |
| `CHAIN_NAME` | No | Your L2 chain name | `My Orbit Chain` | `My Custom Rollup` |
| `DATA_AVAILABILITY_COMMITTEE` | No | Enable Data Availability Committee | `false` | `true` |
| `NATIVE_TOKEN_ADDRESS` | No | Custom ERC-20 gas token address | ETH (`0x0000...`) | `0x1234...` |
| `DA_PROTOCOL_ADDRESS` | No | Data availability protocol address | `0x0000...` | `0x5678...` |
| **Roles** |
| `VALIDATOR_ADDRESSES` | No | Comma-separated validator addresses | Deployer address | `0xAddr1,0xAddr2` |
| `BATCH_POSTER_ADDRESS` | No | Address that posts transaction batches | Deployer address | `0x1234...` |
| `BATCH_POSTER_PRIVATE_KEY` | No | Separate key for batch poster | Uses `PRIVATE_KEY` | `def456...` |
| `VALIDATOR_PRIVATE_KEY` | No | Separate key for validator | Uses `PRIVATE_KEY` | `ghi789...` |
| **Advanced Settings** |
| `MAX_DATA_SIZE` | No | Maximum data size for batches | `117964` | `200000` |
| `MAX_FEE_PER_GAS` | No | Max fee per gas for retryables (wei) | `100000000` | `200000000` |
| `DEPLOYMENT_VALUE` | No | ETH value to send with deployment | `0.5` | `1.0` |
| **Data Availability Provider (Celestia)** |
| `DA_PROVIDER_ENABLE` | No | Enable DA provider integration | `false` | `true` |
| `DA_PROVIDER_URL` | No | DA provider RPC URL | `http://celestia-server:26657` | `http://localhost:26657` |
| `DA_PROVIDER_RETRIES` | No | Number of retry attempts | `3` | `5` |
| `DA_PROVIDER_RETRY_ERRORS` | No | Regex pattern for retryable errors | `websocket: close.*\|dial tcp .*\|...` | - |
| `DA_PROVIDER_ARG_LOG_LIMIT` | No | Argument log limit | `2048` | `4096` |
| `DA_PROVIDER_WS_MESSAGE_SIZE_LIMIT` | No | WebSocket message size limit (bytes) | `268435456` (256MB) | `536870912` |
| **Verification** |
| `ETHERSCAN_API_KEY` | No | Etherscan API key for contract verification | - | `ABC123...` |

### Example `.env` File
```bash
# Deployment Wallet
PRIVATE_KEY=your_private_key_here

# Parent Chain (Sepolia)
PARENT_CHAIN_RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PARENT_CHAIN_BEACON_RPC=https://ethereum-sepolia-beacon-api.publicnode.com
PARENT_CHAIN_ID=11155111

# WASM Module Root (Arbitrum Nitro)
WASM_ROOT=0x8b104a2e80ac6165dc58b9048de12f301d70b02a0ab51396c22b4b4b802a16a4

# RollupCreator 3.1 Contract
ROLLUP_CREATOR_ADDRESS=0x91120076656d3f19E14c70453bBD353b098631C4

# Your Orbit Chain Configuration
CHAIN_ID=987654321
CHAIN_NAME=My Custom Orbit Chain
DATA_AVAILABILITY_COMMITTEE=true

# Roles (optional - defaults to deployer address)
VALIDATOR_ADDRESSES=0xYourValidatorAddress1,0xYourValidatorAddress2
BATCH_POSTER_ADDRESS=0xYourBatchPosterAddress

# Data Availability Provider (Celestia)
DA_PROVIDER_ENABLE=true
DA_PROVIDER_URL=http://celestia-server:26657

# Optional: Separate keys for batch poster and validator
# BATCH_POSTER_PRIVATE_KEY=optional_separate_key
# VALIDATOR_PRIVATE_KEY=optional_separate_key

# Optional: Contract Verification
# ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Important Notes

- **Security**: Never commit your `.env` file to version control. It contains sensitive private keys.
- **PRIVATE_KEY**: Can be provided with or without the `0x` prefix
- **WASM_ROOT**: Use the official Arbitrum Nitro WASM module root for your version
- **Chain ID**: Must be unique and not conflict with existing chains
- **Deployment Cost**: Ensure you have at least 0.5 Sepolia ETH for deployment

## 📊 After Deployment

After successful deployment and parsing, you'll have:

1. **Deployment file** in `deployments/deployment-{chainId}-{timestamp}.json`
2. **Node config** in `config/chain-{chainId}.json` ready for node operators

The config file contains:

- All deployed contract addresses (Rollup, Inbox, Outbox, Bridge, etc.)
- Chain configuration (chain ID, parent chain)
- Validator addresses
- Batch poster address

### Example Deployment Output

```json
{
  "chainId": 412346,
  "chainName": "My Orbit Chain",
  "parentChain": "sepolia",
  "contracts": {
    "rollup": "0x1234...",
    "inbox": "0x5678...",
    "outbox": "0x9abc...",
    "bridge": "0xdef0...",
    "sequencerInbox": "0x1111...",
    "adminProxy": "0x2222..."
  }
}
```

### Next Steps

1. ✅ **Contracts deployed** - Check `config/chain-{chainId}.json`
2. **Set up sequencer node** using the config file
3. **Set up validator nodes** for your validators
4. **Configure RPC endpoint** for your L2
5. **Deploy dApp contracts** to the L2

## 🛠️ Available Scripts

| Command | Description |
|---------|-------------|
| `npm run deploy` | Deploy new Orbit rollup to Sepolia (uses custom or default RollupCreator) |
| `npm run check-balance` | Check deployer wallet balance |
| `npm run parse-deployment` | Parse deployment events and extract contract addresses |


## 🔗 Useful Links

- [Arbitrum Orbit Docs](https://docs.arbitrum.io/launch-orbit-chain)
- [Orbit SDK GitHub](https://github.com/OffchainLabs/arbitrum-orbit-sdk)
- [Node Setup Guide](https://docs.arbitrum.io/run-arbitrum-node/run-orbit-node)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)

## ⚠️ Important Notes

- Deployment costs approximately **0.3-0.5 Sepolia ETH** in gas
- Always run `npm run parse-deployment` after successful deployment to extract addresses
- **Save your deployment files** - you'll need them for node setup
- Use the deployer address as both validator and batch poster for testing

## 🐛 Troubleshooting

### Execution reverted

If you attempt to deploy a rollup with a chain id and named that has been used before, the create rollup transaction will fail, trying a different combination (of chain id and name) will fix it.

### Insufficient Balance

```bash
npm run check-balance
```

If balance is low, get Sepolia ETH from a faucet:

- <https://sepoliafaucet.com/>
- <https://www.alchemy.com/faucets/ethereum-sepolia>

### RPC Connection Issues

Try alternative Sepolia RPC endpoints in `.env`:

```bash
# Public endpoints
SEPOLIA_RPC_URL=https://ethereum-sepolia.publicnode.com
SEPOLIA_RPC_URL=https://rpc2.sepolia.org

# Or use Alchemy/Infura
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
```

### Can't Parse Deployment

Ensure deployment completed successfully first:

```bash
# Check if deployment succeeded
npm run verify-deployment

# Then parse
npm run parse-deployment
```

### Peer Dependency Warnings

If you see peer dependency warnings during `npm install`, use:

```bash
npm install --legacy-peer-deps
```

This is normal - the Arbitrum SDK uses ethers v5 while some tools expect v6.

**Need help?** Check the [Arbitrum Discord](https://discord.gg/arbitrum) or [documentation](https://docs.arbitrum.io/).
