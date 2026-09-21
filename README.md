# Mitos

A phone-first household action ledger, built from `planner-design-brief.md`
revision 2. The first **Item + Everything design check** was reviewed; the
approved cloud setup is in progress, with later feature milestones still deferred.
The source planner has not been changed or retired.

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

- Firebase client writes, offline capture, field updates and real-time reads.
- Item, built first: inline editing and adds, all specified content sections,
  questions-to-decisions, settings disclosure, recurrence, newest 20 log entries
  with older paging, permanent original capture.
- Everything: manual ordering, Mine/Household/Karen/All and category/Waiting/
  Recurring filters, nested display, long-press actions, swipe complete/snooze,
  touch drag handles and move-to-top alternative, collapsed Snoozed, manual Inbox.
- Pure readiness, date, recurrence, ranking and proposal-precondition functions.
- Default-deny rules, indexes, client/admin separation, allowlist checks, auth and
  integration-token helpers, guarded Admin proposal application, export script.
- Manifest, Apple icon, system light/dark theme, CI workflow.

Ready, Due, Review, Settings, AI, Shortcut, handoff and MCP screens/routes are not
enabled. Their later milestones require design approval. No desktop-specific
layout has been built. The placeholder navigation and Shape/Work on this actions
are disabled; they do not silently invoke unimplemented behavior.

## Verification

```powershell
npm run check
npm run test:coverage
npm run test:rules
```

`test:rules` starts its own Firestore emulator: stop an existing emulator first.
With the emulator already running, use
`npx vitest run --config vitest.rules.config.ts` instead. Rules tests use a separate
`demo-mitos-rules` namespace and cannot clear preview records.

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
Settings → Export is deferred with Settings until the design checkpoint is approved.

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
The hosted preview and end-to-end Google sign-in are being verified. Production
is not configured; vercel.json disables automatic main-branch deployments until
production is approved. Other branches can deploy previews, and explicit CLI
preview deployments remain available.

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
- Inbox Delete cancels the item so the permanent capture log survives.
- New-item proposals lack a reader/household ACL envelope in the brief. They fail
  closed until that is specified at M3; no AI or agent endpoints exist here.
- Migration does not invent missing intent or original timestamps. Existing
  detail is the first note after capture; source status and historical attribution
  are preserved. Ambiguous category/owner decisions are held for review.
- This is a local Windows snapshot, not a verified fresh Pi export. Private
  exports and emulator data are gitignored, not silently placed in a public repo.
