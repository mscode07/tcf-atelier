# Disposable-email blocklist

Bundled from https://github.com/disposable-email-domains/disposable-email-domains
(`disposable_email_blocklist.conf`, fetched 2026-09-22). License: CC0; see LICENSE.txt.
Used only on the server. Sign-up does not contact any external email screening service.

To refresh, download the upstream `disposable_email_blocklist.conf`, split into lines,
trim and lowercase, discard empty/comment lines, deduplicate, sort, and save as the JSON
string array `disposable-domains.json`. Run `npm run test:auth` and review the diff.
Check periodically for new domains and upstream removals to avoid stale blocks.
