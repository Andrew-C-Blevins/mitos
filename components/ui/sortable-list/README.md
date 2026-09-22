# Reusable sortable list

This folder is independent of Mitos, Firebase, routing and Tailwind. Copy it
into another React app with its CSS module and compatible `@dnd-kit/react`,
`@dnd-kit/dom` and `@dnd-kit/abstract` dependencies. Mitos uses npm-verified
stable **0.5.0** for all three (React 18/19 peers).

```tsx
<SortableList
  items={rows}
  getId={(row) => row.id}
  getLabel={(row) => row.title}
  label="Tasks"
  renderItem={(row, handle) => (
    <div>
      {row.title}
      {handle}
    </div>
  )}
  renderOverlay={(row) => <div>{row.title}</div>}
  onReorder={async ({ id, beforeId, afterId }) => {
    // Update controlled rows optimistically, then persist stable neighbor ids.
    // Resolve after rows reflect the save; roll back and reject on failure.
    await savePosition(id, beforeId, afterId);
  }}
/>
```

## Contract

- Drag starts only from the 44px-wide handle after 6px of movement. Only the
  handle has `touch-action: none`; the rest of the row remains scrollable and
  can host links, inputs or swipe gestures. No long-press menu.
- One provider per sibling list. Nest another SortableList inside renderItem
  for children. A dragged parent carries its children; a child cannot escape
  to the outer list or change parents.
- dnd-kit's optimistic sorting, keyboard, auto-scroller, cursor and selection
  plugins stay enabled. The overlay follows the pointer; other rows move live.
- Space/Enter lifts/drops, up/down moves, Escape cancels. Handles retain focus
  during saves. Screen reader announcements use labels, not database ids.
- Animations follow dnd-kit's reduced-motion behavior. Optional CSS variables:
  `--sortable-surface`, `--sortable-ink`, `--sortable-accent`, `--sortable-handle`,
  `--sortable-placeholder`, `--sortable-error`. Defaults work outside Mitos.
- Rendered items freeze during the gesture and save. Incoming subscription
  updates appear afterward, preventing competing DOM reconciliation mid-drag.
- onReorder runs once for a changed, non-canceled drop with its closest movable
  **visible** neighbors. The storage adapter must resolve these against current
  full data, including hidden rows, and reject stale or incompatible anchors.
- The caller owns optimistic data and rollback. A rejected save restores the
  incoming controlled list and displays an alert. Further drags within this list
  are disabled until the save resolves.
- `disabled` removes all handles; `canDrag` excludes individual rows from drag,
  drop targets and neighbor anchors. Use stable unique ids. Keep overlays
  presentational, without duplicate interactive controls or DOM ids. An expanded
  parent's overlay should include its visible children.
- This is a vertical, non-virtualized list, not a tree editor.

## Mitos adapter and checks

Everything saves one fractional sortKey through existing authenticated client
writes. Filters don't rewrite hidden siblings. Date sorts remove handles and
explain how to return to manual order. If a filter hides a nested item's parent,
show the parent again to reorder that child.

Unit tests cover bidirectional movement, stable neighbors, filtered positions,
stale anchors and sibling boundaries. Browser checks cover pointer/keyboard
dragging, overlay/displacement, cancellation, nested order, reload persistence
and mobile layout. Before reuse, also check long-list scrolling, rejected/offline
saves, live updates during a drag and actual iOS/Android touch behavior with the
destination app's scroll containers.

References: [React quickstart](https://dndkit.com/react/quickstart/),
[sortable state](https://dndkit.com/react/guides/sortable-state-management/),
[sensors](https://dndkit.com/react/guides/sensors/).
