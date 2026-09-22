# Mitos — CLAUDE.md

## Status and stop boundary

The next September 22 refinement consolidates dates, snoozing, visibility and
assignment on Item, removes the ellipsis/long-press modal, and replaces the Move
dropdown with reusable drag-handle sorting. See docs/reordering-follow-up.md for
verification/release status and components/ui/sortable-list/README.md for reuse.
Later feature milestones remain paused.

September 22 deletion follow-up is live with its footer refinement from app commit
eb58ce2. Delete sits at the bottom of Item and the actions menu alongside Done;
the confirmation explains nested to-dos only when present. Permanent deletion from Item,
Everything actions and Inbox. It removes item/log/proposal data atomically and
detaches separate sub-items without deleting them. Step edits/deletes render the
confirmed transaction result immediately; confirmed to-do deletion updates cached
lists immediately. See docs/deletion-follow-up.md for validation and release status.

September 22 feedback round is live from app commit 79c5338, with its Firebase
rules/indexes deployed. Andrew is the admin and Karen a user; membership is
preserved. Multiple admins are supported and at least one must remain active.
The separately approved private 20-step import was applied and verified, with
the original capture and full source preserved. Receipts and source are in ignored
exports/; never commit personal claim material. See docs/feedback-round-1.md.

Andrew explicitly clarified that future Mitos requests to commit and push include
authorization and expectation of a live release. Follow AGENTS.md: deploy and
verify production as part of the request, without an extra routine approval.

The first M1 Item + Everything prototype was reviewed. Andrew approved cloud
setup: the public GitHub repository and push, Firebase and Vercel projects,
preview environment variables, rules/indexes deployment and household/data seed.
This approval does not extend to later feature milestones, AI or
retiring Flask/the tunnel. Andrew also approved the Mitos runtime service account
and key, and granted Vercel GitHub app access. The hosted preview is deployed.
On 2026-09-21 Andrew confirmed all 24 active items are visible and tapping them
opens the correct item details. Google provider sign-in and creation of Andrew's
household profile were independently verified. The hosted checkpoint passed.
Andrew then approved the desktop list/detail split and Settings (household people,
personal default context and Export data). These are implemented, verified on
desktop and phone, and deployed to the updated preview. M2 and later features
remain paused. Andrew chose the refined Garden direction: muted green, Fraunces
headings, circular controls and soft bronze threads. The header is Mitos with a
small trailing thread to its right, with no household label or leading symbol.
Andrew requested implementation, commit and push of this direction. It is now
applied across Everything, Item, capture, Settings and sign-in. Existing content
order and item behavior are preserved. See docs/design-direction.md.
Andrew then explicitly approved launching at mitos.twelvedegrees.studio,
including production env/deployment, Cloudflare DNS, and Firebase Google sign-in
authorization for the custom domain and the latest preview hostname.
The app/package/repo is mitos.

Source: planner-design-brief.md revision 2 (2026-09-21), read in full. Sections
4–6 define the architecture and data; section 8 defines screens; sections 10–11
define mechanics and design. Section 7 is skipped entirely. Item was built first.
No model calls, AI SDK, agent endpoint or MCP server is enabled.

## Hosting and runtime

Hosting: Vercel Hobby project mitos in andrew-c-blevins-projects; GitHub repository
Andrew-C-Blevins/mitos. Firebase project mitos-twelvedegrees has Google sign-in,
Firestore in us-east4, deployed rules/indexes and the reviewed 39-item seed.
Vercel is connected to GitHub. Production and preview use a Mitos-only service
account with roles/datastore.user and roles/firebaseauth.viewer. Its private key
is stored in ignored operator files and sensitive FIREBASE_SERVICE_ACCOUNT_JSON.
Production: https://mitos.twelvedegrees.studio
(deployment dpl_HFGT6cEUtR5RvPK5hyiruoLMEWkZ, app source eb58ce2).
Vercel reports Production/Ready. Ten production variables are configured;
the runtime credential and account allowlist variables are sensitive. Production
uses the existing Firebase data; no reseed or schema change occurred at launch.
Cloudflare CNAME mitos points to 02909cac497db2a4.vercel-dns-017.com, DNS only,
TTL Auto. Vercel reports misconfigured=false. Both Google and Cloudflare DNS-over-
HTTPS resolve the new CNAME. HTTPS certificate validation and custom-host checks
pass: home/manifest/icon/CSS 200, correct fonts and bronze palette, session/export
401 without a valid token. A temporary local DNS cache delay cleared; the same
checks now pass through normal DNS, and the production page opens in the browser.
No certificate or security checks were disabled.

