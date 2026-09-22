# September 22 deletion follow-up

Status: live at https://mitos.twelvedegrees.studio from app commit df7a7e8.
Vercel deployment dpl_EPWtWXpUQLFg7tfTne9wSFd5GjpE is Production/Ready with the
custom-domain alias. GitHub CI passed: https://github.com/Andrew-C-Blevins/mitos/actions/runs/35791623514.

## Behavior

- Item has a visible Delete action at the top. Everything's actions menu and
  Inbox use the same confirmation dialog, with the item title, irreversible
  deletion explanation, safe initial focus and a busy state preventing double taps.
- DELETE /api/items/[id] verifies Firebase authentication and the account allowlist,
  then checks current household membership, item visibility and the confirmed
  version inside a server transaction. Any member with access may delete the item;
  an admin role does not grant access to another person's private items.
- That transaction removes the item, all log entries (including older pages), and
  every proposal targeting it. It leaves no cancellation record or deletion log.
  Separate child items are detached, preserving their content and history.
- Direct Firestore client deletion remains denied. Only the dedicated human route
  can import the deletion adapter; AI/agent routes cannot import item mutations.
  This release needs no rules/index changes, data migration, or cloud env changes.
- Step deletion uses one transaction update for removal and version metadata.
  The UI also consumes the confirmed transaction result without waiting for the
  Listen stream, and won't replace it with an older snapshot. Ordinary optimistic
  writes may still roll back if denied. Needs/questions/decisions use the same fix.
- Server-confirmed deletion immediately removes the cached Everything row, even
  when the live query has not caught up. A session-only set of IDs suppresses stale
  cached rows; no deleted item content is stored in that set.

## Verification

- 40 application/domain/route tests pass; deterministic-rules coverage remains 100%.
- 26 emulator tests cover private/household authorization, revoked membership,
  stale confirmations, all-or-nothing history removal, sub-item preservation,
  consecutive step deletion with a live subscription, and successful/failed
  deletion while list snapshots lag behind the API response.
- Lint, TypeScript, the import boundary, Firebase runtime and production build pass.
- Browser at 393 x 852: delete a step, check and delete the next step without
  navigating or reloading; the rows disappear immediately. Confirmation cancellation
  preserves the item. Confirmed deletion returns to Everything. The disposable
  local fixture's 25 log entries and proposal were checked absent afterward.
- Browser testing found an additional cached-list lag after server deletion; the
  session notification and stale-row suppression address it. Physical iPhone/Safari
  verification remains a user check. No real household items were deleted in testing.
- Final fresh-browser verification confirms deletion returns to Everything with
  zero remaining links for the deleted test item, without a reload. Production
  home/assets return 200 and the published item bundle includes the confirmation.
  The new DELETE endpoint returns 401 for both missing and invalid authentication;
  the deployment error-log scan was empty. Signed-in destructive testing was local
  only; no production household data was modified.

## Field distinctions

Next action is an optional immediate move; Steps is the checklist. They are
independent in this version. Existing next-action text is preserved in this release.
For a simpler future design, use the first unchecked step as the default next action
and reserve a separate override for an action that differs from that checklist.

Needs are prerequisites. Open questions are unresolved issues; Decisions record
answers settled on. Notes & history is reference and past events. None is required.
Inbox Keep simply activates the existing item and does not invoke AI. Deferred
Ready means actionable in the current context/time with needs satisfied; Due means
real deadlines; Review means proposed changes or items needing attention. These
views, Shape and Work on this remain disabled/deferred.
