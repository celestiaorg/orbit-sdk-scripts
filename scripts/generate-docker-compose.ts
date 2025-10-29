#!/usr/bin/env tsx

import fs from 'fs';
import crypto from 'crypto';

interface NodeConfig {
    chain: {
        'info-json': string;
        name: string;
        id: number;
    };
    'parent-chain': {
        connection: {
            url: string;
        };
    };
    http?: {
        port?: number;
        addr?: string;
    };
    node: any;
}

interface DockerComposeConfig {
    services: {
        'nitro-celestia-node': {
            image: string;
            container_name: string;
            depends_on: string[];
            ports: string[];
            volumes: string[];
            command: string[];
        };
        'celestia-server': {
            image: string;
            container_name: string;
            entrypoint: string[];
            ports: string[];
        };
    };
    volumes: {
        'node-data': null;
    };
}

function generateDockerCompose(nodeConfigPath: string, outputPath: string, options: {
    celestiaNamespace?: string;
    celestiaRpcEndpoint?: string;
    celestiaAuthToken?: string;
    nitroImage?: string;
    celestiaServerImage?: string;
    containerName?: string;
}) {
    // Read the node config
    const nodeConfigContent = fs.readFileSync(nodeConfigPath, 'utf-8');
    const nodeConfig: NodeConfig = JSON.parse(nodeConfigContent);

    // Extract chain info
    const chainId = nodeConfig.chain.id;
    const chainName = nodeConfig.chain.name;

    // Extract HTTP port from config (default to 8547 if not specified)
    const httpPort = nodeConfig.http?.port || 8547;

    // Auto-generate namespace if not provided
    let celestiaNamespace = options.celestiaNamespace;
    let namespaceGenerated = false;

    if (!celestiaNamespace) {
        // Generate a deterministic namespace from chain ID
        // Celestia namespace must be exactly 10 bytes (20 hex characters)
        const hash = crypto.createHash('sha256').update(`orbit-${chainId}`).digest('hex');
        celestiaNamespace = '0x' + hash.substring(0, 20); // 10 bytes = 20 hex chars
        namespaceGenerated = true;
    }

    // Check if RPC endpoint was provided
    const celestiaRpcEndpoint = options.celestiaRpcEndpoint || 'https://rpc-mocha.pops.one';
    const rpcNotProvided = !options.celestiaRpcEndpoint;

    // Check if auth token was provided
    const celestiaAuthToken = options.celestiaAuthToken;

    // Extract parent chain URL for initialization
    const parentChainUrl = nodeConfig['parent-chain']?.connection?.url || '';

    const {
        nitroImage = 'ghcr.io/celestiaorg/nitro:v3.6.8',
        celestiaServerImage = 'ghcr.io/celestiaorg/nitro-das-celestia:v0.6.2-mocha',
        containerName = `orbit-${nodeConfig.chain.name.toLowerCase().replace(/\s+/g, '-')}`,
    } = options;

    // Build celestia server entrypoint
    const celestiaEntrypoint = [
        '/bin/celestia-server',
        '--celestia.namespace-id',
        celestiaNamespace.startsWith('0x') ? celestiaNamespace.slice(2) : celestiaNamespace,
        '--rpc-addr',
        '0.0.0.0',
        '--rpc-port',
        '26657',
        '--celestia.rpc',
        celestiaRpcEndpoint,
        '--log-level',
        'INFO',
    ];

    // Add auth token if provided
    if (celestiaAuthToken) {
        celestiaEntrypoint.push('--celestia.auth-token');
        celestiaEntrypoint.push(celestiaAuthToken);
    }

    // Build the Docker Compose config
    const dockerCompose: DockerComposeConfig = {
        services: {
            'nitro-celestia-node': {
                image: nitroImage,
                container_name: containerName,
                depends_on: ['celestia-server'],
                ports: [
                    `8547:${httpPort}`,
                    '8548:8548',
                    '9642:9642',
                    '6070:6070',
                ],
                volumes: [
                    `${nodeConfigPath}:/home/user/nodeConfig.json:ro`,
                    'node-data:/home/user/.arbitrum/local/nitro',
                ],
                command: [
                    '--conf.file',
                    '/home/user/nodeConfig.json',
                ],
            },
            'celestia-server': {
                image: celestiaServerImage,
                container_name: 'celestia-server',
                entrypoint: celestiaEntrypoint,
                ports: [
                    '1317:1317',
                    '9090:9090',
                    '26657:26657',
                    '1095:1095',
                    '8080:8080',
                ],
            },
        },
        volumes: {
            'node-data': null,
        },
    };

    // Write the docker-compose.yml file
    const yamlContent = generateYaml(dockerCompose);
    fs.writeFileSync(outputPath, yamlContent);

    console.log(`✅ Docker Compose file generated successfully at: ${outputPath}`);
    console.log(`\n📝 Configuration Summary:`);
    console.log(`   Chain Name: ${chainName}`);
    console.log(`   Chain ID: ${chainId}`);
    console.log(`   Container Name: ${containerName}`);
    console.log(`   HTTP Port: ${httpPort} (mapped to host port 8547)`);
    console.log(`   Config File: ${nodeConfigPath} (mounted read-only)`);
    console.log(`   Celestia Namespace: ${celestiaNamespace}`);
    if (namespaceGenerated) {
        console.log(`   ℹ️  Namespace was auto-generated from chain ID`);
    }
    console.log(`   Celestia RPC: ${celestiaRpcEndpoint}`);
    if (celestiaAuthToken) {
        console.log(`   Celestia Auth Token: ${celestiaAuthToken.substring(0, 20)}...`);
    }

    if (rpcNotProvided) {
        console.log(`\n⚠️  WARNING: No Celestia RPC endpoint provided!`);
        console.log(`   Using default public endpoint: https://rpc-mocha.pops.one`);
        console.log(`   For production, use your own Celestia node or a dedicated RPC provider.`);
        console.log(`   You can update this in the generated docker-compose.yml file.`);
    }

    console.log(`\n📖 Note: The Nitro node will read all configuration from the mounted nodeConfig.json file`);
    console.log(`   This includes: chain config, parent chain RPC, sequencer settings, keys, etc.`);
    console.log(`\n🚀 To start your node, run: docker-compose -f ${outputPath} up -d`);
}

