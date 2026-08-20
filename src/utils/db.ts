import { Pool } from 'pg';

declare global {
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;
const maxPoolSize = process.env.DATABASE_POOL_SIZE
  ? parseInt(process.env.DATABASE_POOL_SIZE, 10)
  : (process.env.NODE_ENV === 'production' ? 5 : 15);

if (!globalThis.pgPool) {
  globalThis.pgPool = new Pool({
    connectionString,
    max: maxPoolSize,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

export const db = globalThis.pgPool;
