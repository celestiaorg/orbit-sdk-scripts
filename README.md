# Arbitrum Orbit Rollup Deployment (TypeScript)

TypeScript scripts to deploy an Arbitrum Orbit rollup using existing contracts on Sepolia testnet.

## 📋 Prerequisites

- Node.js 18+
- At least 0.5 Sepolia ETH for deployment
- Sepolia RPC URL (public or from Alchemy/Infura)

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
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://rpc.sepolia.org
CHAIN_ID=412346
CHAIN_NAME=My Orbit Chain
VALIDATOR_ADDRESSES=0xValidator1,0xValidator2
BATCH_POSTER_ADDRESS=0xBatchPoster

# Optional: Use your custom RollupCreator
ROLLUP_CREATOR_ADDRESS=0xYourCustomRollupCreator
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

### 7. Verify Deployment

```bash
npm run verify-deployment
```

### 8. Verify Contracts on Etherscan

```bash
npm run verify-contracts
```

This will verify all deployed proxy contracts on Etherscan, making them readable and transparent.

## 📁 Project Structure

```
.
├── scripts/
│   ├── deploy-orbit.ts          # Main deployment script
│   ├── check-balance.ts         # Balance checker
│   ├── verify-deployment.ts     # Verify deployment
│   └── parse-deployment.ts      # Parse contract addresses
├── src/
│   └── types/
│       └── index.ts             # TypeScript type definitions
├── config/
│   └── chain-config-template.json
├── deployments/                 # Deployment records (auto-generated)
├── .env                         # Your configuration
├── tsconfig.json                # TypeScript configuration
└── README.md
```

## 🔧 Configuration Options

### `.env` Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PRIVATE_KEY` | ✅ Yes | Deployer wallet private key | - |
| `SEPOLIA_RPC_URL` | ✅ Yes | Sepolia RPC endpoint | - |
| `CHAIN_ID` | No | Your L2 chain ID | 412346 |
| `CHAIN_NAME` | No | Your L2 chain name | "My Orbit Chain" |
| `VALIDATOR_ADDRESSES` | No | Comma-separated validator addresses | Deployer address |
| `BATCH_POSTER_ADDRESS` | No | Batch poster address | Deployer address |
| `NATIVE_TOKEN_ADDRESS` | No | Custom gas token address | ETH (zero address) |
| `ROLLUP_CREATOR_ADDRESS` | No | Custom RollupCreator address | Default Sepolia deployment |

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
| `npm run verify-deployment` | Verify latest deployment transaction |
| `npm run check-rollup-creator` | Verify custom RollupCreator configuration |
| `npm run deploy-custom-creator` | Helper/guide for deploying custom RollupCreator |
| `npm run build` | Compile TypeScript to JavaScript |

## 🎯 Using a Custom RollupCreator

If you have deployed custom Arbitrum contracts (e.g., for custom data availability like Celestia), you can use your own RollupCreator:

### Step 1: Deploy Your Custom Contracts

First, deploy your custom template contracts and RollupCreator to Sepolia. See `npm run deploy-custom-creator` for guidance.

Example custom contracts you might deploy:

- `CustomRollupAdminLogic` - Modified rollup logic
- `CustomSequencerInbox` - Custom batch posting (e.g., for Celestia DA)
- `CustomBridge` - Custom bridging logic
- Other template contracts as needed

### Step 2: Deploy RollupCreator

Deploy a RollupCreator contract that references your custom templates:

```solidity
// Example: Deploy your RollupCreator
RollupCreator rollupCreator = new RollupCreator(
    customRollupTemplate,
    customSequencerInboxTemplate,
    customBridgeTemplate,
    // ... other template addresses
);
```

### Step 3: Configure and Deploy

Add your RollupCreator address to `.env`:

```bash
ROLLUP_CREATOR_ADDRESS=0xYourCustomRollupCreator
```

Verify it's configured correctly:

```bash
npm run check-rollup-creator
```

Deploy your Orbit rollup using your custom contracts:

```bash
npm run deploy
```

### Default vs Custom RollupCreator

| Configuration | Behavior |
|---------------|----------|
| `ROLLUP_CREATOR_ADDRESS` not set | Uses default Arbitrum Nitro contracts on Sepolia |
| `ROLLUP_CREATOR_ADDRESS=0x...` | Uses your custom RollupCreator and template contracts |

**When to use custom:**

- Implementing alternative data availability (Celestia, EigenDA, etc.)
- Custom validation logic or challenge mechanisms
- Modified bridging or sequencing behavior
- Specialized gas pricing or fee models

## 🔗 Useful Links

- [Arbitrum Orbit Docs](https://docs.arbitrum.io/launch-orbit-chain)
- [Orbit SDK GitHub](https://github.com/OffchainLabs/arbitrum-orbit-sdk)
- [Node Setup Guide](https://docs.arbitrum.io/run-arbitrum-node/run-orbit-node)
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Sepolia Etherscan](https://sepolia.etherscan.io/)

## 💻 Development

### Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### Run Scripts Directly

```bash
# Using tsx (no build needed) - recommended
npm run deploy

# Or compile first and run
npm run build
node dist/scripts/deploy-orbit.js
```

### TypeScript Types

The project includes full TypeScript type definitions in `src/types/index.ts`:

- `DeploymentInfo` - Deployment record structure
- `ChainConfig` - Chain configuration parameters

## ⚠️ Important Notes

- This uses **existing Orbit contracts** deployed on Sepolia (no custom contracts needed)
- Deployment costs approximately **0.3-0.5 Sepolia ETH** in gas
- Transaction confirmation takes **5-10 minutes**
- Always run `npm run parse-deployment` after successful deployment to extract addresses
- **Save your deployment files** - you'll need them for node setup
- **Never commit `.env`** to git (it's in .gitignore)
- Use the deployer address as both validator and batch poster for testing

## 🐛 Troubleshooting

### Insufficient Balance

```bash
npm run check-balance
```

If balance is low, get Sepolia ETH from a faucet:

- <https://sepoliafaucet.com/>
- <https://www.alchemy.com/faucets/ethereum-sepolia>

### TypeScript Compilation Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

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

### Transaction Stuck/Pending

Wait 5-10 minutes for confirmation. Check status:

```bash
npm run verify-deployment
```

View on Etherscan:

```
https://sepolia.etherscan.io/tx/{your-tx-hash}
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

## 🔐 Security Best Practices

1. **Never share your private key** or commit `.env` to version control
2. **Use a dedicated wallet** for testnet deployments
3. **Verify all addresses** before deploying to mainnet
4. **Start with small amounts** on testnet first
5. **Keep deployment records** in a secure location
6. **Use hardware wallets** for mainnet deployments

## 📈 Gas Costs (Sepolia Estimates)

| Operation | Estimated Cost |
|-----------|----------------|
| Rollup Deployment | 0.3 - 0.5 ETH |
| Contract Verification | Free |
| Node Operation | Varies by usage |

*Note: Actual costs depend on gas prices at deployment time*

## 📄 License

MIT

---

**Need help?** Check the [Arbitrum Discord](https://discord.gg/arbitrum) or [documentation](https://docs.arbitrum.io/).
