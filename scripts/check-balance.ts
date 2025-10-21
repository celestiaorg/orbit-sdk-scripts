import { config } from 'dotenv';
import { createPublicClient, formatEther, http } from 'viem';
import { sepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { sanitizePrivateKey } from '@arbitrum/orbit-sdk/utils';

config();

async function main(): Promise<void> {
  if (!process.env.PRIVATE_KEY || !process.env.PARENT_CHAIN_RPC) {
    throw new Error('PRIVATE_KEY and PARENT_CHAIN_RPC must be set in .env');
  }

  const account = privateKeyToAccount(sanitizePrivateKey(process.env.PRIVATE_KEY));

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.PARENT_CHAIN_RPC),
  });

  console.log('💰 Checking Balance\n');
  console.log(`Address: ${account.address}`);

  const balance = await publicClient.getBalance({
    address: account.address,
  });

  const balanceEth = formatEther(balance);
  console.log(`Balance: ${balanceEth} ETH`);

  const requiredBalance = BigInt('500000000000000000'); // 0.5 ETH in wei

  if (balance < requiredBalance) {
    console.log('\n⚠️  Low balance! You need at least 0.5 ETH for deployment.');
    console.log('Get Sepolia ETH from: https://sepoliafaucet.com/');
  } else {
    console.log('\n✅ Sufficient balance for deployment');
  }
}

main().catch(console.error);
