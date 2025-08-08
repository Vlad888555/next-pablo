import { getDb } from "./drizzle";
import { sql } from "drizzle-orm";

// Minimal bootstrap for auth tables if they don't exist.
export async function ensureAuthTables() {
  const db = getDb();
  // Users
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" text PRIMARY KEY,
      "name" text,
      "email" text,
      "emailVerified" timestamptz,
      "image" text,
      "password_hash" text
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON "users" ("email");`);

  // Accounts
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "userId" text NOT NULL,
      "type" text NOT NULL,
      "provider" text NOT NULL,
      "providerAccountId" text NOT NULL,
      "refresh_token" text,
      "access_token" text,
      "expires_at" integer,
      "token_type" text,
      "scope" text,
      "id_token" text,
      "session_state" text,
      PRIMARY KEY ("provider", "providerAccountId")
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS accounts_user_idx ON "accounts" ("userId");`);

  // Sessions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "sessionToken" text PRIMARY KEY,
      "userId" text NOT NULL,
      "expires" timestamptz NOT NULL
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON "sessions" ("userId");`);

  // VerificationTokens
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "verificationTokens" (
      "identifier" text NOT NULL,
      "token" text NOT NULL,
      "expires" timestamptz NOT NULL,
      PRIMARY KEY ("identifier", "token")
    );
  `);

  // Authenticators
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "authenticators" (
      "credentialID" text NOT NULL,
      "userId" text NOT NULL,
      "providerAccountId" text NOT NULL,
      "credentialPublicKey" text NOT NULL,
      "counter" integer NOT NULL,
      "credentialDeviceType" text NOT NULL,
      "credentialBackedUp" boolean NOT NULL,
      "transports" text,
      PRIMARY KEY ("userId", "credentialID")
    );
  `);
}
