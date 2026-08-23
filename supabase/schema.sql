create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.app_users enable row level security;

-- No public policies are intentional. Only server code using the service-role
-- key may read password hashes or create email/password accounts.
