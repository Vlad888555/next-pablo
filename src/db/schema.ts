import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

// Minimal custom tables can be added here in the future if needed.
// Auth.js tables will be sourced from @auth/drizzle-adapter default schema via adapter.

// Example of simple table for future app data:
export const exampleTable = pgTable("example", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});
