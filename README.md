# TCF Atelier

A responsive, interactive prototype for a TCF French-language practice platform.

## Run locally

Install dependencies and run the Next.js app:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

For Google sign-in, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a long
random `AUTH_SECRET` in `.env.local`. In Google Cloud Console, add
`http://localhost:3000/api/auth/google/callback` as an authorized redirect URI
(and add the matching HTTPS callback URI for production).

## Supabase

Add `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` (server-only) or
`SUPABASE_ANON_KEY` to Hostinger's environment variables. Do not add the
`NEXT_PUBLIC_` prefix to a service-role key.

Use the shared server client from `db.js` in route handlers or other server code:

```js
const { getSupabase } = require("./db");

const { data, error } = await getSupabase().from("your_table").select("*");
if (error) throw error;
```

Replace `your_table` with the exact table name from Supabase. Environment
variables must also be configured in Hostinger; the local `.env` file is not
automatically uploaded to a deployment.

After deployment, open `/api/database/health` on your website. A working
connection returns `{ "ok": true, "database": "connected" }`. The diagnostic
response identifies missing variables or a rejected key without exposing any
secret values.

## Included

- Responsive landing page and three access plans
- Email prototype login and real Google OAuth authentication
- Learner dashboard with four practice modules
- Forty-test browser and exam/review mode selection
- Interactive question runner, flags, navigation, progress, and results
- Light/dark themes and local browser persistence

## Production integrations

The email and Razorpay actions remain demo adapters. Add persistent user storage, payment signature verification, user entitlements, question/audio storage, and durable attempt history for production.