September 22 checks: custom-host Settings/home/manifest/icon/CSS return 200;
session/export and the new people PATCH route return 401 without authentication.
The bounded error-log query for this deployment returned no errors. Signed-in
browser verification stopped at Google sign-in/browser control; the same UI and
mutation flow passed emulator testing. GitHub CI passed for 79c5338 (run
35782703656). The release made no changes to DNS or cloud environment variables.

Latest design preview: https://mitos-k5rp6nh37-andrew-c-blevins-projects.vercel.app
(deployment dpl_HFNkJHtSgvecqACw9C6XDPYJVK8R, app source 548a850). Vercel reports
Preview/Ready; HTTP home 200, unauthenticated POST /api/session 401. GitHub CI passed
for 548a850 (run 35680033480). Both this preview and the custom production hostname
are now authorized for Firebase Google sign-in. The earlier automatic-review block
was resolved by Andrew's explicit launch approval, and the applied allowlist was
read back successfully. The previous preview remains
https://mitos-k7rdd9us8-andrew-c-blevins-projects.vercel.app (old design).
Preview deployment protection remains enabled. Production serves the Mitos
sign-in page publicly; item data remains protected by Firebase authentication,
the account allowlist and Firestore rules. A read-only cloud export check at
launch confirms 39 authorized items, 24 active, full histories and three people.
The production dependency audit passed at the preceding checkpoint.
.firebaserc defaults to demo-mitos; cloud is an explicit separate alias.
.env.local remains local-only; .env.cloud.local holds ignored operator config.
Cloud env is configured for preview and production. vercel.json continues to
disable automatic deployments from main; production releases remain explicit
CLI actions. Other branches can produce previews. Do not replace or retire
planner.twelvedegrees.studio without the separate migration/retirement approval.
Node 24 is the tested runtime (local 24.14.0); npm 11.11.0; portable Java 21 is used
for the local Firestore emulator. No system-wide Java install. Emulator services
bind to 127.0.0.1; Next proxies browser requests for same-Wi-Fi phone checks.

## Resolved versions

Read directly from the npm registry on 2026-09-21; exact
pins and the lockfile are authoritative. Newest-compatible, not blindly newest:
ESLint 9 and TypeScript 6 satisfy Next's transitive lint-plugin peer constraints.
Firebase Admin 13.10.0 is the newest compatible 13.x release, rechecked in npm
on 2026-09-21. Admin 14.4.0 crashes on Vercel through jwks-rsa 4 requiring jose 6
when require(ESM) is disabled. CI reproduces that runtime setting explicitly.
Within Firebase Admin only, uuid is pinned to registry-verified **11.1.1** to
include the buffer-bounds security fix while retaining CommonJS support.
Registry evidence and initial latest metadata: docs/registry-versions.json.

The three @dnd-kit packages below were queried from the npm registry on
2026-09-22: 0.5.0 is the current stable version; its React 18/19 peer range
supports installed React 19.3.0. Exact versions are pinned in the lockfile.

