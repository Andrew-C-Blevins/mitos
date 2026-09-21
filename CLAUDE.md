# Mitos — CLAUDE.md

## Status and stop boundary

The first M1 Item + Everything prototype was reviewed. Andrew approved cloud
setup: the public GitHub repository and push, Firebase and Vercel projects,
preview environment variables, rules/indexes deployment and household/data seed.
This approval does not extend to later feature milestones, AI, custom DNS or
retiring Flask/the tunnel. Andrew also approved the Mitos runtime service account
and key, and granted Vercel GitHub app access. The hosted preview is deployed;
Andrew's Google sign-in and hosted Everything/Item check are pending. Do not
claim that end-to-end check passed until observed or confirmed by Andrew.
The app/package/repo is mitos.

Source: planner-design-brief.md revision 2 (2026-09-21), read in full. Sections
4–6 define the architecture and data; section 8 defines screens; sections 10–11
define mechanics and design. Section 7 is skipped entirely. Item was built first.
No model calls, AI SDK, agent endpoint or MCP server is enabled.

## Hosting and runtime

Hosting: Vercel Hobby project mitos in andrew-c-blevins-projects; GitHub repository
Andrew-C-Blevins/mitos. Firebase project mitos-twelvedegrees has Google sign-in,
Firestore in us-east4, deployed rules/indexes and the reviewed 39-item seed.
Vercel is connected to GitHub. The preview runtime uses a Mitos-only service
account with roles/datastore.user and roles/firebaseauth.viewer. Its private key
is stored in ignored operator files and sensitive FIREBASE_SERVICE_ACCOUNT_JSON.
Verified preview: https://mitos-hqwbm58pe-andrew-c-blevins-projects.vercel.app
(deployment dpl_FycJtEGc8WaggDQ473Yosj5QWfib, code commit 17fa845). Vercel reports
Preview/Ready; HTTP home 200, unauthenticated POST /api/session 401. The exact
hostname is authorized for Firebase Google sign-in. Deployment protection remains
enabled. CI, cloud runtime credential reads and production dependency audit pass.
.firebaserc defaults to demo-mitos; cloud is an explicit separate alias.
.env.local remains local-only; .env.cloud.local holds ignored operator config.
Cloud env is preview-scoped; production is not configured. vercel.json disables
automatic deployments from main until production is approved; other branches
can produce previews. Explicit CLI preview deployments remain available.
The hostname needs review;
do not replace planner.twelvedegrees.studio while the old service still exists.
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

| Package                      | Resolved version |
| ---------------------------- | ---------------- |
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

- app/: root App Router pages, manifest, Apple icon, thin /api/session route.
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
- lib/data/admin/proposals.ts: future AI/agent proposal-only writes.
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
in history. membership comes from households.memberUids, never editable users.

Humans write directly through the client SDK under rules; createdBy/createdAt/
household are immutable, version increments on every item write, and capture/log
records are append-only with the human UID. Inbox Delete cancels to retain history.
AI/agents may eventually create proposals only. Admin item writes are restricted
to reviewed applyProposal transactions; its mutator cannot be imported by API/AI
code. No apply route is exposed yet. CI checks import structure using TypeScript AST.

Private items require ownership and household membership. Household items require
membership. Queries carry both household and visibility constraints. Server routes
verify tokens and the explicit ALLOWED_EMAILS; rules carry the same allowlist.
Local .test emails are emulator-only. The deployment script renders the real env
allowlist into an ignored rules copy, with an explicit approval argument and a
non-demo-project guard. Real account emails do not appear in application source.

The first log preserves original capture forever. Logs load newest 20 and page
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
Local preview data is a real local legacy snapshot: 39 personal tasks (24 active,
15 done), no home tasks. Santa Rosa's 27 tasks and trip schedules are export-only.
Private exports, logs, generated deployment env, emulator data and screenshots
are ignored. A fresh Pi export and human manifest review are still required before
retirement. GitHub CI passed on the published cloud setup checkpoint. Rules deploy
remains an explicit operator action; CI does not deploy rules or seed live data.
