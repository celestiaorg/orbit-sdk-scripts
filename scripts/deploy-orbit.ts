import {
  createRollup,
  createRollupPrepareDeploymentParamsConfig,
  createRollupPrepareTransactionReceipt,
  createRollupPrepareTransactionRequest,
  prepareChainConfig,
  prepareNodeConfig,
} from '@arbitrum/orbit-sdk';
import { config } from 'dotenv';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { writeFileSync } from 'fs';
import type { DeploymentInfo } from '../src/types/index.js';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
  decodeEventLog,
} from 'viem';
import { sanitizePrivateKey } from '@arbitrum/orbit-sdk/utils';

config();

const SEPOLIA_CHAIN_ID = 11155111;

// RollupCreated event ABI
const ROLLUP_CREATED_EVENT_ABI = [
  {
    type: 'event',
    name: 'RollupCreated',
    inputs: [
      { name: 'rollupAddress', type: 'address', indexed: true },
      { name: 'nativeToken', type: 'address', indexed: true },
      { name: 'inboxAddress', type: 'address', indexed: false },
      { name: 'outbox', type: 'address', indexed: false },
      { name: 'rollupEventInbox', type: 'address', indexed: false },
      { name: 'challengeManager', type: 'address', indexed: false },
      { name: 'adminProxy', type: 'address', indexed: false },
      { name: 'sequencerInbox', type: 'address', indexed: false },
      { name: 'bridge', type: 'address', indexed: false },
      { name: 'upgradeExecutor', type: 'address', indexed: false },
      { name: 'validatorWalletCreator', type: 'address', indexed: false },
    ],
  },
] as const;

