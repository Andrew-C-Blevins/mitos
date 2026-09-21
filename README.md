# Mitos

A phone-first household action ledger, built from `planner-design-brief.md`
revision 2. This repository stops at the first **Item + Everything design check**.
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
cloud deployment is involved. LAN HTTP uses in-memory Firestore caching because
it is not a secure browser context; durable offline persistence is enabled on
localhost and the future HTTPS deployment. No service worker is installed.

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
item-write import boundary on pushes and pull requests. The workflow is local
until GitHub creation/push is approved. `CLAUDE.md` records registry-resolved versions.

## Export

```powershell
npm run export-data -- --uid=local-andrew
```

This writes versioned JSON to ignored `exports/`, including all authorized items,
their complete logs and targeted proposals, household and people records, and the
requesting user's profile. Credentials and other owners' private items are excluded.
Settings → Export is deferred with Settings until the design checkpoint is approved.

## Cloud setup is pending explicit approval

No Firebase, Vercel or GitHub project has been created, linked, pushed or deployed.
`.firebaserc` names **demo-mitos**, which intentionally cannot access real services.
Deployment needs a real project, Andrew's Google email, both real Auth UIDs,
Google sign-in setup, reviewed environment variables and a household seed.
The two local `.test` identities must never be copied into a live deployment.

`npm run firebase:deploy-rules -- --approved` refuses a demo project and renders
the env allowlist into an ignored deployment copy of the checked-in rule template.
It is a guarded manual command, not a CI deploy. Do not run it until Andrew has
approved the account-side changes. The future host is Vercel Hobby; the app and
repository identifier is `mitos`. Do not take over the old planner hostname or
stop Flask until the migration manifest is reviewed and retirement is approved.

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
