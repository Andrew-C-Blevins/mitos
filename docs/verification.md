# Local checkpoint verification — 2026-09-21

The local Next production build, lint, strict typecheck, domain tests, emulator
rules tests and Admin item-write import boundary have been exercised. The CI
workflow is authored but has not run on GitHub because no repository was pushed.

Domain suite: readiness, local weekday business hours, DST transitions, seasons
crossing New Year, recurrence advancement, all four date semantics, deterministic
ranking, capture validation, visibility, proposal preconditions and migration.
The rules module has 100% statements, branches, functions and lines in local v8
coverage. This measures exercised code paths, not a proof of correctness.

Rules suite: unauthenticated/non-allowlisted/unverified access; household versus
private access; scoped queries; frozen membership/person identity; credential
denial; immutable creator and capture history; version increments; atomic capture;
array-entry edits; question-to-decision transactions; nesting; nested schema
validation; proposal checkboxes versus authoritative payloads.

Browser checks at 390 × 844: real legacy Everything list and Fireplace trim Item,
capture into Inbox, manual Keep, inline question add, atomic answer-to-decision
with original question context, snooze to collapsed Snoozed, completion, capture
input focus, and no horizontal overflow. These interactions used one clearly
labeled local smoke-test item; it was completed after verification. The 39 legacy
records retain their original imported state (24 active, 15 done).

Export script successfully wrote all 39 authorized imported records and their
logs before the isolated smoke-test item was created. Files are private and ignored.

The UI has been inspected in a phone-sized browser. A physical iPhone review,
iOS gestures, actual Google popup login, cloud indexes, Vercel preview and remote
CI are still pending. Same-Wi-Fi preview uses port 3000; Java is localhost-only.
The production build was also checked through this machine's LAN address. Karen's
local login loads an empty list and cannot read Andrew's private imported items.

No cloud resource, cloud environment variable, rule deployment, GitHub push,
DNS record, tunnel or Flask service was changed. The design checkpoint remains
closed until Andrew reviews the prototype and approves further work.

## Local preview connection follow-up

Desktop review reported interrupted Firestore Listen responses and an unnamed 404. The Next rewrite proxy defaulted to a 30-second timeout, matching the
emulator's idle response interval. Direct HTTP probes observed the emulator
finishing idle responses at 30 seconds even when requesting a 25-second poll.
The local demo proxy now allows 60 seconds. Forced long polling was removed;
the browser uses the SDK's standard streaming transport and automatic fallback.
The proxy setting is gated to emulator mode; Java remains localhost-only.

The app had no browser icon declaration, and `/favicon.ico` returned 404. Its
metadata now explicitly uses the existing `/apple-icon` image, which returns 200.
The original unnamed 404 cannot be identified conclusively from the report.

The updated production build, lint and typecheck pass. A saved title edit on the
existing completed smoke-test item appeared in a separate LAN-origin browser
session without a reload, confirming a server round trip rather than a shared
local browser cache. With the final streaming configuration, both fresh browser
sessions reported no console warnings or errors after 70 seconds idle, and a
reverse-direction edit still synchronized immediately. The test title was
restored. No imported record was edited. This is a bounded local check, not a
long-running network soak test.

The subsequent console report identified `/emulator/auth/iframe` as a 404:
the exact iframe request returned 404 through port 3000 but 200 directly from
the localhost Auth emulator on port 9099. The local-only rewrite now includes
`/emulator/auth/:path*`, covering the SDK's iframe and auth handler. The browser
icon was a separate missing asset, not the cause of this identified auth error.
After rebuilding and restarting, the helper iframe returns 200 with the correct
HTML through both localhost and the LAN preview address. The build, config lint
and formatting checks pass; importing the config without emulator opt-in returns
no emulator rewrites.
