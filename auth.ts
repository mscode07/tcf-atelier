import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { validateSignupEmail } from "@/lib/auth/email-policy";
import { authenticatePassword } from "@/lib/auth/password";
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
        const result = await authenticatePassword(
          credentials.email,
          credentials.password,
        );
        return result;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = user.email?.trim().toLowerCase();
      if (!email || profile?.email_verified !== true) return false;

      try {
        validateSignupEmail(email);
        const db = getDb();
        const now = new Date();
        const [existing] = await db
          .select({
            id: users.id,
            passwordHash: users.passwordHash,
            emailVerifiedAt: users.emailVerifiedAt,
            status: users.status,
          })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        let userId: string;

        if (existing) {
          if (existing.status !== "active") return false;
          userId = existing.id;
          await db
            .update(users)
            .set({
              googleSub: account.providerAccountId,
              emailVerifiedAt: now,
              // Do not retain an unverified password when Google proves inbox ownership.
              passwordHash: existing.emailVerifiedAt
                ? existing.passwordHash
                : null,
              name: user.name ?? null,
              avatarUrl: user.image ?? null,
              primaryProvider:
                existing.passwordHash && existing.emailVerifiedAt
                  ? "credentials+google"
                  : "google",
              updatedAt: now,
              lastLoginAt: now,
            })
            .where(eq(users.id, existing.id));
        } else {
          const [created] = await db
            .insert(users)
            .values({
              email,
              googleSub: account.providerAccountId,
              emailVerifiedAt: now,
              name: user.name ?? null,
              avatarUrl: user.image ?? null,
              primaryProvider: "google",
              updatedAt: now,
              lastLoginAt: now,
            })
            .returning({ id: users.id });
          userId = created.id;
        }

        await db
          .insert(authAccounts)
          .values({
            userId,
            provider: "google",
            providerAccountId: account.providerAccountId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [authAccounts.provider, authAccounts.providerAccountId],
            set: { userId, updatedAt: now },
          });
      } catch (error) {
        // Fail closed when account status cannot be checked.
        console.error("Failed to persist Google user with Drizzle", error);
        return false;
      }
      return true;
    },
  },
  pages: {
    signIn: "/?auth=signin",
    error: "/?auth=error",
  },
  secret:
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
});
