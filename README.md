# TCF Material

A responsive, interactive prototype for a TCF French-language practice platform.

## Run locally

Install dependencies and run the Next.js app:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Production build and missing styles

Use `npm ci`, `npm run build`, and `npm start` for a production deployment.
The build uses Webpack and checks that generated pages reference existing CSS,
JavaScript, and font files. Deploy the complete build, including `.next/static`,
from the same build as `.next/server`. Never reuse generated `.next` files from
Git or combine output from separate builds.

If the page appears as plain text and `/_next/static/…` requests return 404,
rebuild and redeploy the application in Hostinger, then purge its CDN/page cache.
Verify the stylesheet URL referenced by the newly served homepage returns 200.
The original site design lives in `styles.css`, imported by `app/layout.tsx`.

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

Set `AUTH_URL=https://your-domain.example` in Hostinger to your actual public
site origin. Checkout uses this URL for both success and cancellation redirects
because the hosting proxy can expose an internal address in the request URL.
Production checkout requires a public HTTPS URL. Redeploy after updating the
code and configuration, then start a new checkout session to test the redirects.

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

## Protected learning material

Listening and Reading routes require both authentication and an unexpired paid
package. Protected responses are private and non-cacheable, and include
anti-indexing and same-origin resource headers. Module screens add a moving,
user-specific watermark; disable casual selection, copy, context-menu, dragging,
save, source, and print actions; hide content while printing or when the tab is
hidden; and revalidate access every 30 seconds and whenever the tab is reopened.

These controls deter copying and make leaked captures attributable. A browser
cannot guarantee prevention of operating-system screenshots, screen recording,
developer-tools extraction, or a photograph taken with another device.

To verify a real user's expiry without changing database records, run:

```bash
npm run verify:access-expiry -- user@example.com
```

The command reports the package start and expiry timestamps and performs a
read-only check at one millisecond after expiry. The expected result is `PASS`
with `activeOneMillisecondAfterExpiry: false`.

## Admin workspace

Open `/admin` and enter the configured four-digit passcode. The admin workspace
has its own responsive layout and includes student search and details, timed or
lifetime module access, explicit module blocks, content editing, bulk actions,
JSON/DOCX/searchable-PDF imports, and an activity log. Students still see locked
module cards when they do not have access.

### First local setup

1. Restore `DATABASE_URL` in `.env`. `AUTH_URL` should be `http://localhost:3000`
   locally. Next.js and the database scripts load this file automatically.
2. Run `npm run db:migrate` to apply the schema, including admin content,
   access grants, revisions, and attempt content versions.
3. Run `npm run content:seed` to import the existing library into the
   database. This is idempotent and never replaces existing edited collections.
4. Set `ADMIN_PASSCODE` to four digits and `ADMIN_SESSION_SECRET` to a random
   secret of at least 32 characters in `.env` (and hosting settings on deployment).
   These values stay on the server. No student account or email setup is needed.
5. Start `npm run dev`, open `/admin`, and enter the passcode.

There is no preview mode. The old `/admin/preview` address redirects to `/admin`
and requires the same passcode. All admin pages and data APIs require a signed,
HttpOnly session that expires after eight hours. “Lock panel” signs out. Changing
the passcode invalidates existing sessions. Ten incorrect attempts cause a
15-minute lockout shared across workers on a single server. Multi-server hosting
must use shared storage for the login limiter. Links leaving the admin workspace
open in a new tab. Audit entries use an automatically created internal identity.

The seed includes 40 Reading tests, 40 Listening tests, and the Writing and
Speaking question banks. Listening Tests 5, 9, 24, and 25 each have a missing
answer in the original supplied library (Q3, Q13, Q33, and Q34 respectively).
They are imported as drafts until an admin supplies those answer keys.

### Import formats

The Import materials screen provides a downloadable JSON template for each
module. It accepts `{ "questions": [...] }` for one test and
`{ "tests": [{ "testNumber": 1, "title": "Test 1", "questions": [...] }] }`
for a batch. The existing Writing JSON and the project's Speaking JSON formats
are normalized into the same editable question model.

For DOCX and searchable PDFs, separate tests with `Test 1` and questions with
`Question 1`. Use `A. ...`, `B. ...`, and `Answer: B` for multiple-choice items.
Optional labeled fields are `Passage:`, `Audio: https://...`, `Image: https://...`,
`Explanation:`, `Reference answer:`, `Correction:`, `Task:`, `Category:`,
`Document1:`, and `Document2:`. Unlabeled text continues the previous field.
Upload limits are 10 MB per file, 200 PDF pages, 500 tests per batch, and 1,000
questions per test.

Files are parsed locally by the server, never executed or sent to an AI provider.
Scanned PDFs require OCR before upload. Embedded document media is not extracted;
provide hosted HTTPS media URLs. Empty documents and network-capture JSON files
are rejected without changing existing content. The sample Speaking capture
contains no question array, and the sample Listening DOCX contains only a heading
and question count, so those two samples cannot be used as question imports.

Every import has an editable preview. Choose append or replace for matching test
numbers, and draft or published visibility. Draft imports into existing tests
also unpublish those tests. Other test numbers remain untouched. Content must
pass validation before publishing. Archiving removes a test from the student
library but retains its content. Republish it to restore it.

### Access and change history

Paid packages unlock all modules unless an admin blocks a particular module.
A free grant unlocks only the selected modules for the specified duration (at
least one hour), or indefinitely. A new override replaces previous overrides
for those modules; removing it returns the student to normal paid access.
Suspension blocks all practice access. Each request checks current database
permissions, and the student interface rechecks access every 30 seconds.

Content edits and imports are atomic and retain the previous document version.
Optimistic version checks prevent one admin overwriting another's edits. Test
attempts record the content version; a student must reload when a test changes.
Existing attempt scores remain stored when content is archived or replaced.

Run `npm run test:admin` for policy, parser, migration, revision, and transaction
checks in an isolated in-memory PostgreSQL instance. Run `npm run typecheck` and
`npm run build` for application validation. Live authentication, grants, and
payments should also be checked against the configured development database
before deployment.