async function main(): Promise<DeploymentInfo> {
  console.log('🚀 Deploying Arbitrum Orbit Rollup on Sepolia\n');
  console.log('═══════════════════════════════════════════════\n');

  // Validate environment variables
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not set in .env');
  }
  if (!process.env.VALIDATOR_PRIVATE_KEY) {
    throw new Error('VALIDATOR_PRIVATE_KEY not set in .env');
  }
  if (process.env.VALIDATOR_PRIVATE_KEY == process.env.PRIVATE_KEY) {
    throw new Error('VALIDATOR_PRIVATE_KEY cannot be the same as PRIVATE_KEY or Batchposter Key!');
  }
  if (!process.env.PARENT_CHAIN_RPC) {
    throw new Error('PARENT_CHAIN_RPC not set in .env');
  }
  if (!process.env.WASM_ROOT) {
    throw new Error('WASM_ROOT not set in .env');
  }

  // Setup account
  const deployer = privateKeyToAccount(sanitizePrivateKey(process.env.PRIVATE_KEY));

  // Setup parent chain clients
  const parentChain = sepolia;
  const parentChainPublicClient = createPublicClient({
    chain: parentChain,
    transport: http(process.env.PARENT_CHAIN_RPC),
  });

  const parentChainWalletClient = createWalletClient({
    account: deployer,
    chain: parentChain,
    transport: http(process.env.PARENT_CHAIN_RPC),
  });

  console.log('📋 Deployment Configuration:');
  console.log(`  Deployer: ${deployer.address}`);

  // Get balance
  const balance = await parentChainPublicClient.getBalance({
    address: deployer.address,
  });
  console.log(`  Balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.5')) {
    console.error('\n❌ Insufficient balance!');
    console.error('You need at least 0.5 Sepolia ETH for deployment.');
    console.error('Get test ETH from: https://sepoliafaucet.com/');
    process.exit(1);
  }

  // Parse configuration
  const chainId = parseInt(process.env.CHAIN_ID || '412346', 10);
  const chainName = process.env.CHAIN_NAME || 'My Orbit Chain';
  const parentChainId = parseInt(
    process.env.PARENT_CHAIN_ID || String(SEPOLIA_CHAIN_ID),
    10
  );

  // Ensure validators is always a non-empty array
  const validators = process.env.VALIDATOR_ADDRESSES
    ? process.env.VALIDATOR_ADDRESSES.split(',').map(addr => addr.trim() as Address)
    : [deployer.address];

  // Ensure validators array is valid
  if (!validators || validators.length === 0) {
    throw new Error('At least one validator address is required');
  }

  const batchPoster = (process.env.BATCH_POSTER_ADDRESS || deployer.address) as Address;
  const nativeToken = (process.env.NATIVE_TOKEN_ADDRESS ||
    '0x0000000000000000000000000000000000000000') as Address;

  console.log(`  Chain ID: ${chainId}`);
  console.log(`  Chain Name: ${chainName}`);
  console.log(`  Parent Chain ID: ${parentChainId}`);
  console.log(`  Validators: ${validators.join(', ')}`);
  console.log(`  Batch Poster: ${batchPoster}`);
  console.log(`  Native Token: ${nativeToken === '0x0000000000000000000000000000000000000000' ? 'ETH' : nativeToken}`);
  console.log();

  // Create rollup configuration
  console.log('⚙️  Preparing rollup configuration...');

  // Ensure WASM_ROOT is properly formatted
  const wasmModuleRoot = process.env.WASM_ROOT.startsWith('0x')
    ? process.env.WASM_ROOT
    : `0x${process.env.WASM_ROOT}`;

  const rollupConfig = await createRollupPrepareDeploymentParamsConfig(
    parentChainPublicClient,
    {
      chainId: BigInt(chainId),
      owner: deployer.address,
      wasmModuleRoot: wasmModuleRoot as `0x${string}`,
      chainConfig: prepareChainConfig({
        chainId,
        arbitrum: {
          InitialChainOwner: deployer.address,
          DataAvailabilityCommittee: true
        },
      }),
    }
  );

  console.log('✅ Configuration prepared\n');

  // Prepare deployment transaction
  console.log('📝 Preparing deployment transaction...');

  // Add rollupCreatorAddressOverride if provided
  if (process.env.ROLLUP_CREATOR_ADDRESS) {
    console.log(`  Using custom RollupCreator: ${process.env.ROLLUP_CREATOR_ADDRESS}`);
  } else {
    console.log('  ROLLUP_CREATOR_ADDRESS not set');
  }

  const txRequest = await createRollupPrepareTransactionRequest({
    params: {
      config: rollupConfig,
      batchPosters: [batchPoster],
      validators: validators,
      nativeToken: nativeToken,
      deployFactoriesToL2: true,
      maxDataSize: BigInt(process.env.MAX_DATA_SIZE || '117964'),
      maxFeePerGasForRetryables: BigInt(process.env.MAX_FEE_PER_GAS || '100000000'),
    },
    account: deployer.address,
    publicClient: parentChainPublicClient,
    rollupCreatorAddressOverride: process.env.ROLLUP_CREATOR_ADDRESS as Address
  });

  console.log('✅ Transaction prepared');
  console.log(`  To: ${txRequest.to}`);
  console.log(`  Value: ${formatEther(txRequest.value || BigInt(0))} ETH`);
  console.log();

  // Execute deployment
  console.log('🔄 Sending deployment transaction...');
  console.log('⚠️  This will take several minutes and cost gas\n');

  const txHash = await parentChainWalletClient.sendTransaction({
    to: txRequest.to!,
    data: txRequest.data,
    value: txRequest.value,
    chain: parentChain,
    account: deployer,
  });

  console.log(`✅ Transaction sent!`);
  console.log(`  Hash: ${txHash}`);
  console.log(`  Explorer: https://sepolia.etherscan.io/tx/${txHash}`);
  console.log();
  console.log('⏳ Waiting for confirmation (this may take 5-10 minutes)...\n');

  // Wait for transaction receipt
  const receipt = await parentChainPublicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  console.log('🎉 Deployment successful!\n');
  console.log('═══════════════════════════════════════════════');
  console.log('Transaction Details:');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Block: ${receipt.blockNumber}`);
  console.log(`  Gas Used: ${receipt.gasUsed.toString()}`);
  console.log(`  Status: ${receipt.status === 'success' ? '✅ Success' : '❌ Failed'}`);
  console.log();

  // Parse events to get deployed addresses
  console.log('📊 Parsing deployment events...');

  let coreContracts: any = null;

  for (const log of receipt.logs) {
    if (!log?.topics || !log?.data) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: ROLLUP_CREATED_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === 'RollupCreated') {
        const args = decoded.args as any;

        const deployedAtBlock = receipt.blockNumber;

        const txReceipt = createRollupPrepareTransactionReceipt(await parentChainPublicClient.getTransactionReceipt({ hash: txHash }))


        coreContracts = txReceipt.getCoreContracts();

        console.log('✅ Found RollupCreated event\n');
        console.log('Core Contracts:');
        console.log(`  Rollup: ${coreContracts.rollup}`);
        console.log(`  Inbox: ${coreContracts.inbox}`);
        console.log(`  Outbox: ${coreContracts.outbox}`);
        console.log(`  SequencerInbox: ${coreContracts.sequencerInbox}`);
        console.log(`  Bridge: ${coreContracts.bridge}`);
        console.log();
        break;
      }
    } catch (e) {
      continue;
    }
  }

  if (!coreContracts) {
    console.error('⚠️  Could not parse RollupCreated event');
    console.log('   Run npm run parse-deployment to extract addresses manually\n');
  }

  // Create deployment info object (ONLY ONCE!)
  const deploymentInfo: DeploymentInfo = {
    chainId,
    chainName,
    parentChain: 'sepolia',
    parentChainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    transactionHash: txHash,
    blockNumber: Number(receipt.blockNumber),
    validators,
    batchPoster,
    nativeToken,
    contracts: coreContracts || {},
  };

  console.log('═══════════════════════════════════════════════');
  console.log('Deployment Summary:');
  console.log('═══════════════════════════════════════════════');
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log();

  // Save deployment info
  const filename = `deployments/deployment-${chainId}-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${filename}\n`);

  // Generate node config if contracts were parsed successfully
  if (coreContracts) {
    console.log('⚙️  Generating node configuration...\n');

    try {
      // Parse the chain config from rollupConfig
      const chainConfig = JSON.parse(rollupConfig.chainConfig);

      // Prepare node config
      // Note: prepareNodeConfig has strict type checking for parentChainId
      // Use parentChain.id (11155111 for Sepolia) for type safety, then override
      const nodeConfig = prepareNodeConfig({
        chainName: chainName,
        chainConfig: chainConfig,
        coreContracts: coreContracts,
        batchPosterPrivateKey: process.env.BATCH_POSTER_PRIVATE_KEY || process.env.PRIVATE_KEY!,
        validatorPrivateKey: process.env.VALIDATOR_PRIVATE_KEY || process.env.PRIVATE_KEY!,
        stakeToken: rollupConfig.stakeToken,
        parentChainId: parentChain.id, // Use the chain's ID for type safety
        parentChainRpcUrl: process.env.PARENT_CHAIN_RPC!,
        parentChainBeaconRpcUrl: process.env.PARENT_CHAIN_RPC!,
      });

      // Override with user's custom parent chain ID if different
      if (parentChainId !== parentChain.id) {
        console.log(`📝 Overriding parent chain ID: ${parentChain.id} → ${parentChainId}\n`);
        (nodeConfig as any)['parent-chain'] = {
          ...(nodeConfig as any)['parent-chain'],
          connection: {
            ...(nodeConfig as any)['parent-chain']?.connection,
            url: process.env.PARENT_CHAIN_RPC!,
          },
          id: parentChainId,
        };
      }

      // Add DA provider config if enabled
      const daProviderUrl = process.env.DA_PROVIDER_URL || 'http://celestia-server:26657';

      console.log(`📡 Adding DA Provider configuration...`);
      console.log(`   URL: ${daProviderUrl}\n`);

      // Add da-provider to the node config (cast to any to add custom property)
      const nodeConfigWithDA = nodeConfig as any;

      if (!nodeConfigWithDA.node) {
        nodeConfigWithDA.node = {};
      }

      nodeConfigWithDA.node['da-provider'] = {
        enable: true,
        'with-writer': true,
        rpc: {
          url: daProviderUrl,
          retries: parseInt(process.env.DA_PROVIDER_RETRIES || '3', 10),
          'retry-errors': process.env.DA_PROVIDER_RETRY_ERRORS ||
            'websocket: close.*|dial tcp .*|.*i/o timeout|.*connection reset by peer|.*connection refused',
          'arg-log-limit': parseInt(process.env.DA_PROVIDER_ARG_LOG_LIMIT || '2048', 10),
          'websocket-message-size-limit': parseInt(
            process.env.DA_PROVIDER_WS_MESSAGE_SIZE_LIMIT || String(256 * 1024 * 1024),
            10
          ),
        },
      };

      // set data availability to false to avoid issues with nitro binary
      nodeConfigWithDA.node['data-availability'].enable = false

      // disable blob reader
      nodeConfigWithDA.node['dangerous']['disable-blob-reader'] = true


      // Save node config
      const nodeConfigFile = `config/node-config-${chainId}.json`;
      writeFileSync(nodeConfigFile, JSON.stringify(nodeConfig, null, 2));
      console.log(`✅ Node configuration saved to: ${nodeConfigFile}\n`);

      console.log('Node Configuration Summary:');
      console.log('═══════════════════════════════════════════════');
      console.log(`  Chain Name: ${chainName}`);
      console.log(`  Chain ID: ${chainId}`);
      console.log(`  Parent Chain: Sepolia (${parentChainId})`);
      console.log(`  Rollup Address: ${coreContracts.rollup}`);
      if (process.env.DA_PROVIDER_ENABLE === 'true') {
        console.log(`  DA Provider: ${process.env.DA_PROVIDER_URL || 'http://celestia-server:26657'}`);
      }
      console.log('═══════════════════════════════════════════════\n');

      console.log('💡 To run your node:');
      console.log(`   Use the config file: ${nodeConfigFile}`);
      console.log('   With Nitro node software\n');

    } catch (error: any) {
      console.error('⚠️  Failed to generate node config:', error.message);
      console.log('   You can manually create the config using the deployment info\n');
    }
  }

  console.log('📚 Next Steps:');
  console.log('═══════════════════════════════════════════════');
  console.log('1. Review the node config: config/node-config-' + chainId + '.json');
  console.log('2. Set up your sequencer node with the config');
  console.log('3. Set up validator nodes');
  console.log('4. Configure your chain RPC endpoint');
  console.log('5. Deploy your application contracts to the L2');
  console.log('6. (Optional) Run: npm run verify-contracts');
  console.log('═══════════════════════════════════════════════\n');

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });