#!/bin/bash

# Orbit x Celestia Node Quick Start Script
# This script helps you quickly spin up a node for your deployed Orbit rollup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_info "Orbit x Celestia Node Setup"
echo ""

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists docker; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

if ! command_exists docker-compose; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi
print_success "Docker Compose is installed"

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
print_success "Node.js is installed"

# Smart config file detection
CONFIG_PATH=""
if [ -f "./config/nodeConfig.json" ]; then
    CONFIG_PATH="./config/nodeConfig.json"
    print_success "Found nodeConfig.json at $CONFIG_PATH"
elif [ -f "./config/node-config.json" ]; then
    CONFIG_PATH="./config/node-config.json"
    print_success "Found node-config.json at $CONFIG_PATH"
elif [ -f "./nodeConfig.json" ]; then
    CONFIG_PATH="./nodeConfig.json"
    print_success "Found nodeConfig.json at $CONFIG_PATH"
elif [ -d "./config" ]; then
    # Look for node-config-*.json or nodeConfig-*.json files
    shopt -s nullglob
    NODE_CONFIGS=(./config/node-config*.json ./config/nodeConfig*.json)
    shopt -u nullglob

    if [ ${#NODE_CONFIGS[@]} -eq 1 ]; then
        CONFIG_PATH="${NODE_CONFIGS[0]}"
        print_success "Found config file at $CONFIG_PATH"
    elif [ ${#NODE_CONFIGS[@]} -gt 1 ]; then
        print_error "Multiple config files found:"
        for config in "${NODE_CONFIGS[@]}"; do
            echo "  - $config"
        done
        echo ""
        print_info "Please specify which config to use:"
        read -p "$(echo -e ${BLUE}Enter path to config file: ${NC})" CONFIG_PATH
        if [ ! -f "$CONFIG_PATH" ]; then
            print_error "File not found: $CONFIG_PATH"
            exit 1
        fi
    else
        print_error "Node config file not found. Please run the deployment script first."
        echo ""
        print_info "Expected locations:"
        echo "  - ./config/nodeConfig.json"
        echo "  - ./config/node-config-{chainId}.json"
        echo "  - ./nodeConfig.json"
        exit 1
    fi
else
    print_error "Node config file not found. Please run the deployment script first."
    echo ""
    print_info "Expected locations:"
    echo "  - ./config/nodeConfig.json"
    echo "  - ./config/node-config-{chainId}.json"
    echo "  - ./nodeConfig.json"
    exit 1
fi

# Prompt for Celestia configuration
echo ""
print_info "Celestia Configuration"
print_info "Please provide your Celestia node details. Some fields are required for production use."
echo ""

# Core Network
read -p "$(echo -e ${BLUE}Enter Celestia core network ${NC}[default: mocha-4]: )" CELESTIA_CORE_NETWORK
CELESTIA_CORE_NETWORK=${CELESTIA_CORE_NETWORK:-mocha-4}

# Core Token (Required)
echo ""
print_warning "Core Token is REQUIRED for production use"
read -p "$(echo -e ${BLUE}Enter your Celestia Core Token: ${NC})" CELESTIA_CORE_TOKEN
if [ -z "$CELESTIA_CORE_TOKEN" ]; then
    print_warning "No Core Token provided - node may not function properly!"
fi

# Core URL (gRPC endpoint)
echo ""
print_info "Core URL should be a gRPC endpoint (usually port 9090)"
print_info "Example: grpc.celestia-mocha.com:9090"
print_warning "Do NOT include https:// or http:// in the URL"
read -p "$(echo -e ${BLUE}Enter Celestia Core URL ${NC}[leave empty to skip]: )" CELESTIA_CORE_URL
if [ -z "$CELESTIA_CORE_URL" ]; then
    print_warning "No Core URL provided - node may not function properly!"
fi

# TLS for Core connection
echo ""
read -p "$(echo -e ${BLUE}Enable TLS for Core connection? ${NC}[Y/n]: )" ENABLE_TLS
ENABLE_TLS=${ENABLE_TLS:-y}
if [[ "$ENABLE_TLS" =~ ^[Nn]$ ]]; then
    CELESTIA_ENABLE_TLS_FLAG="--celestia-disable-core-tls"
else
    CELESTIA_ENABLE_TLS_FLAG=""
fi

# Namespace ID
echo ""
print_info "Namespace ID must be exactly 10 bytes (20 hex characters)"
read -p "$(echo -e ${BLUE}Enter Celestia namespace ID ${NC}[leave empty to auto-generate]: )" CELESTIA_NAMESPACE

# RPC Endpoint
echo ""
read -p "$(echo -e ${BLUE}Enter Celestia RPC endpoint ${NC}[default: http://0.0.0.0:26658/]: )" CELESTIA_RPC
CELESTIA_RPC=${CELESTIA_RPC:-"http://0.0.0.0:26658/"}

# Auth Token (optional)
echo ""
read -p "$(echo -e ${BLUE}Enter Celestia auth token ${NC}[leave empty if not required]: )" CELESTIA_AUTH_TOKEN

# Key Path (optional)
echo ""
print_info "If you have existing Celestia keys, provide the path to the keys directory"
print_info "Otherwise, keys will be stored in a Docker volume for persistence"
print_info "Recommended path for Mocha: \${HOME}/.celestia-light-mocha-4/keys"
read -p "$(echo -e ${BLUE}Enter path to Celestia keys directory ${NC}[leave empty to use Docker volume]: )" CELESTIA_KEY_PATH
if [ -n "$CELESTIA_KEY_PATH" ]; then
    if [ -d "$CELESTIA_KEY_PATH" ]; then
        print_success "Keys directory found at $CELESTIA_KEY_PATH"
    else
        print_warning "Keys directory not found at $CELESTIA_KEY_PATH - will be created if needed"
    fi
fi

# Determine script location - check common locations
GENERATOR_SCRIPT=""
if [ -f "./generate-docker-compose.ts" ]; then
    GENERATOR_SCRIPT="./generate-docker-compose.ts"
elif [ -f "./scripts/generate-docker-compose.ts" ]; then
    GENERATOR_SCRIPT="./scripts/generate-docker-compose.ts"
elif [ -f "./scripts/node/generate-docker-compose.ts" ]; then
    GENERATOR_SCRIPT="./scripts/node/generate-docker-compose.ts"
elif [ -f "$SCRIPT_DIR/generate-docker-compose.ts" ]; then
    GENERATOR_SCRIPT="$SCRIPT_DIR/generate-docker-compose.ts"
else
    print_error "Could not find generate-docker-compose.ts"
    print_info "Please ensure the script is in one of:"
    echo "  - ./generate-docker-compose.ts"
    echo "  - ./scripts/generate-docker-compose.ts"
    echo "  - ./scripts/node/generate-docker-compose.ts"
    exit 1
fi

# Build the command arguments
ARGS=("--config" "$CONFIG_PATH")

# Add Core Network
ARGS+=("--celestia-core-network" "$CELESTIA_CORE_NETWORK")

# Add Core Token if provided
if [ -n "$CELESTIA_CORE_TOKEN" ]; then
    ARGS+=("--celestia-core-token" "$CELESTIA_CORE_TOKEN")
fi

# Add Core URL if provided
if [ -n "$CELESTIA_CORE_URL" ]; then
    ARGS+=("--celestia-core-url" "$CELESTIA_CORE_URL")
fi

# Add TLS flag if needed
if [ -n "$CELESTIA_ENABLE_TLS_FLAG" ]; then
    ARGS+=("$CELESTIA_ENABLE_TLS_FLAG")
fi

# Add Namespace if provided
if [ -n "$CELESTIA_NAMESPACE" ]; then
    ARGS+=("--celestia-namespace" "$CELESTIA_NAMESPACE")
fi

# Add RPC
ARGS+=("--celestia-rpc" "$CELESTIA_RPC")

# Add Auth Token if provided
if [ -n "$CELESTIA_AUTH_TOKEN" ]; then
    ARGS+=("--celestia-auth-token" "$CELESTIA_AUTH_TOKEN")
fi

# Add Key Path if provided
if [ -n "$CELESTIA_KEY_PATH" ]; then
    ARGS+=("--celestia-key-path" "$CELESTIA_KEY_PATH")
fi

# Generate docker-compose.yml
echo ""
print_info "Generating docker-compose.yml..."
npx tsx "$GENERATOR_SCRIPT" "${ARGS[@]}"

if [ $? -eq 0 ]; then
    print_success "docker-compose.yml generated successfully"
else
    print_error "Failed to generate docker-compose.yml"
    exit 1
fi

# Validation warnings
echo ""
if [ -z "$CELESTIA_CORE_TOKEN" ] || [ -z "$CELESTIA_CORE_URL" ]; then
    print_warning "⚠️  IMPORTANT: Missing required configuration!"
    echo ""
    if [ -z "$CELESTIA_CORE_TOKEN" ]; then
        echo "  • Core Token is missing - this is REQUIRED for production"
    fi
    if [ -z "$CELESTIA_CORE_URL" ]; then
        echo "  • Core URL is missing - this is REQUIRED for production"
    fi
    echo ""
    print_info "You can edit docker-compose.yml manually to add these values later"
    echo ""
fi

# Ask if user wants to start the node
read -p "$(echo -e ${BLUE}Do you want to start the node now? ${NC}[Y/n]: )" START_NODE
START_NODE=${START_NODE:-y}

if [[ "$START_NODE" =~ ^[Yy]$ ]]; then
    print_info "Starting Docker containers..."
    docker-compose up -d

    if [ $? -eq 0 ]; then
        print_success "Node started successfully!"
        echo ""
        print_info "Node Information:"
        echo "  RPC Endpoint: http://localhost:8547"
        echo "  Metrics: http://localhost:6070"
        echo ""
        print_info "Celestia Server Ports:"
        echo "  API: http://localhost:1317"
        echo "  gRPC: http://localhost:9090"
        echo "  RPC: http://localhost:26657"
        echo "  Other: 1095, 8080"
        echo ""
        print_info "Useful Commands:"
        echo "  View logs: docker-compose logs -f nitro-celestia-node"
        echo "  View Celestia logs: docker-compose logs -f celestia-server"
        echo "  Stop node: docker-compose down"
        echo "  Restart node: docker-compose restart"
        echo ""
        print_info "Testing the connection..."
        sleep 5

        CHAIN_ID=$(curl -s -X POST http://localhost:8547 \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' 2>/dev/null | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

        if [ -n "$CHAIN_ID" ] && [ "$CHAIN_ID" != "null" ]; then
            print_success "Node is responding! Chain ID: $CHAIN_ID"
        else
            print_warning "Node started but not responding yet. Please wait a few minutes for initialization."
            print_info "Check logs with: docker-compose logs -f nitro-celestia-node"
        fi
    else
        print_error "Failed to start Docker containers"
        exit 1
    fi
else
    print_info "Docker Compose file generated. Start the node with: docker-compose up -d"
fi

echo ""
print_success "Setup complete!"