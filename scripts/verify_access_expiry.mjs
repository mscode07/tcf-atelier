import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  console.error("Usage: npm run verify:access-expiry -- user@example.com");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [subscription] = await sql`
    select us.id, us.status, us.starts_at, us.expires_at, pp.code, pp.duration_days
    from app_users u
    join user_subscriptions us on us.user_id = u.id
    join pricing_plans pp on pp.id = us.plan_id
    where lower(u.email) = ${email} and us.status = 'active'
    order by us.expires_at desc
    limit 1
  `;

  if (!subscription) {
    console.log(JSON.stringify({ email, activeNow: false, reason: "No active subscription record." }, null, 2));
    process.exitCode = 2;
  } else {
    const expiresAt = new Date(subscription.expires_at);
    const simulatedAfterExpiry = new Date(expiresAt.getTime() + 1);
    const [check] = await sql`
      select exists(
        select 1 from user_subscriptions
        where id = ${subscription.id}
          and status = 'active'
          and expires_at > ${simulatedAfterExpiry}
      ) as active
    `;
    console.log(JSON.stringify({
      email,
      package: subscription.code,
      durationDays: subscription.duration_days,
      startsAt: subscription.starts_at,
      expiresAt: subscription.expires_at,
      activeNow: expiresAt > new Date(),
      activeOneMillisecondAfterExpiry: check.active,
      result: check.active ? "FAIL" : "PASS",
      note: "Read-only simulation; no subscription data was changed.",
    }, null, 2));
    if (check.active) process.exitCode = 3;
  }
} finally {
  await sql.end();
}
