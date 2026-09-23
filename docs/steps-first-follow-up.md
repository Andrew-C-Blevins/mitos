# Steps-first follow-up — September 23, 2026

Andrew approved this morning's discussed changes for implementation and live release.

## Behavior

- A compact assignee/date row opens People & timing; steps stay together immediately
  below it. The sheet contains assignment, visibility and the four date controls.
- No independent Next action editor or Add details choice. The first unfinished
  checklist step supplies list previews and readiness/ranking reasons, without AI.
  All steps checked offers explicit completion. Unique previous Next action text is
  retained in a collapsed reference note; no stale instructions become new work.
- Editing/checking a step preserves its place. Transaction results immediately
  update both the item and list preview even if the live listener is delayed.
- To-dos replaces Everything in UI labels. The redundant one-destination bottom
  navigation and desktop rail are removed; Settings remains in the header.
- Back to list and Done restore the same list filters/scroll. In-app item navigation
  uses Next's documented native History API and URL-driven client rendering. It no
  longer depends on a second server page transition to mount the item. Deep links
  have authenticated resolution and visible retry/back controls.
- Native sheets share a fixed-body scroll lock with scroll restoration and adapt
  to the visual viewport/keyboard. The seven-second save toast also appears inside
  the modal top layer as an overlay without moving the sheet.
- Archived-person Delete uses an in-app confirmation, visible pending/errors, and
  confirmed-deletion suppression of stale cached rows. Household admin and reference
  guards remain enforced on the server. No live person record was deleted by testing.

## URL compatibility

An optional immutable `urlId` contains a random 128-bit opaque identifier for an
imported record. `/items/<old-id>` continues to resolve and replaces the displayed
URL with its canonical alias after authentication. New capture IDs remain unchanged.
Firestore document IDs, subcollections, parent IDs and proposal references do not move.
GET `/api/items/[id]` checks current authenticated membership/visibility and sends
`Cache-Control: no-store`. Unknown, ambiguous and unauthorized aliases fail closed.
Rules allow ordinary edits on aliased items but forbid browser alias creation/editing.

`scripts/migrate-item-urls.mjs` defaults to dry-run. `--local --apply` tests on
demo-mitos. Cloud requires an explicit project, a matching credential file, and
`--apply --approved`. It writes an ignored backup before one atomic batch with
update-time preconditions. It adds only urlId and increments version; repeat runs
preserve existing aliases. Do not rerun the original cloud seed to perform this backfill.

## Validation

- Local unit/route tests: 48 passed; date/rules coverage: 100%.
- Emulator integration/security tests: 28 passed, including ordered step edits,
  old/opaque links, cross-user privacy and alias immutability.
- Browser at 393px: 20-step item, step completion/list preview, People & timing,
  native date change, toast inside the sheet without changing its position,
  Capture background scroll lock and exact scroll restoration.
- Back and Done both restored 864.667px in the same test; repeated early opens
  succeeded three times. Original imported link resolves to its opaque alias.
- Disposable local archived person deleted, disappeared immediately and stayed
  absent after reload. Initial local token was stale after emulator restart;
  fresh local sign-in resolved the 401 and the in-app error was visible.
- Desktop 1440px keeps list and item side by side with the navigation rail removed.
- `npm run check` passed, including the optimized production build. Opening an item,
  returning to the list and navigating to Settings also passed against `next start`
  with no browser console errors.
- Physical iPhone Safari/keyboard behavior remains a device check. The original
  intermittent stall was not reproduced before the navigation change; do not claim
  a confirmed Safari cache root cause.

## Release

Pending final build, commit, production deployment, rules update and URL backfill.
The production dry run found 37 imported records without aliases. Private migration
backups and deployment receipts remain ignored under exports/ and .tools/.
