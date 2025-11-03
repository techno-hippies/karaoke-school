// Stub module to avoid wagmi/core viem version conflicts
// Lit Protocol imports this but we provide minimal mocks

export function createConfig(...args: any[]) {
  console.warn('[wagmi stub] createConfig called but stubbed')
  return {}
}

export function connect(...args: any[]) {
  console.warn('[wagmi stub] connect called but stubbed')
  return Promise.resolve({})
}

export function disconnect(...args: any[]) {
  console.warn('[wagmi stub] disconnect called but stubbed')
  return Promise.resolve()
}

// Export default for CommonJS compatibility
export default {
  createConfig,
  connect,
  disconnect,
}
