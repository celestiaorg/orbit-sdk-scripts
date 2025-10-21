import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import type { DeploymentInfo } from '../src/types/index.js';

config();

// Etherscan API V2
const ETHERSCAN_API_URL = 'https://api-sepolia.etherscan.io/v2/api';
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds

interface VerificationRequest {
  contractAddress: string;
  contractName: string;
  sourceCode?: string;
  constructorArguments?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: string | any;
}

async function verifyContract(
  address: string,
  contractName: string,
  constructorArgs: string = ''
): Promise<void> {
  if (!process.env.ETHERSCAN_API_KEY) {
    console.log(`⚠️  Skipping ${contractName} - ETHERSCAN_API_KEY not set`);
    return;
  }

  console.log(`\nVerifying ${contractName} at ${address}...`);

  // Check if already verified using V2 API
  const checkParams = new URLSearchParams({
    chainid: '11155111',
    module: 'contract',
    action: 'getsourcecode',
    address: address,
    apikey: process.env.ETHERSCAN_API_KEY,
  });

  try {
    const checkResponse = await fetch(`${ETHERSCAN_API_URL}?${checkParams}`);
    const checkData = await checkResponse.json() as EtherscanResponse;

    if (checkData.status === '1' && checkData.result?.[0]?.SourceCode !== '') {
      console.log(`✅ ${contractName} is already verified`);
      return;
    }
  } catch (error) {
    console.log(`Checking verification status failed, proceeding with verification...`);
  }

  // For Orbit contracts, we need to verify them as proxy contracts
  // The actual implementation is already verified by Arbitrum
  console.log(`📝 Submitting verification for ${contractName}...`);
  console.log(`   Address: ${address}`);
  console.log(`   This is a proxy contract - the implementation is already verified`);

  // Use V2 API to verify as a proxy
  const verifyParams = new URLSearchParams({
    chainid: '11155111',
    module: 'contract',
    action: 'verifyproxycontract',
    address: address,
    apikey: process.env.ETHERSCAN_API_KEY,
  });

  try {
    const verifyResponse = await fetch(`${ETHERSCAN_API_URL}?${verifyParams}`, {
      method: 'POST',
    });
    const verifyData = await verifyResponse.json() as EtherscanResponse;

    if (verifyData.status === '1') {
      console.log(`✅ ${contractName} proxy verification submitted`);
      console.log(`   GUID: ${verifyData.result}`);

      // Check verification status
      await sleep(5000); // Wait 5 seconds before checking

      const statusParams = new URLSearchParams({
        chainid: '11155111',
        module: 'contract',
        action: 'checkproxyverification',
        guid: verifyData.result,
        apikey: process.env.ETHERSCAN_API_KEY,
      });

      const statusResponse = await fetch(`${ETHERSCAN_API_URL}?${statusParams}`);
      const statusData = await statusResponse.json() as EtherscanResponse;

      if (statusData.status === '1') {
        console.log(`✅ ${contractName} verified successfully!`);
      } else {
        console.log(`⏳ ${contractName} verification pending...`);
        console.log(`   Check status: https://sepolia.etherscan.io/address/${address}#code`);
      }
    } else {
      console.log(`⚠️  ${contractName} verification response:`, verifyData.result);
      console.log(`   You can manually verify at: https://sepolia.etherscan.io/proxyContractChecker?a=${address}`);
    }
  } catch (error) {
    console.error(`❌ Error verifying ${contractName}:`, error);
    console.log(`   Manual verification: https://sepolia.etherscan.io/proxyContractChecker?a=${address}`);
  }
}

async function main(): Promise<void> {
  console.log('🔍 Verifying Orbit Contracts on Etherscan\n');
  console.log('═══════════════════════════════════════════════\n');

  if (!process.env.ETHERSCAN_API_KEY) {
    console.error('❌ ETHERSCAN_API_KEY not set in .env');
    console.log('\nTo get an API key:');
    console.log('1. Go to https://etherscan.io/myapikey');
    console.log('2. Sign up/Login');
    console.log('3. Create a new API key');
    console.log('4. Add it to your .env file');
    process.exit(1);
  }

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

  if (!deployment.contracts || Object.keys(deployment.contracts).length === 0) {
    console.error('❌ No contract addresses found in deployment file');
    console.log('Run npm run parse-deployment first to extract contract addresses');
    process.exit(1);
  }

  console.log('Contract Addresses to Verify:');
  console.log('═══════════════════════════════════════════════');

  const contractsToVerify = [
    { address: deployment.contracts.rollup, name: 'Rollup' },
    { address: deployment.contracts.inbox, name: 'Inbox' },
    { address: deployment.contracts.outbox, name: 'Outbox' },
    { address: deployment.contracts.bridge, name: 'Bridge' },
    { address: deployment.contracts.sequencerInbox, name: 'SequencerInbox' },
    { address: deployment.contracts.adminProxy, name: 'AdminProxy' },
  ].filter(c => c.address); // Only include contracts that have addresses

  for (const contract of contractsToVerify) {
    console.log(`  ${contract.name}: ${contract.address}`);
  }
  console.log();

  console.log('Starting verification process...\n');
  console.log('Note: These are proxy contracts. Etherscan will link them');
  console.log('to the already-verified implementation contracts.\n');

  // Verify each contract
  for (const contract of contractsToVerify) {
    await verifyContract(contract.address!, contract.name);
    await sleep(DELAY_BETWEEN_REQUESTS); // Rate limiting
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('Verification Complete!');
  console.log('═══════════════════════════════════════════════\n');

  console.log('View your contracts on Etherscan:');
  for (const contract of contractsToVerify) {
    console.log(`  ${contract.name}: https://sepolia.etherscan.io/address/${contract.address}`);
  }

  console.log('\n💡 Tips:');
  console.log('  - Proxy verification may take a few minutes to process');
  console.log('  - Check the Etherscan links above to see verification status');
  console.log('  - If verification fails, you can manually verify using the proxy checker');
  console.log('  - Implementation contracts are already verified by Arbitrum');
}

main().catch(console.error);