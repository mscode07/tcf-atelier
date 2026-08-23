# TCF Atelier

A responsive, interactive prototype for a TCF French-language practice platform.

## Run locally

No install is required. From this folder, run:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Included

- Responsive landing page and three access plans
- Email and Google demo authentication
- Learner dashboard with four practice modules
- Forty-test browser and exam/review mode selection
- Interactive question runner, flags, navigation, progress, and results
- Light/dark themes and local browser persistence

## Production integrations

The current Google and Razorpay actions are intentionally demo adapters. Add a backend and environment variables for production OAuth, payment signature verification, user entitlements, question/audio storage, and durable attempt history.
