import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema-pg/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://t42:devpass@localhost:5434/songverse',
  },
  verbose: true,
  strict: true,
});