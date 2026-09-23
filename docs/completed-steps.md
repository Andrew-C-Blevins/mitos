# Completed steps — September 23, 2026

Completed checklist entries retain their original order. Each completed row is
one line with an ellipsis and a disclosure to read/edit its full text. Its
checkbox remains directly available for reopening. The consecutive completed
prefix shares an expandable “N completed steps” row. Completed steps farther
down remain in place until the preceding work catches up.

For example, with steps 1–6 and 8 checked, checking 7 changes the prefix from 6
to 8 and leaves step 9 first. Reopening step 2 reduces the prefix to 1. All-complete
checklists still offer explicit to-do completion; checking steps does not complete
the overall item automatically. Adding another unfinished step exposes it normally.
There is no minimum checklist length and no AI call.

`StepChecklist` owns only disclosure state. It never sorts or mutates the supplied
steps, and uses the existing transactional edit path. Rows retain their React keys
and DOM positions while prefix rows are hidden. Keyboard focus moves to the group
disclosure if the focused checkbox becomes hidden, without scrolling it into view.

One explicitly approved imported checklist also received a narrow data repair:
two steps displaced by the earlier edit bug were restored to their original
positions using the preserved import order. All current step text, completion
flags and other fields were preserved. The update used a last-update precondition,
an ignored private backup, and exact post-write comparison. No general sort or
backfill of other checklists was performed. Private artifacts remain ignored.

No dependency, schema, rules, cloud configuration or AI changes.

## Validation

- `npm run check` passed: write boundaries, server runtime, lint, TypeScript,
  50 unit/route tests and optimized production build.
- Coverage checks passed; date/rule coverage remains 100%.
- Browser against the optimized build at 393px: long completed rows were 44px
  high instead of 163px; disclosure revealed full text. Out-of-order checked
  steps kept their positions. Completing the gap merged the prefix correctly;
  reopening an earlier step changed the prefix and the list preview immediately.
- Keyboard completion moved focus to the visible group toggle. Revealing the
  group allowed reopening steps. All 20 completed steps collapsed to one row,
  offered explicit Complete to-do, and left the record active. Persisted IDs
  retained their original order. Browser console had no errors.
- The live repair's exact comparison confirmed only step order and the record
  version changed. Actual iPhone Safari remains a physical-device check.

## Release

- App commit `ed9d8699f255d5bda6118935c53a6483eab5049e`, pushed to main.
- [GitHub CI 35899089316](https://github.com/Andrew-C-Blevins/mitos/actions/runs/35899089316)
  passed, including coverage, emulator security/integration tests and build.
- Production `dpl_DQjXNRwDSA272j6QTdVQS2Chtac7` is Ready, with
  [mitos.twelvedegrees.studio](https://mitos.twelvedegrees.studio) assigned.
- The live domain serves the new disclosure controls; unauthenticated item reads
  remain protected. Deployment error-log scan returned no entries.
- Read-back confirmed the repaired order and preserved completion flags. Adding
  an unfinished step after all original steps were complete also passed in the
  local browser. Desktop layout reviewed at 1440px.
- Local test fixtures removed, test server/emulators stopped, ports released,
  temporary browser tab closed and viewport reset. No ongoing monitor created.