| Package                      | Resolved version |
| ---------------------------- | ---------------- |
| @dnd-kit/react               | 0.5.0            |
| @dnd-kit/dom                 | 0.5.0            |
| @dnd-kit/abstract            | 0.5.0            |
| @js-temporal/polyfill        | 0.5.1            |
| firebase                     | 12.19.0          |
| firebase-admin               | 13.10.0          |
| fractional-indexing          | 4.0.0            |
| lucide-react                 | 1.47.0           |
| next                         | 16.3.5           |
| react                        | 19.3.0           |
| react-dom                    | 19.3.0           |
| rrule                        | 2.8.1            |
| server-only                  | 0.0.1            |
| zod                          | 4.6.5            |
| @firebase/rules-unit-testing | 5.0.2            |
| @playwright/test             | 1.63.0           |
| @tailwindcss/postcss         | 4.3.3            |
| @types/node                  | 24.13.6          |
| @types/react                 | 19.3.0           |
| @types/react-dom             | 19.3.0           |
| @vitest/coverage-v8          | 5.0.1            |
| eslint                       | 9.39.5           |
| eslint-config-next           | 16.3.5           |
| firebase-tools               | 15.30.2          |
| prettier                     | 3.9.8            |
| tailwindcss                  | 4.3.3            |
| tsx                          | 4.23.15          |
| typescript                   | 6.0.3            |
| vitest                       | 5.0.1            |

## File map

- app/: root App Router pages, Settings, manifest, Apple icon, thin session/export routes.
- components/planner-workspace.tsx: persistent list and selected item at desktop
  widths of 1200px and above; phone retains separate list/item views.
- components/settings-screen.tsx: archive/restore people, save default context,
  download authenticated versioned JSON. Token/Shortcut setup stays deferred.
- components/item-screen.tsx: living document, inline adds and log pagination.
- components/everything-screen.tsx: master ledger, filters, gestures and Inbox.
- components/auth-provider.tsx: Google popup in production, explicit local login
  only with demo-mitos + emulator flag; user provisioning on first sign-in.
- lib/types.ts: fixed category/context enums, strict schema and durable records.
- lib/domain/items.ts: validation, visibility, capture shaping, pure apply export.
- lib/domain/proposals.ts: change classes, per-path preconditions, staleness.
- lib/domain/rules.ts: local dates, readiness, recurrence and deterministic ranking.
- lib/data/client/: Firebase browser reads and human writes; persistent cache on
  secure origins; per-field updates and array transforms, no whole-item replacement.
- lib/data/admin/items.ts: authorized getItem/listItems and applyProposal only.
- lib/data/admin/delete-item.ts: narrowly allowed human DELETE route; current
  membership/ownership, version confirmation, atomic item/log/proposal deletion.
- lib/data/admin/export.ts: authorized items with full histories, own profile,
  household and people; no credentials or another person's private items.
- lib/data/admin/proposals.ts: future AI/agent proposal-only writes.
- lib/data/admin/people.ts: authenticated profile/member transactions, active-admin
  retention, unique colors and membership revocation; no item writes.
- lib/data/codec.ts: Firestore timestamps to ISO instants at the domain boundary;
  calendar dates stay YYYY-MM-DD in the viewer's local timezone.
- lib/auth/: verified-ID-token allowlist, credential hash checks and user provisioning.
- lib/ai/ and app/api/mcp/: deferred-milestone documentation, no callable endpoint.
- firestore.rules + scripts/generate-rules.mjs: default-deny schema/ACL rules;
  generator keeps all bounded proposal checkbox comparisons explicit.
- scripts/: isolated local seed, guarded cloud seed, read-only legacy export,
  authorized personal export, guarded rules deploy and CI boundary checks.
- tests/: domain/migration and real Firestore emulator authorization tests.
- .github/workflows/ci.yml: lint, typecheck, test coverage, rules, build, import gate.

## Data and security invariants

Collections: households, people, users, items, items/{id}/log, proposals,
credentials. Storage is unused. Blevins has Andrew and Karen active with login
UIDs; Diana is archived with no UID. Users are logins; people are durable people.
No Owen or Campbell records are created. Credentials have no client access and
no document exists until a token is actually created; no empty collection needs
provisioning in Firestore. Archived people are absent from pickers but retained
in history. Membership comes from households.memberUids, never editable users.
The live release uses households.adminUids for household roles. No admin role
grants access to someone else's private items. Person writes are denied to clients;
PATCH /api/people/[id] validates the verified viewer and current household inside
the transaction. Everyone may change only their own color; management requires an
admin. All household people are read transactionally to guard concurrent color and
last-admin changes. Archiving a login removes memberUids/adminUids; restoring grants
membership as a user. Only unused archived records without logins can be deleted.