function generateYaml(config: DockerComposeConfig): string {
    let yaml = `# Docker Compose configuration for Orbit x Celestia chain
# Generated from nodeConfig.json
#
# The Nitro node reads all its configuration from the mounted config file.
# Only the Celestia server settings need to be configured here.

services:
  nitro-celestia-node:
    image: ${config.services['nitro-celestia-node'].image}
    container_name: ${config.services['nitro-celestia-node'].container_name}
    depends_on:
${config.services['nitro-celestia-node'].depends_on.map(d => `      - ${d}`).join('\n')}
    ports:
${config.services['nitro-celestia-node'].ports.map(p => `      - "${p}"`).join('\n')}
    volumes:
${config.services['nitro-celestia-node'].volumes.map(v => `      - ${v}`).join('\n')}
    command:
${config.services['nitro-celestia-node'].command.map(c => `      - ${c}`).join('\n')}

  celestia-server:
    image: ${config.services['celestia-server'].image}
    container_name: ${config.services['celestia-server'].container_name}
    entrypoint:
${config.services['celestia-server'].entrypoint.map(e => `      - "${e}"`).join('\n')}
    ports:
${config.services['celestia-server'].ports.map(p => `      - "${p}"`).join('\n')}
`;

    return yaml;
}

// CLI interface
function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Usage: tsx generate-docker-compose.ts [options]

This script generates a docker-compose.yml that mounts your nodeConfig.json file.
The Nitro node will read all its configuration from the mounted config file using
the --conf.file flag, making setup much simpler.

The script automatically detects your config file:
  • First checks: ./config/nodeConfig.json
  • Then looks for: ./config/node-config-{chainId}.json
  • Also checks: ./config/nodeConfig-{chainId}.json
  • If multiple files found, asks you to specify

Options:
  --config <path>              Path to nodeConfig.json (default: ./config/nodeConfig.json)
  --output <path>              Output path for docker-compose.yml (default: ./docker-compose.yml)
  --celestia-namespace <id>    Celestia namespace ID (auto-generated if not provided)
  --celestia-rpc <url>         Celestia node RPC endpoint (defaults to public mocha endpoint)
  --celestia-auth-token <tok>  Celestia auth token (required if using authenticated endpoint)
  --nitro-image <image>        Nitro Docker image (default: ghcr.io/celestiaorg/nitro:v3.6.8)
  --celestia-image <image>     Celestia server image (default: ghcr.io/celestiaorg/nitro-das-celestia:v0.4.3)
  --container-name <name>      Container name (default: orbit-<chain-name>)
  --help, -h                   Show this help message

