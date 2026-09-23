# Item save confirmation — September 22, 2026

The inline Saved label beside Snooze misleadingly looked specific to that action.
Item saves now use a shared bottom overlay with a checkmark and “Changes saved.”
It stays visible for seven seconds, refreshes on another save, can be dismissed,
and pauses while hovered or keyboard-focused. It announces politely without
moving focus or changing layout. Motion follows the system preference.

The overlay clears the mobile bottom navigation, capture button and safe area;
on desktop it sits near the bottom of the viewport. All Item save paths use it:
field changes, step/need/question/decision edits and deletes, notes, links,
recurrence, and completion. It appears after successful persistence. Validation
and write errors retain their existing error messages; loading older history
does not show success. Capture and Settings retain their existing feedback.

Implementation: SaveToastProvider in AppShell, useSaveToast in Item and InlineText.
No dependency, schema, rules, account or environment changes.

## Verification

- Browser checks at 393×852 and 1440×960: separate overlay placement, automatic
  dismissal, early dismissal, snooze/unsnooze, step checkbox and inline text saves.
- Empty step validation did not show a success toast. Reading older history did
  not show a toast. No browser console errors were observed.
- Only a disposable local emulator to-do was used; no production records changed.
- Boundary/runtime checks, lint, typecheck, all 44 unit/domain/route tests and
  the production build passed. Local test data was removed and services stopped.

## Live release

App commit **ec9d74d2f35a0389ae3825fd4f3a828af6374237** is committed and pushed.
Vercel deployment **dpl_GcJdpEperXvx5DUomc6LnePPoYDX** is Production/Ready and
aliased to https://mitos.twelvedegrees.studio. Custom-domain HTML/assets and the
published toast bundle passed verification; session/export remain protected.
The bounded production error-log scan returned no entries.
[GitHub CI passed](https://github.com/Andrew-C-Blevins/mitos/actions/runs/35802194316),
including coverage, all 26 emulator integration tests, and the production build.
