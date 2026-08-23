import { createClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      app_users: {
        Row: { id: string; email: string; password_hash: string; created_at: string };
        Insert: { id?: string; email: string; password_hash: string; created_at?: string };
        Update: { email?: string; password_hash?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: ReturnType<typeof createClient<Database>> | undefined;

export function getServerSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Email authentication requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  client ??= createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
