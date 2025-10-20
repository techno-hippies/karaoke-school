/**
 * Logger utilities for pipeline output
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

export const logger = {
  info: (message: string) => {
    console.log(`${colors.blue}ℹ${colors.reset}  ${message}`);
  },

  success: (message: string) => {
    console.log(`${colors.green}✓${colors.reset}  ${message}`);
  },

  error: (message: string) => {
    console.error(`${colors.red}✗${colors.reset}  ${message}`);
  },

  warn: (message: string) => {
    console.warn(`${colors.yellow}⚠${colors.reset}  ${message}`);
  },

  step: (num: number, message: string) => {
    console.log(`\n${colors.cyan}▶  Step ${num}: ${message}${colors.reset}`);
  },

  section: (title: string) => {
    console.log(`\n${colors.bright}${colors.magenta}═══ ${title} ═══${colors.reset}\n`);
  },

  header: (title: string) => {
    const border = '═'.repeat(title.length + 4);
    console.log(`\n${colors.bright}${colors.blue}╔${border}╗${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}║  ${title}  ║${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}╚${border}╝${colors.reset}\n`);
  },

  progress: (current: number, total: number, message: string) => {
    const percent = Math.round((current / total) * 100);
    console.log(`${colors.dim}[${current}/${total}] ${percent}%${colors.reset} ${message}`);
  },

  detail: (key: string, value: string) => {
    console.log(`${colors.dim}   ${key}:${colors.reset} ${value}`);
  },

  json: (data: any) => {
    console.log(JSON.stringify(data, null, 2));
  },
};
