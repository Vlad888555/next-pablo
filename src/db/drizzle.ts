import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

// Export a lazy getter to avoid throwing when DB is optional.
export function getDb() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Define it in your environment if DB is required.");
  }
  const sql = neon(connectionString);
  return drizzle({ client: sql });
}

// Backwards-compatible named export that throws if used without env
export const db = (() => {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Define it in your environment if DB is required.");
  }
  const sql = neon(connectionString);
  return drizzle({ client: sql });
})();
