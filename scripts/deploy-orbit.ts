import {
  createRollupPrepareDeploymentParamsConfig,
  createRollupPrepareTransactionRequest,
  prepareChainConfig,
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
  type PublicClient,
  type WalletClient,
  type Address,
} from 'viem';
import { sanitizePrivateKey } from '@arbitrum/orbit-sdk/utils';

config();

const SEPOLIA_CHAIN_ID = 11155111;

async function main(): Promise<DeploymentInfo> {
  console.log('🚀 Deploying Arbitrum Orbit Rollup on Sepolia\n');
  console.log('═══════════════════════════════════════════════\n');

  // Validate environment variables
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY not set in .env');
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

  const validators = process.env.VALIDATOR_ADDRESSES
    ? process.env.VALIDATOR_ADDRESSES.split(',').map(addr => addr.trim() as Address)
    : [deployer.address];

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
          DataAvailabilityCommittee: process.env.DATA_AVAILABILITY_COMMITTEE === 'true',
        },
      }),
    }
  );

  console.log('✅ Configuration prepared\n');

  // Prepare deployment transaction
  console.log('📝 Preparing deployment transaction...');

  // Build deployment params
  const deploymentParams = {
    config: rollupConfig,
    batchPoster,
    validators,
    nativeToken,
    deployFactoriesToL2: true,
    maxDataSize: BigInt(process.env.MAX_DATA_SIZE || '117964'),
    maxFeePerGasForRetryables: BigInt(process.env.MAX_FEE_PER_GAS || '100000000'), // 0.1 gwei
  };

  // Use custom RollupCreator if provided
  if (process.env.ROLLUP_CREATOR_ADDRESS) {
    console.log(`  Using custom RollupCreator: ${process.env.ROLLUP_CREATOR_ADDRESS}`);
  } else {
    console.log('  Using default Sepolia RollupCreator');
  }

  const txRequest = await createRollupPrepareTransactionRequest({
    params: {
      config: rollupConfig,
      batchPosters: [batchPoster],
      validators: validators,
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

  // Find RollupCreated event
  // Event signature: RollupCreated(address indexed rollupAddress, address indexed nativeToken, ...)
  const rollupCreatedEventSignature =
    'RollupCreated(address,address,address,address,address,address,address,address,address,address,address,address)';

  // Calculate event topic
  const rollupCreatedTopic = (() => {
    const encoder = new TextEncoder();
    const data = encoder.encode(rollupCreatedEventSignature);
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      const hashArray = Array.from(new Uint8Array(hash));
      return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  })();

  // For now, store raw event data
  const rollupCreatedLog = receipt.logs.find(
    async log => log.topics[0] === (await rollupCreatedTopic)
  );

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
    contracts: {},
  };

  if (rollupCreatedLog) {
    console.log('✅ Found RollupCreated event\n');

    // Store raw log data for reference
    deploymentInfo.rawEventData = {
      topics: rollupCreatedLog.topics as string[],
      data: rollupCreatedLog.data,
    };
  }

  console.log('═══════════════════════════════════════════════');
  console.log('Deployment Summary:');
  console.log('═══════════════════════════════════════════════');
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log();

  // Save deployment info
  const filename = `deployments/deployment-${chainId}-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Deployment info saved to: ${filename}\n`);

  console.log('📚 Next Steps:');
  console.log('═══════════════════════════════════════════════');
  console.log('1. Run: npm run parse-deployment (to extract contract addresses)');
  console.log('2. Set up your sequencer node with the rollup address');
  console.log('3. Set up validator nodes');
  console.log('4. Configure your chain RPC endpoint');
  console.log('5. Deploy your application contracts to the L2');
  console.log('═══════════════════════════════════════════════\n');

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });