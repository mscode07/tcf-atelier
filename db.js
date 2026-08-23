const { createClient } = require("@supabase/supabase-js");

let supabase;

/**
 * Returns the server-side Supabase client.
 *
 * Keep this module in server code only. Never import a service-role key into a
 * client component or prefix it with NEXT_PUBLIC_.
 */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and either " +
      "SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
    );
  }

  if (!supabase) {
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return supabase;
}

module.exports = { getSupabase };
