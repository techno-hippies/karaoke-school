import { nagaDev, nagaLocal, nagaStaging, nagaTest } from '@lit-protocol/networks';

export type LitNetworkName = 'naga-dev' | 'naga-test' | 'naga-staging' | 'naga-local';

const SUPPORTED_LIT_NETWORKS: Record<LitNetworkName, any> = {
  'naga-dev': nagaDev,
  'naga-test': nagaTest,
  'naga-staging': nagaStaging,
  'naga-local': nagaLocal,
};

const DEFAULT_LIT_NETWORK: LitNetworkName = 'naga-dev';

export function getLitNetworkConfig(envValue?: string) {
  const litNetwork = (envValue || process.env.LIT_NETWORK || DEFAULT_LIT_NETWORK).toLowerCase() as LitNetworkName;
  const networkModule = SUPPORTED_LIT_NETWORKS[litNetwork];

  if (!networkModule) {
    const supported = Object.keys(SUPPORTED_LIT_NETWORKS).join(', ');
    throw new Error(`Unsupported LIT_NETWORK="${litNetwork}". Supported: ${supported}`);
  }

  const chainConfig = networkModule.getChainConfig?.();
  const rpcUrl = networkModule.getRpcUrl?.();
  const networkName = networkModule.getNetworkName?.() ?? litNetwork;

  return {
    litNetwork,
    networkModule,
    chainConfig,
    rpcUrl,
    networkName,
  };
}

export const defaultLitNetwork = DEFAULT_LIT_NETWORK;
