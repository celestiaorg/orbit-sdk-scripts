import { createPublicClient, http, decodeEventLog } from 'viem';
import { sepolia } from 'viem/chains';
import { config } from 'dotenv';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import type { DeploymentInfo } from '../src/types/index.js';

config();

// New RollupCreated event ABI
const ROLLUP_CREATED_EVENT_ABI = [
  {
    type: 'event',
    name: 'RollupCreated',
    inputs: [
      {
        name: 'rollupAddress',
        type: 'address',
        indexed: true,
      },
      {
        name: 'nativeToken',
        type: 'address',
        indexed: true,
      },
      {
        name: 'inboxAddress',
        type: 'address',
        indexed: false,
      },
      {
        name: 'outbox',
        type: 'address',
        indexed: false,
      },
      {
        name: 'rollupEventInbox',
        type: 'address',
        indexed: false,
      },
      {
        name: 'challengeManager',
        type: 'address',
        indexed: false,
      },
      {
        name: 'adminProxy',
        type: 'address',
        indexed: false,
      },
      {
        name: 'sequencerInbox',
        type: 'address',
        indexed: false,
      },
      {
        name: 'bridge',
        type: 'address',
        indexed: false,
      },
      {
        name: 'upgradeExecutor',
        type: 'address',
        indexed: false,
      },
      {
        name: 'validatorWalletCreator',
        type: 'address',
        indexed: false,
      },
    ],
  },
] as const;

async function main(): Promise<void> {
  console.log('📊 Parsing Deployment Events (New Format)\n');
  console.log('═══════════════════════════════════════════════\n');

  if (!process.env.PARENT_CHAIN_RPC) {
    throw new Error('PARENT_CHAIN_RPC not set in .env');
  }

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.PARENT_CHAIN_RPC),
  });

  // Find most recent deployment file
  const deploymentFiles = readdirSync('deployments')
    .filter(f => f.startsWith('deployment-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (deploymentFiles.length === 0) {
    console.error('❌ No deployment files found');
    console.log('Run npm run deploy first');
    process.exit(1);
  }

  const latestFile = `deployments/${deploymentFiles[0]}`;
  console.log(`Reading: ${latestFile}\n`);

  const deployment: DeploymentInfo = JSON.parse(readFileSync(latestFile, 'utf8'));

  console.log('Deployment Info:');
  console.log(`  Chain ID: ${deployment.chainId}`);
  console.log(`  Transaction: ${deployment.transactionHash}`);
  console.log();

  // Get transaction receipt
  console.log('Fetching transaction receipt...');
  const receipt = await publicClient.getTransactionReceipt({
    hash: deployment.transactionHash as `0x${string}`,
  });

  if (!receipt) {
    console.error('❌ Transaction receipt not found');
    process.exit(1);
  }

  console.log(`✅ Receipt found (${receipt.logs.length} logs)\n`);

  // Find and decode RollupCreated event
  console.log('Searching for RollupCreated event...');

  let rollupCreatedLog = null;
  let decodedEvent = null;

  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: ROLLUP_CREATED_EVENT_ABI,
        data: log.data,
        topics: log.topics,
      });

      if (decoded.eventName === 'RollupCreated') {
        rollupCreatedLog = log;
        decodedEvent = decoded;
        break;
      }
    } catch (e) {
      // Not the event we're looking for, continue
      continue;
    }
  }

  if (!decodedEvent || !rollupCreatedLog) {
    console.error('❌ RollupCreated event not found in transaction logs');
    console.log('\nℹ️  This might mean:');
    console.log('   1. Transaction failed/reverted');
    console.log('   2. Different event signature (old version)');
    console.log('   3. Wrong transaction hash');
    console.log();
    console.log('Check transaction on Etherscan:');
    console.log(`https://sepolia.etherscan.io/tx/${deployment.transactionHash}`);
    process.exit(1);
  }

  console.log('✅ Found RollupCreated event!\n');

  // Extract contract addresses from the event
  const args = decodedEvent.args as any;

  deployment.contracts = {
    rollup: args.rollupAddress,
    inbox: args.inboxAddress,
    outbox: args.outbox,
    adminProxy: args.adminProxy,
    sequencerInbox: args.sequencerInbox,
    bridge: args.bridge,
    validatorWalletCreator: args.validatorWalletCreator,
  };

  console.log('═══════════════════════════════════════════════');
  console.log('Deployed Contract Addresses:');
  console.log('═══════════════════════════════════════════════');
  console.log(`Rollup:                   ${deployment.contracts.rollup}`);
  console.log(`Inbox:                    ${deployment.contracts.inbox}`);
  console.log(`Outbox:                   ${deployment.contracts.outbox}`);
  console.log(`Admin Proxy:              ${deployment.contracts.adminProxy}`);
  console.log(`Sequencer Inbox:          ${deployment.contracts.sequencerInbox}`);
  console.log(`Bridge:                   ${deployment.contracts.bridge}`);
  console.log(`Validator Wallet Creator: ${deployment.contracts.validatorWalletCreator}`);
  console.log('═══════════════════════════════════════════════\n');

  // Additional info from indexed topics
  console.log('Additional Info:');
  console.log(`  Native Token: ${args.nativeToken}`);
  console.log();

  // Save updated deployment file
  writeFileSync(latestFile, JSON.stringify(deployment, null, 2));
  console.log(`💾 Updated deployment file: ${latestFile}\n`);

  // Create a simplified config file for node operators
  const nodeConfig = {
    chainId: deployment.chainId,
    chainName: deployment.chainName,
    parentChainId: deployment.parentChainId,
    rollup: deployment.contracts.rollup,
    inbox: deployment.contracts.inbox,
    outbox: deployment.contracts.outbox,
    sequencerInbox: deployment.contracts.sequencerInbox,
    bridge: deployment.contracts.bridge,
    adminProxy: deployment.contracts.adminProxy,
    validators: deployment.validators,
    batchPoster: deployment.batchPoster,
    nativeToken: args.nativeToken,
  };

  const nodeConfigFile = `config/chain-${deployment.chainId}.json`;
  writeFileSync(nodeConfigFile, JSON.stringify(nodeConfig, null, 2));
  console.log(`📝 Created node config: ${nodeConfigFile}\n`);

  console.log('✅ Parsing complete!\n');
  console.log('═══════════════════════════════════════════════');
  console.log('Next Steps:');
  console.log('═══════════════════════════════════════════════');
  console.log('1. Verify contracts: npm run verify-contracts');
  console.log('2. View on Etherscan:');
  console.log(`   https://sepolia.etherscan.io/address/${deployment.contracts.rollup}`);
  console.log('3. Set up your node with config/chain-' + deployment.chainId + '.json');
  console.log('4. Start sequencer and validator nodes');
  console.log('═══════════════════════════════════════════════\n');
}

main().catch(console.error);