Humans write directly through the client SDK under rules; createdBy/createdAt/
household are immutable, version increments on every item write, and capture/log
records are append-only with the human UID while the item exists. Confirmed Delete
permanently removes the item, every log entry and its target proposals, with no
tombstone or deletion log. Separate sub-items lose parentId and remain editable.
The server rechecks household membership, item visibility and the confirmed version.
Original capture accepts up to 50,000 characters without truncation. The short
title is derived from its first line; normal notes remain capped at 4,000.
AI/agents may eventually create proposals only. Admin item writes use reviewed
applyProposal transactions, plus the explicit human DELETE adapter. The latter is
importable only by app/api/items/[id]/route.ts; neither mutation is importable by
AI/agent code. No apply route is exposed yet. CI checks imports using TypeScript AST.

Private items require ownership and household membership. Household items require
membership. Queries carry both household and visibility constraints. Server routes
verify tokens and the explicit ALLOWED_EMAILS; rules carry the same allowlist.
Local .test emails are emulator-only. The deployment script renders the real env
allowlist into an ignored rules copy, with an explicit approval argument and a
non-demo-project guard. Real account emails do not appear in application source.

The first log preserves original capture until explicit permanent deletion. Logs load newest 20 and page
back. Small sections are arrays with stable ids. Firestore cannot edit a nested
array object by field path: existing-entry edits use an online transaction with
arrayRemove/arrayUnion and a precondition, never a stale whole-array overwrite.
One row per section may change per human operation; schema caps sections at 40.
Owners/contexts are scalar list fields. New-item proposal read ACLs are unspecified
in the brief, so new-item proposals fail closed pending M3 design.

Proposal classes: commutative stable-id additions; conditional equality at the
changed path; status transitions with recurrence effects. An unrelated edit does
not stale a change. Low confidence defaults unchecked. No AI guard is needed until
AI exists; before enabling paid routes implement authentication, size and token
caps, one in-flight request per user, daily Firestore ceilings and usage logging.

## Derived behavior

Active, unsnoozed items become Ready only if available, in season, with all needs
satisfied, within local weekday 9–5 when required, and matching the selected
context. Ready query is deterministic, returns up to eight and never calls a model.
Effort thresholds: under 20 quick; under 90 quick/sitting; otherwise any. Sort by
due within seven days, requested focus fit, effort, target, fractional sortKey.
Sort keys use code-point order. Due wins display and alone can be overdue/red.
Targets and available dates use ~month. Snoozed items remain collapsed in Everything.

Recurring completion keeps the same item active; calendar RRULE or local-date
completion interval determines the next date, clamped to the season. Both
availableFrom and targetDate advance; dueDate is preserved. Log records every
completion. Pure tests cover DST, cross-year seasons, local business hours and
date/effort boundaries. rrule's CommonJS distribution is imported explicitly to
keep Node ESM scripts and Next bundler behavior consistent.

## Development and validation

See README.md for setup, commands and export. No service worker or custom offline
queue. Test tiers: B. Run npm run check plus npm run test:coverage and rules tests.
Desktop and Settings validation: 28 domain/route tests and 14 emulator rules tests
pass; date/rules coverage remains 100%. Browser checks cover 1440px desktop and
390px phone, persisted default context and export download. Export privacy checks
return no Andrew-private items for Karen; the cloud export reader returns all 39
imported records with full histories. No cloud data is changed by these checks.
Local preview data is a real local legacy snapshot: 39 personal tasks (24 active,
15 done), no home tasks. Santa Rosa's 27 tasks and trip schedules are export-only.
Private exports, logs, generated deployment env, emulator data and screenshots
are ignored. A fresh Pi export and human manifest review are still required before
retirement. GitHub CI passed on the published cloud setup checkpoint. Rules deploy
remains an explicit operator action; CI does not deploy rules or seed live data.
