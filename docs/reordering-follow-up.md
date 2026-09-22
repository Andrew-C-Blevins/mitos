# Unified controls and direct reordering — September 22, 2026

The Everything ellipsis/long-press modal duplicated Item and hid dates in a
second place. It and the Move before/Bottom dropdown are removed. Item always
shows People (visibility and assignment), Dates, Snooze 1 week and Unsnooze.
The confirmed Delete remains at the bottom beside Done.

Manual ordering has drag handles, a lifted preview, live row displacement,
edge auto-scroll, keyboard movement/cancel and accessible announcements. The
reusable component is in components/ui/sortable-list, with a storage-independent
neighbor-id contract, CSS theme tokens and reuse instructions. No shared package
is published and no other application is changed.

The adapter updates only the moved item's fractional sortKey. It validates
current sibling anchors, preserves hidden sibling order under filters, carries
children with a dragged parent, and keeps child reordering inside that parent.
Rendered data freezes during a drag/save. Failed saves restore incoming state
and display an error.

Stable @dnd-kit/react, @dnd-kit/dom and @dnd-kit/abstract 0.5.0 were queried from
npm on September 22, checked against React 19 peers, and installed as exact pins.
CLAUDE.md records them. Schema, cloud environment, accounts and rules are unchanged.

## Verification

- 44 unit/domain/route tests and 26 Firebase emulator tests passed.
- Boundary/runtime checks, lint, typecheck and production build passed; required
  domain/rules coverage remains 100%. Disposable fixtures were removed afterward.
- Local browser at 393×852: pointer reorder, keyboard reorder, live overlay and
  displacement, Escape cancellation, nested reorder, reload persistence, and
  dates/snooze/unsnooze on Item passed using six disposable emulator fixtures.
- Keyboard dragging scrolled a long list into view. Removing a local target
  during a drag produced a clear error and restored current data without a write.
  Parent moves carried their child; date sorting hid handles while links stayed
  enabled. Desktop list/detail rendering at 1440×960 passed with no console errors.
- Physical iPhone touch/edge-scroll feel remains a device check. The pointer
  sensor supports touch and dnd-kit auto-scrolling is enabled.

## Live release

App commit **a9f2a0949188edd821cf052fdb5e15a1c5f65aee** is committed and pushed.
[GitHub CI passed](https://github.com/Andrew-C-Blevins/mitos/actions/runs/35797892755).
Vercel deployment **dpl_3Rqj7XQZW4DUmNyQ7Xwycc1mwQuS** is Production/Ready and
aliased to https://mitos.twelvedegrees.studio.

Custom-domain home, item route, assets, manifest and icon returned 200. Published
JavaScript contains the new sorting and unified Item controls and no old quick
menu or move dropdown. Session/export/item DELETE still reject unauthenticated
requests with 401. The deployment's bounded error-log scan returned no entries.
No production item was modified during verification. Local services were stopped.