Examples:
  # Minimal usage - namespace auto-generated, default RPC used
  tsx generate-docker-compose.ts

  # With specific Celestia namespace and RPC
  tsx generate-docker-compose.ts \\
    --celestia-namespace 0x1234567890abcdef \\
    --celestia-rpc https://rpc-mocha.pops.one

  # Specify custom config location
  tsx generate-docker-compose.ts \\
    --config ./deployments/nodeConfig.json

  # Use custom Docker images
  tsx generate-docker-compose.ts \\
    --nitro-image ghcr.io/myorg/custom-nitro:v1.0.0

What the generated docker-compose.yml does:
  • Mounts ./config/nodeConfig.json as read-only into the container
  • Uses --conf.file flag to tell Nitro to read from the config file
  • All node configuration (sequencer, validator, keys, parent chain) comes from nodeConfig.json
  • Only Celestia-specific settings need to be provided to this script
  • Auto-generates a namespace if you don't provide one

This approach is simpler than passing dozens of individual flags!
`);
        process.exit(0);
    }

    const configIndex = args.indexOf('--config');
    const configPath = configIndex !== -1 ? args[configIndex + 1] : './config/nodeConfig.json';

    const outputIndex = args.indexOf('--output');
    const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : './docker-compose.yml';

    const namespaceIndex = args.indexOf('--celestia-namespace');
    const celestiaNamespace = namespaceIndex !== -1 ? args[namespaceIndex + 1] : undefined;

    const rpcIndex = args.indexOf('--celestia-rpc');
    const celestiaRpc = rpcIndex !== -1 ? args[rpcIndex + 1] : undefined;

    const authTokenIndex = args.indexOf('--celestia-auth-token');
    const celestiaAuthToken = authTokenIndex !== -1 ? args[authTokenIndex + 1] : undefined;

    const nitroImageIndex = args.indexOf('--nitro-image');
    const nitroImage = nitroImageIndex !== -1 ? args[nitroImageIndex + 1] : undefined;

    const celestiaImageIndex = args.indexOf('--celestia-image');
    const celestiaImage = celestiaImageIndex !== -1 ? args[celestiaImageIndex + 1] : undefined;

    const containerNameIndex = args.indexOf('--container-name');
    const containerName = containerNameIndex !== -1 ? args[containerNameIndex + 1] : undefined;

    // Smart config file detection
    let finalConfigPath = configPath;

    if (!fs.existsSync(configPath) && configPath === './config/nodeConfig.json') {
        // If default path doesn't exist, look for node-config-{chainId}.json or nodeConfig-{chainId}.json files
        const configDir = './config';
        if (fs.existsSync(configDir)) {
            const files = fs.readdirSync(configDir);
            const nodeConfigFiles = files.filter(f =>
                (f.startsWith('node-config') || f.startsWith('nodeConfig')) && f.endsWith('.json')
            );

            if (nodeConfigFiles.length === 1) {
                finalConfigPath = `${configDir}/${nodeConfigFiles[0]}`;
                console.log(`ℹ️  Found config file: ${finalConfigPath}`);
            } else if (nodeConfigFiles.length > 1) {
                console.error(`❌ Error: Multiple config files found in ${configDir}:`);
                nodeConfigFiles.forEach(f => console.error(`   - ${f}`));
                console.error('Please specify which one to use with --config <path>');
                process.exit(1);
            }
        }
    }

    if (!fs.existsSync(finalConfigPath)) {
        console.error(`❌ Error: nodeConfig.json not found at ${finalConfigPath}`);
        console.error('Please specify the correct path with --config <path>');
        process.exit(1);
    }

    try {
        generateDockerCompose(finalConfigPath, outputPath, {
            celestiaNamespace,
            celestiaRpcEndpoint: celestiaRpc,
            celestiaAuthToken,
            nitroImage,
            celestiaServerImage: celestiaImage,
            containerName,
        });
    } catch (error) {
        console.error('❌ Error generating docker-compose.yml:', error);
        process.exit(1);
    }
}

main();