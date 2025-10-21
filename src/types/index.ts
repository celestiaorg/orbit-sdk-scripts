export interface DeploymentInfo {
  chainId: number;
  chainName: string;
  parentChain: string;
  parentChainId: number;
  deployer: string;
  deployedAt: string;
  transactionHash: string;
  blockNumber: number;
  validators: string[];
  batchPoster: string;
  nativeToken: string;
  contracts: {
    rollup?: string;
    inbox?: string;
    outbox?: string;
    adminProxy?: string;
    sequencerInbox?: string;
    bridge?: string;
    utils?: string;
    validatorWalletCreator?: string;
  };
  rawEventData?: {
    topics: string[];
    data: string;
  };
}

export interface ChainConfig {
  chainId: number;
  homesteadBlock: number;
  eip150Block: number;
  eip155Block: number;
  eip158Block: number;
  byzantiumBlock: number;
  constantinopleBlock: number;
  petersburgBlock: number;
  istanbulBlock: number;
  muirGlacierBlock: number;
  berlinBlock: number;
  londonBlock: number;
  clique: {
    period: number;
    epoch: number;
  };
  arbitrum: {
    EnableArbOS: boolean;
    AllowDebugPrecompiles: boolean;
    DataAvailabilityCommittee: boolean;
    InitialArbOSVersion: number;
    InitialChainOwner: string;
    GenesisBlockNum: number;
  };
}
