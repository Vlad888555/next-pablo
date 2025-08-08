import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "./db/drizzle";
import GitHub from "next-auth/providers/github";

const haveDb = !!process.env.DATABASE_URL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: haveDb ? DrizzleAdapter(getDb()) : undefined,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
});
