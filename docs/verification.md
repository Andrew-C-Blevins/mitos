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
