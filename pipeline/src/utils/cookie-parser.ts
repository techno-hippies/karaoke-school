/**
 * Utilities for working with Netscape cookie files (e.g. Chrome/Playwright exports).
 */

export interface ParsedCookie {
  domain: string;
  includeSubdomains: boolean;
  path: string;
  secure: boolean;
  expiration: number;
  name: string;
  value: string;
}

/**
 * Parse Netscape cookie file content into structured cookies.
 */
export function parseCookieFile(content: string): ParsedCookie[] {
  const cookies: ParsedCookie[] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      continue;
    }

    const parts = line.split('\t');
    if (parts.length < 7) {
      continue;
    }

    const [domain, includeSubdomains, path, secure, expiration, name, value] = parts;

    cookies.push({
      domain: domain.trim(),
      includeSubdomains: includeSubdomains.trim().toUpperCase() === 'TRUE',
      path: path.trim() || '/',
      secure: secure.trim().toUpperCase() === 'TRUE',
      expiration: Number(expiration.trim()) || 0,
      name: name.trim(),
      value: value.trim(),
    });
  }

  return cookies;
}

/**
 * Build a Cookie header string from parsed cookies.
 */
export function buildCookieHeader(cookies: ParsedCookie[]): string {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

/**
 * Convert parsed cookies into a shape Playwright understands.
 */
export function toPlaywrightCookies(cookies: ParsedCookie[]): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly: boolean;
  secure: boolean;
}> {
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: normalizeDomain(cookie.domain),
    path: cookie.path || '/',
    expires: cookie.expiration > 0 ? cookie.expiration : undefined,
    httpOnly: false,
    secure: cookie.secure,
  }));
}

function normalizeDomain(domain: string): string {
  return domain.startsWith('.') ? domain.slice(1) : domain;
}
