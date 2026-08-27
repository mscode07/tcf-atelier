# TCF Material

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
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI
(and add the matching HTTPS callback URI for production).

## Supabase

Copy the Supabase PostgreSQL transaction-pooler URI into `DATABASE_URL` locally
and in Hostinger. Replace the password placeholder in the URI with the Supabase
database password, then run `npm run db:migrate`. Drizzle schemas live in
`lib/db/schema.ts`; generated SQL migrations live in `drizzle/`. Local `.env`
files are not automatically uploaded to Hostinger.

After deployment, open `/api/database/health` on your website. A working
connection returns `{ "ok": true, "database": "connected", "orm": "drizzle" }`.
The diagnostic response identifies a missing connection string or schema
without exposing any secret values.

### Email accounts

The email form uses Auth.js credentials: a new email creates an account, and an
existing email signs in after checking its bcrypt password hash. All reads and
writes go through Drizzle over the server-only `DATABASE_URL`.

Google sign-ins are upserted into `app_users` and linked in `auth_accounts`.
Each successful login stores the normalized email, Google subject ID, name,
avatar, provider, and login timestamps. Existing email accounts are linked by
email without replacing their password hash.

## Included

- Responsive landing page and three access plans
- Email prototype login and real Google OAuth authentication
- Learner dashboard with four practice modules
- Forty supplied 39-question audio tests mapped to Listening Tests 1–40
- Forty interactive 39-question Reading tests with selectable answers, checking, progress, and results
- Forty-test browser and exam/review mode selection
- Interactive question runner, flags, navigation, progress, and results
- Consistent light theme

## Stripe payments

Set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, and the three `STRIPE_PRICE_*` IDs. In Stripe, point a
webhook endpoint at `https://your-domain.example/api/stripe/webhook` and subscribe
to `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, and `checkout.session.expired`.

Checkout includes Apple Pay when the customer and device are eligible.
International card acceptance follows the currencies and payment methods enabled
for the Stripe account.

The three one-time Stripe Prices must be configured as USD $10 for 7 days,
USD $25 for 30 days, and USD $40 for 60 days. Checkout and fulfillment reject
any Price whose amount, currency, or access duration does not match the package.
Module access is checked server-side on every protected request and expires at
the exact purchased duration measured from the successful payment timestamp.
