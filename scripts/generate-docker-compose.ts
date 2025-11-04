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
            volumes?: string[];
        };
    };
    volumes: {
        'node-data': null;
        'celestia-keys'?: null;
    };
}

interface CelestiaOptions {
    celestiaNamespace?: string;
    celestiaRpcEndpoint?: string;
    celestiaAuthToken?: string;
    celestiaCoreNetwork?: string;
    celestiaCoreToken?: string;
    celestiaCoreUrl?: string;
    celestiaEnableCoreTls?: boolean;
    celestiaKeyPath?: string;
    nitroImage?: string;
    celestiaServerImage?: string;
    containerName?: string;
}

function generateDockerCompose(nodeConfigPath: string, outputPath: string, options: CelestiaOptions) {
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

    // Set defaults for Celestia configuration
    const celestiaRpcEndpoint = options.celestiaRpcEndpoint || 'http://0.0.0.0:26658/';
    const celestiaCoreNetwork = options.celestiaCoreNetwork || 'mocha-4';
    const celestiaCoreToken = options.celestiaCoreToken || '';
    const celestiaCoreUrl = options.celestiaCoreUrl || '';
    const celestiaEnableCoreTls = options.celestiaEnableCoreTls !== false; // default true
    const celestiaAuthToken = options.celestiaAuthToken || '';

    const {
        nitroImage = 'ghcr.io/celestiaorg/nitro:v3.6.8',
        celestiaServerImage = 'ghcr.io/celestiaorg/nitro-das-celestia:v0.6.3-mocha',
        containerName = `orbit-${nodeConfig.chain.name.toLowerCase().replace(/\s+/g, '-')}`,
    } = options;

    // Build celestia server entrypoint
    const celestiaEntrypoint = [
        '/bin/celestia-server',
        '--celestia.experimental-tx-client',
        '--celestia.core-network',
        celestiaCoreNetwork,
    ];

    // Add core token if provided
    if (celestiaCoreToken) {
        celestiaEntrypoint.push('--celestia.core-token');
        celestiaEntrypoint.push(celestiaCoreToken);
    }

    // Add core URL if provided
    if (celestiaCoreUrl) {
        celestiaEntrypoint.push('--celestia.core-url');
        celestiaEntrypoint.push(celestiaCoreUrl);
    }

    // Add TLS flag
    if (celestiaEnableCoreTls) {
        celestiaEntrypoint.push('--celestia.enable-core-tls');
    }

    // Continue with remaining required flags
    celestiaEntrypoint.push(
        '--celestia.with-writer',
        '--celestia.namespace-id',
        celestiaNamespace.startsWith('0x') ? celestiaNamespace.slice(2) : celestiaNamespace,
        '--rpc-addr',
        '0.0.0.0',
        '--rpc-port',
        '26657',
        '--celestia.rpc',
        celestiaRpcEndpoint,
        '--log-level',
        'DEBUG'
    );

    // Add auth token if provided
    if (celestiaAuthToken) {
        celestiaEntrypoint.push('--celestia.auth-token');
        celestiaEntrypoint.push(celestiaAuthToken);
    } else {
        celestiaEntrypoint.push('--celestia.auth-token');
        celestiaEntrypoint.push('');
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

    // Add celestia-server volumes if key path is provided
    if (options.celestiaKeyPath) {
        dockerCompose.services['celestia-server'].volumes = [
            `${options.celestiaKeyPath}:/home/celestia/`,
        ];
        dockerCompose.volumes['celestia-keys'] = null;
    } else {
        // Even without a key path, we should create a volume for persistence
        dockerCompose.services['celestia-server'].volumes = [
            'celestia-keys:/home/celestia/',
        ];
        dockerCompose.volumes['celestia-keys'] = null;
    }

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
    console.log(`\n🔵 Celestia Configuration:`);
    console.log(`   Namespace: ${celestiaNamespace}`);
    if (namespaceGenerated) {
        console.log(`   ℹ️  Namespace was auto-generated from chain ID`);
    }
    console.log(`   Core Network: ${celestiaCoreNetwork}`);
    if (celestiaCoreToken) {
        console.log(`   Core Token: ${celestiaCoreToken.substring(0, 20)}...`);
    } else {
        console.log(`   Core Token: (not provided)`);
    }
    if (celestiaCoreUrl) {
        console.log(`   Core URL (gRPC): ${celestiaCoreUrl}`);
    } else {
        console.log(`   Core URL (gRPC): (not provided)`);
    }
    console.log(`   Enable Core TLS: ${celestiaEnableCoreTls}`);
    console.log(`   RPC Endpoint: ${celestiaRpcEndpoint}`);
    if (celestiaAuthToken) {
        console.log(`   Auth Token: ${celestiaAuthToken.substring(0, 20)}...`);
    } else {
        console.log(`   Auth Token: (empty)`);
    }
    if (options.celestiaKeyPath) {
        console.log(`   Key Path: ${options.celestiaKeyPath} (mounted to celestia-server)`);
    } else {
        console.log(`   Key Storage: Using Docker volume 'celestia-keys' for persistence`);
    }

    if (!celestiaCoreToken || !celestiaCoreUrl) {
        console.log(`\n⚠️  WARNING: Core Token or Core URL not provided!`);
        console.log(`   These are required for production use.`);
        console.log(`   You can update them in the generated docker-compose.yml file.`);
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
# Celestia server configuration is included with all required fields.

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
${config.services['celestia-server'].ports.map(p => `      - "${p}"`).join('\n')}`;

    // Add volumes section for celestia-server if present
    if (config.services['celestia-server'].volumes && config.services['celestia-server'].volumes.length > 0) {
        yaml += `
    volumes:
${config.services['celestia-server'].volumes.map(v => `      - ${v}`).join('\n')}`;
    }

    yaml += `

volumes:
  node-data:`;

    // Add celestia-keys volume if present
    if (config.volumes['celestia-keys'] !== undefined) {
        yaml += `
  celestia-keys:`;
    }

    yaml += '\n';
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
  --config <path>                 Path to nodeConfig.json (default: ./config/nodeConfig.json)
  --output <path>                 Output path for docker-compose.yml (default: ./docker-compose.yml)

  Celestia Configuration:
  --celestia-namespace <id>       Celestia namespace ID (auto-generated if not provided)
  --celestia-rpc <url>            Celestia node RPC endpoint (default: http://0.0.0.0:26658/)
  --celestia-auth-token <token>   Celestia auth token (optional)
  --celestia-core-network <name>  Celestia core network name (default: mocha-4)
  --celestia-core-token <token>   Celestia core token (required for production)
  --celestia-core-url <url>       Celestia core gRPC URL (e.g., grpc.celestia-mocha.com:9090)
  --celestia-key-path <path>      Path to Celestia keys directory to mount
  --celestia-enable-core-tls      Enable TLS for core connection (default: true)
  --celestia-disable-core-tls     Disable TLS for core connection

  Docker Images:
  --nitro-image <image>           Nitro Docker image (default: ghcr.io/celestiaorg/nitro:v3.6.8)
  --celestia-image <image>        Celestia server image (default: ghcr.io/celestiaorg/nitro-das-celestia:v0.6.3-mocha)
  --container-name <name>         Container name (default: orbit-<chain-name>)

  --help, -h                      Show this help message

Examples:
  # Minimal usage - namespace auto-generated, defaults used
  tsx generate-docker-compose.ts

  # Full Celestia configuration
  tsx generate-docker-compose.ts \\
    --celestia-namespace 0x1234567890abcdef1234 \\
    --celestia-core-network mocha-4 \\
    --celestia-core-token "your-core-token-here" \\
    --celestia-core-url "grpc.celestia-mocha.com:9090" \\
    --celestia-rpc "http://151.115.61.39:26658/" \\
    --celestia-key-path "./celestia-keys"

  # Specify custom config location
  tsx generate-docker-compose.ts \\
    --config ./deployments/nodeConfig.json

  # Use custom Docker images
  tsx generate-docker-compose.ts \\
    --nitro-image ghcr.io/myorg/custom-nitro:v1.0.0

Important Notes:
  • The Core Token and Core URL are required for production use
  • The Core URL should be a gRPC endpoint (usually port 9090)
  • Do NOT include https:// in the Core URL
  • The namespace must be exactly 10 bytes (20 hex characters)
  • TLS is enabled by default for core connection
  • If no key path is provided, keys will be stored in a Docker volume
  • Key path should point to a directory containing Celestia keys
`);
        process.exit(0);
    }

    // Parse command line arguments
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

    const coreNetworkIndex = args.indexOf('--celestia-core-network');
    const celestiaCoreNetwork = coreNetworkIndex !== -1 ? args[coreNetworkIndex + 1] : undefined;

    const coreTokenIndex = args.indexOf('--celestia-core-token');
    const celestiaCoreToken = coreTokenIndex !== -1 ? args[coreTokenIndex + 1] : undefined;

    const coreUrlIndex = args.indexOf('--celestia-core-url');
    const celestiaCoreUrl = coreUrlIndex !== -1 ? args[coreUrlIndex + 1] : undefined;

    const keyPathIndex = args.indexOf('--celestia-key-path');
    const celestiaKeyPath = keyPathIndex !== -1 ? args[keyPathIndex + 1] : undefined;

    // Handle TLS flag
    let celestiaEnableCoreTls = true;
    if (args.includes('--celestia-disable-core-tls')) {
        celestiaEnableCoreTls = false;
    } else if (args.includes('--celestia-enable-core-tls')) {
        celestiaEnableCoreTls = true;
    }

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
            celestiaCoreNetwork,
            celestiaCoreToken,
            celestiaCoreUrl,
            celestiaEnableCoreTls,
            celestiaKeyPath,
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