import "server-only";
import { Pool, types, type PoolClient } from "pg";

// numeric -> JS number (scores like 94.5), bigint -> number (revision counters).
types.setTypeParser(types.builtins.NUMERIC, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(types.builtins.INT8, (v) => (v === null ? null : Number(v)));

declare global {
  var __mofadalatiPool: Pool | undefined;
}

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const useSsl = process.env.DATABASE_SSL === "true" || /sslmode=require/.test(url);
  return new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
}

export function db(): Pool {
  // Reuse one pool across hot reloads in development.
  globalThis.__mofadalatiPool ??= createPool();
  return globalThis.__mofadalatiPool;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
