/**
 * Particle Network Configuration
 * Provides EOA wallet + USDC payments on Base Sepolia
 */

export const PARTICLE_CONFIG = {
  projectId: import.meta.env.VITE_PARTICLE_PROJECT_ID || '',
  clientKey: import.meta.env.VITE_PARTICLE_CLIENT_KEY || '',
  appId: import.meta.env.VITE_PARTICLE_APP_ID || '',
} as const

/**
 * Check if Particle is configured
 */
export function isParticleConfigured(): boolean {
  return !!(
    PARTICLE_CONFIG.projectId &&
    PARTICLE_CONFIG.clientKey &&
    PARTICLE_CONFIG.appId
  )
}
