import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { authAccounts, users } from "@/lib/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials.email ?? "").trim().toLowerCase();
        const password = String(credentials.password ?? "");
        if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || password.length > 128) return null;

        const db = getDb();
        const [existing] = await db
          .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing) {
          if (!existing.passwordHash || !await compare(password, existing.passwordHash)) return null;
          const now = new Date();
          await db.update(users)
            .set({ lastLoginAt: now, updatedAt: now })
            .where(eq(users.id, existing.id));
          return { id: existing.id, email: existing.email };
        }

        const passwordHash = await hash(password, 12);
        const [created] = await db.insert(users)
          .values({ email, passwordHash, primaryProvider: "credentials" })
          .returning({ id: users.id, email: users.email });
        return { id: created.id, email: created.email };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.trim().toLowerCase();
      if (!email) return true;

      try {
        const db = getDb();
        const now = new Date();
        const [existing] = await db
          .select({ id: users.id, passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        let userId: string;

        if (existing) {
          userId = existing.id;
          await db.update(users).set({
            googleSub: account.providerAccountId,
            name: user.name ?? null,
            avatarUrl: user.image ?? null,
            primaryProvider: existing.passwordHash ? "credentials+google" : "google",
            updatedAt: now,
            lastLoginAt: now,
          }).where(eq(users.id, existing.id));
        } else {
          const [created] = await db.insert(users).values({
            email,
            googleSub: account.providerAccountId,
            name: user.name ?? null,
            avatarUrl: user.image ?? null,
            primaryProvider: "google",
            updatedAt: now,
            lastLoginAt: now,
          }).returning({ id: users.id });
          userId = created.id;
        }

        await db.insert(authAccounts).values({
          userId,
          provider: "google",
          providerAccountId: account.providerAccountId,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [authAccounts.provider, authAccounts.providerAccountId],
          set: { userId, updatedAt: now },
        });
      } catch (error) {
        // A temporary tracking failure must not lock a valid Google user out.
        console.error("Failed to persist Google user with Drizzle", error);
      }
      return true;
    },
  },
  pages: {
    signIn: "/?auth=signin",
    error: "/?auth=error",
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
});
