import NextAuth, { getServerSession, type NextAuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "./db/drizzle";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { users, accounts, sessions, verificationTokens } from "./db/schema.auth";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "crypto";
import { ensureAuthTables } from "./db/init";

const haveDb = !!process.env.DATABASE_URL;

// simple salted sha256 for demo; use argon2/bcrypt/scrypt in production
function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(password + salt).digest("hex");
}

if (haveDb) {
  // Initialize tables on cold start
  ensureAuthTables().catch(() => {});
}

export const authOptions: NextAuthOptions = {
  adapter: haveDb
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!haveDb) return null;
        const db = getDb();
        const email = creds?.email?.toString().toLowerCase();
        const password = creds?.password?.toString();
        if (!email || !password) return null;

        const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
        const user = u[0];
        if (!user?.passwordHash) return null;
        const [salt, stored] = user.passwordHash.split(":");
        const hashed = hashPassword(password, salt);
        if (hashed !== stored) return null;
        return { id: user.id, name: user.name ?? null, email: user.email ?? null } as any;
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_ID ?? "",
      clientSecret: process.env.GITHUB_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user && (user as any).id) token.id = (user as any).id as string;
      return token;
    },
    async session({ session, token }) {
      if (token?.id) (session.user as any).id = token.id as string;
      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}
