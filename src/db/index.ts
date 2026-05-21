import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForPool = globalThis as unknown as { pgPool?: pg.Pool };

/** Supabase needs explicit parsed credentials — sslmode in URL conflicts with pg's ssl option. */
function buildPoolConfig(): pg.PoolConfig {
  const cs = connectionString!;
  const base = {
    max: Math.min(20, Number(process.env.PGPOOL_MAX ?? 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  };
  if (!cs.includes("supabase.co")) {
    return { connectionString: cs, ...base };
  }
  const u = new URL(cs.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
  return {
    host: u.hostname,
    port: Number(u.port || 5432),
    user: decodeURIComponent(u.username || "postgres"),
    password: decodeURIComponent(u.password || ""),
    database: u.pathname.replace(/^\//, "") || "postgres",
    ssl: { rejectUnauthorized: false },
    ...base,
  };
}

function createPool() {
  return new pg.Pool(buildPoolConfig());
}

if (!globalForPool.pgPool) {
  globalForPool.pgPool = createPool();
}

export const pool = globalForPool.pgPool;
export const db = drizzle(pool, { schema });
