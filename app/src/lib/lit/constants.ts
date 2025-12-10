// src/lib/lit/constants.ts

export const LIT_SESSION_STORAGE_KEY = 'karaoke-school:session'

export const LIT_NETWORK_NAME = 'naga-dev'

// if you actually use this in config, keep it here; otherwise you can remove it
export const LIT_AUTH_SERVICE_URL = 'https://naga-dev-auth-service.getlit.dev'

// Login server URL for social OAuth (Google, Discord)
export const LIT_LOGIN_SERVER_URL = 'https://login.litgateway.com'

// used if you want a default session expiration window
export const LIT_SESSION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000
