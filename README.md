# Mitos

[Open Mitos](https://mitos.twelvedegrees.studio) — sign in with your approved Google account.

A phone-first household action ledger, built from `planner-design-brief.md`
revision 2. The first **Item + Everything design check** was reviewed; the
approved production app is live, with later feature milestones still deferred.
The source planner has not been changed or retired.

The September 22 feedback fixes described below are live in production. See
[the feedback release notes](docs/feedback-round-1.md).

## Run the local prototype

Requires Node 24 and Java 21 for the Firestore emulator. Java can be portable;
on this machine it is in the ignored `.tools/java` directory.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run emulators
```

In another terminal, export the legacy snapshot (Python 3), seed, then start Next:

```powershell
python scripts/export-legacy.py --source C:\Users\Andrew\apps\planner_app
npm run seed:local
npm run dev
```

Open http://localhost:3000 and choose Andrew or Karen. These are isolated local
test logins, not Google accounts. Andrew has the imported private personal list;
Karen cannot read it. Home-projects has no tasks in the source snapshot.
The seed is idempotent, preserves existing edits and creates exactly one Blevins
household, Andrew and Karen active with emulator Auth UIDs, and Diana archived
without a UID. `users` is created on first sign-in. No credentials are issued.

For a phone on the same Wi-Fi, use `http://<this-computer-LAN-IP>:3000`.
Use `npm run build` followed by `npm start` for phone review; Next's development
server restricts requests from additional origins by default.
The Auth and Firestore emulators listen only on localhost; Next proxies their
client requests. Java does not need an inbound firewall exception. No tunnel or
cloud deployment is involved. The local proxy allows 60 seconds of inactivity,
leaving room for the emulator's 30-second idle responses. The client uses the
Firebase SDK's standard streaming transport and automatic long-polling fallback.
LAN HTTP uses in-memory Firestore caching because
it is not a secure browser context; durable offline persistence is enabled on
localhost and HTTPS deployments. No service worker is installed.

The emulator is not a production security boundary; run the local preview only
on your own trusted network. Stopping the emulators through the npm wrapper
exports their current state to ignored `.emulator-data`; the next run restores it.

## Implemented at this checkpoint

- Firebase client writes, offline capture up to 50,000 characters, field updates
  and real-time reads. Capture keeps the full source and derives a short title.
- Item, built first: inline editing and adds, all specified content sections,
  questions-to-decisions, settings disclosure, recurrence, newest 20 log entries
  with older paging, permanent original capture.
- Everything: manual ordering, Mine/Household/Karen/All and category/Waiting/
  Recurring filters, nested display, long-press actions, swipe complete/snooze,
  explicit Move before/Bottom controls, full category labels, collapsed Snoozed,
  manual Inbox with aligned touch targets.
- Pure readiness, date, recurrence, ranking and proposal-precondition functions.
- Default-deny rules, indexes, client/admin separation, allowlist checks, auth and
  integration-token helpers, guarded Admin proposal application, export script.
- Manifest, Apple icon, system light/dark theme, CI workflow.
- Desktop list/detail workspace at 1200px and above; separate screens on phone.
- Settings: household admin/user roles, unique personal colors, archived people
  hidden by default, visible save feedback, close controls and JSON export.
- Refined Garden styling: Fraunces headings, DM Sans text, muted green surfaces,
  soft bronze threads and the Mitos wordmark with its trailing thread.

Ready, Due, Review, AI, Shortcut, handoff and MCP screens/routes are not
enabled. Their later milestones require approval.
Unbuilt navigation and Shape/Work on this actions are hidden. Keep only moves
an existing Inbox item to Everything; no model call or duplicate item is created.

Delete a to-do from the Delete button at the bottom of its page or list actions
menu, or from Inbox. The confirmation names the item and warns that deletion removes
its steps, notes, original capture and history permanently. Separate sub-items
remain as standalone to-dos. Complete and Cancel item still retain history.
Step deletion updates the open page as soon as the save succeeds, without a reload.

## Verification

```powershell
npm run check
npm run test:coverage
npm run test:rules
```

`test:rules` starts its own Firestore emulator: stop an existing emulator first.
With the emulator already running, use
`npx vitest run --config vitest.rules.config.ts` instead. Rules tests use a separate
`demo-mitos-*` test namespaces and cannot clear preview records.

CI runs lint, typecheck, unit coverage, rules tests, production build and the
item-write import boundary on pushes and pull requests in
[Andrew-C-Blevins/mitos](https://github.com/Andrew-C-Blevins/mitos).
`CLAUDE.md` records registry-resolved versions.

## Export

```powershell
npm run export-data -- --uid=local-andrew
```

This writes versioned JSON to ignored `exports/`, including all authorized items,
their complete logs and targeted proposals, household and people records, and the
requesting user's profile. Credentials and other owners' private items are excluded.
Settings → Export data now downloads the same versioned JSON for the signed-in
user. Only admins can archive/restore people
or assign roles. At least one active admin must remain. Archiving a login removes
household access while retaining item history. Only unused archived people without
a login can be permanently deleted. Each member can choose their own available
color and save their default context. The context will become Ready's starting filter in M2.
At 1200px and above, Everything and the selected item appear side by side with
a left navigation rail. Phones retain the separate list and item pages.

## Approved cloud setup

Firebase project **mitos-twelvedegrees** has Google sign-in enabled, the default
Firestore database in **us-east4**, deployed rules/indexes, and the Blevins seed
with all 39 reviewed legacy items. Andrew and Karen have real Auth UIDs; Diana is
archived without one. Google verifies each account at sign-in. The `users` profile
is created on first sign-in. Existing data is preserved when the seed is rerun.

Vercel project **mitos** is locally linked in scope **andrew-c-blevins-projects**.
Preview environment configuration is installed and GitHub is connected. The
approved Mitos-only runtime service account has Firestore read/write and Firebase
Auth read access. Its key is a sensitive, server-only Vercel preview variable.
The [hosted preview](https://mitos-k7rdd9us8-andrew-c-blevins-projects.vercel.app)
is Ready. Its home page returns 200 and the session endpoint rejects an
unauthenticated request with 401. On 2026-09-21 Andrew confirmed all 24 active
items load and tapping them opens the correct item details. Google sign-in and
household profile creation were also verified. This checkpoint has passed;
the desktop split and Settings were subsequently approved, implemented and
deployed to the updated preview linked above.
The subsequent Garden design is live at the custom production hostname above.
Later feature milestones remain deferred. Vercel previews may ask for a Vercel
account sign-in before the app's own Google sign-in. Production is configured;
vercel.json still disables automatic main-branch deployments. Production updates
are explicit operator actions. Andrew expects a Mitos commit-and-push request to
include publishing and verifying the live release. Other branches can deploy previews.

Firebase Admin is pinned to the current compatible 13.x release because the
14.x dependency chain fails when Vercel disables `require(ESM)`. CI tests this
runtime condition. A scoped UUID override supplies its patched CommonJS build;
the production dependency audit reports zero vulnerabilities. Registry evidence
and exact versions are recorded in `CLAUDE.md` and `docs/registry-versions.json`.

Keep `.env.local` on **demo-mitos**. `.firebaserc` defaults to that emulator project
and has a separate `cloud` alias. Real emails and operator settings belong only in
ignored `.env.cloud.local`; private keys must never be committed or uploaded as
deployment source. `.vercelignore` excludes environment files, exports and tools.
Do not pull cloud environment variables over the local emulator configuration.

These explicit operator commands require an authorized Google application-default
credential and a reviewed `.env.cloud.local` with no emulator variables:

```powershell
node --env-file=.env.cloud.local --import tsx scripts/seed-cloud.ts --apply
node --env-file=.env.cloud.local scripts/deploy-rules.mjs --approved
```

The seed is restricted to **mitos-twelvedegrees**, validates the two-account
allowlist, and never overwrites existing items or identity records. Rules deploy
renders the real allowlist into an ignored copy and refuses emulator environments.
Neither operation runs from CI. Future account changes require Andrew's approval.
Do not take over the old planner hostname or stop Flask until the migration
manifest is reviewed and retirement is approved.

## Explicit implementation boundaries

- Firestore cannot field-update an object inside an array. Section arrays are
  retained: adds use `arrayUnion`; existing-entry edits run an online transaction
  with preconditioned `arrayRemove`/`arrayUnion`. They never rewrite the whole array.
  Whole arrays of owners and contexts are intentionally conditional/scalar fields.
- Confirmed Delete permanently removes the item, all log entries and its proposals
  in one authenticated server transaction. The original capture is retained until
  the user explicitly deletes the item. Direct client deletes remain denied.
- New-item proposals lack a reader/household ACL envelope in the brief. They fail
  closed until that is specified at M3; no AI or agent endpoints exist here.
- Migration does not invent missing intent or original timestamps. Existing
  detail is the first note after capture; source status and historical attribution
  are preserved. Ambiguous category/owner decisions are held for review.
- This is a local Windows snapshot, not a verified fresh Pi export. Private
  exports and emulator data are gitignored, not silently placed in a public repo.
