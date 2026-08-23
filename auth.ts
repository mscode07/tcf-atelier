import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { getServerSupabase } from "@/lib/supabase-server";

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

        const supabase = getServerSupabase();
        const { data: existing, error: lookupError } = await supabase
          .from("app_users")
          .select("id,email,password_hash")
          .eq("email", email)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (existing) {
          return await compare(password, existing.password_hash)
            ? { id: existing.id, email: existing.email }
            : null;
        }

        const passwordHash = await hash(password, 12);
        const { data: created, error: createError } = await supabase
          .from("app_users")
          .insert({ email, password_hash: passwordHash })
          .select("id,email")
          .single();
        if (createError) throw createError;
        return { id: created.id, email: created.email };
      },
    }),
  ],
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
});
