import { readFile, writeFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const snapshot = JSON.parse(await readFile('docs/registry-versions.json', 'utf8'));
snapshot.selectedVersions = { ...pkg.dependencies, ...pkg.devDependencies };
snapshot.compatibilityNotes = [
  'ESLint 9.39.5 is the newest npm-registry ESLint 9; Next lint plugins reject ESLint 10.',
  'TypeScript 6.0.3 is the newest stable registry version below typescript-eslint’s <6.1 constraint.',
  '@types/node 24.13.6 matches the Node 24 runtime instead of using Node 26 types.',
  'npm install resolved the exact package-lock.json; npm ls confirms installed versions.',
];
await writeFile('docs/registry-versions.json', JSON.stringify(snapshot, null, 2) + '\n');
const documentation = `# Mitos — CLAUDE.md

## Status and stop boundary

M0 local scaffold and the first M1 Item + Everything prototype. Andrew explicitly
requires approval before ANY account-side or external mutation: creating Firebase,
Vercel or GitHub projects; pushing; deploying rules/indexes; changing cloud env;
or retiring Flask/the tunnel. None has been performed. Do not continue past the
phone design checkpoint without Andrew's approval. The app/package/repo is mitos.

Source: planner-design-brief.md revision 2 (2026-09-21), read in full. Sections
4–6 define the architecture and data; section 8 defines screens; sections 10–11
define mechanics and design. Section 7 is skipped entirely. Item was built first.
No model calls, AI SDK, agent endpoint or MCP server is enabled.

## Hosting and runtime

Intended hosting: Vercel Hobby, GitHub-linked, Firebase Auth + Firestore in a
dedicated project. Cloud configuration is not provisioned. .firebaserc selects
demo-mitos for the local emulator only. The eventual hostname needs review;
do not replace planner.twelvedegrees.studio while the old service still exists.
Node 24 is the tested runtime (local 24.14.0); npm 11.11.0; portable Java 21 is used
for the local Firestore emulator. No system-wide Java install. Emulator services
bind to 127.0.0.1; Next proxies browser requests for same-Wi-Fi phone checks.

## Resolved versions

Read directly from the npm registry on ${snapshot.resolvedAt.slice(0, 10)}; exact
pins and the lockfile are authoritative. Newest-compatible, not blindly newest:
ESLint 9 and TypeScript 6 satisfy Next's transitive lint-plugin peer constraints.
Registry evidence and initial latest metadata: docs/registry-versions.json.

| Package | Resolved version |
| --- | --- |
${Object.entries(snapshot.selectedVersions)
  .map(([name, version]) => `| ${name} | ${version} |`)
  .join('\n')}

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
- scripts/: local-only seed, read-only legacy export, authorized personal export,
  guarded future deploy, emulator launcher and CI boundary checks.
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
retirement. Nothing is automatically pushed or deployed.
`;
await writeFile('CLAUDE.md', documentation);
