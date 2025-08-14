import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Export a lazy getter to avoid throwing when DB is optional and to resolve env at call time
export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Define it in your environment if DB is required.");
  }
  const sql = neon(connectionString);
  return drizzle({ client: sql });
}

// Optional db export that does NOT throw at import time
export const db = process.env.DATABASE_URL
  ? drizzle({ client: neon(process.env.DATABASE_URL) })
  : undefined;
