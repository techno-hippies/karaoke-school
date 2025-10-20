import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { sql } from 'drizzle-orm';

// Create PostgreSQL client
const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434'),
  user: process.env.DB_USER || 't42',
  password: process.env.DB_PASSWORD || 'songverse',
  database: process.env.DB_NAME || 'songverse',
});

// Initialize connection
let isConnected = false;
export const initDb = async () => {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
  }
};

// Create Drizzle instance (no schema needed for raw SQL)
export const db = drizzle(client);

// Export sql for raw queries
export { sql };

// Utility function to close database connections
export const closeDb = async () => {
  if (isConnected) {
    await client.end();
    isConnected = false;
  }
};