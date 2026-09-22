'use client';

import { useState, type ReactNode } from 'react';
import { DragDropProvider, DragOverlay } from '@dnd-kit/react';
import { isSortable, useSortable } from '@dnd-kit/react/sortable';
import {
  Accessibility,
  PointerActivationConstraints,
  PointerSensor,
  type Sensors,
} from '@dnd-kit/dom';
import { configure, type Plugins } from '@dnd-kit/abstract';
import { RestrictToVerticalAxis } from '@dnd-kit/abstract/modifiers';
import { describeMove, moveInList, type ListMove } from './order';
import styles from './sortable-list.module.css';

const sensors = (defaults: Sensors) => [
  ...defaults.filter((sensor) => sensor !== PointerSensor),
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: 6 })],
  }),
];

const accessibility = configure(Accessibility, {
  screenReaderInstructions: {
    draggable:
      'Press Space to pick up. Use the up and down arrows to move. Press Space to drop, or Escape to cancel.',
  },
  announcements: {
    dragstart({ operation }) {
      return `Picked up ${operation.source?.data.label}. Use up and down arrows to move.`;
    },
    dragover({ operation }) {
      const { source, target } = operation;
      if (target && target.id !== source?.id)
        return `Moving ${source?.data.label} next to ${target.data.label}.`;
    },
    dragend({ canceled, operation }) {
      return canceled
        ? 'Move canceled. Original order restored.'
        : `Dropped ${operation.source?.data.label}.`;
    },
  },
});
const plugins = (defaults: Plugins) => [
  ...defaults.filter((plugin) => plugin !== Accessibility),
  accessibility,
];
const modifiers = [RestrictToVerticalAxis];

interface Props<T> {
  items: readonly T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  label: string;
  disabled?: boolean;
  canDrag?: (item: T) => boolean;
  renderItem: (item: T, handle: ReactNode) => ReactNode;
  renderOverlay: (item: T) => ReactNode;
  /** Resolve after the controlled items reflect the save; reject to restore incoming items. */
  onReorder: (move: ListMove) => Promise<void>;
}

/** A single sibling list. Nest another list inside renderItem for independently ordered children. */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  label,
  disabled = false,
  canDrag,
  renderItem,
  renderOverlay,
  onReorder,
}: Props<T>) {
  const [operation, setOperation] = useState<{ items: readonly T[]; saving: boolean } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  // dnd-kit moves DOM nodes optimistically. Freeze the React list until the drop is committed,
  // so subscription updates cannot reconcile a different order in the middle of a gesture.
  const displayed = operation?.items ?? items;
  return (
    <DragDropProvider
      sensors={sensors}
      modifiers={modifiers}
      plugins={plugins}
      onDragStart={() => {
        setError('');
        setFeedback('');
        setOperation({ items: [...items], saving: false });
      }}
      onDragEnd={async (event) => {
        const source = event.operation.source;
        if (
          event.canceled ||
          !event.operation.target ||
          !isSortable(source) ||
          source.initialIndex === source.index
        ) {
          setOperation(null);
          return;
        }
        const next = moveInList(displayed, source.initialIndex, source.index);
        const movable = next.filter((item) => canDrag?.(item) !== false);
        const move = describeMove(
          movable,
          movable.findIndex((item) => getId(item) === source.id),
          getId,
        );
        setOperation({ items: next, saving: true });
        setFeedback('Saving order…');
        try {
          await onReorder(move);
          setFeedback('Order saved.');
        } catch (caught) {
          setFeedback('');
          setError(
            caught instanceof Error ? caught.message : 'Could not save the order. Try again.',
          );
        } finally {
          setOperation(null);
        }
      }}
    >
      <div
        role="list"
        aria-label={label}
        className={styles.list}
        aria-busy={operation?.saving || undefined}
      >
        {displayed.map((item, index) =>
          disabled || canDrag?.(item) === false ? (
            <div role="listitem" key={getId(item)}>
              {renderItem(item, null)}
            </div>
          ) : (
            <SortableEntry
              key={getId(item)}
              id={getId(item)}
              label={getLabel(item)}
              index={index}
              disabled={false}
              saving={operation?.saving ?? false}
            >
              {(handle) => renderItem(item, handle)}
            </SortableEntry>
          ),
        )}
      </div>
      <DragOverlay className={styles.overlay}>
        {(source) => {
          const item = displayed.find((item) => getId(item) === source.id);
          return item ? <div aria-hidden="true">{renderOverlay(item)}</div> : null;
        }}
      </DragOverlay>
      <span className={styles.srOnly} role="status">
        {feedback}
      </span>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </DragDropProvider>
  );
}

function SortableEntry({
  id,
  label,
  index,
  disabled,
  saving,
  children,
}: {
  id: string;
  label: string;
  index: number;
  disabled: boolean;
  saving: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { ref, handleRef, isDragSource } = useSortable({
    id,
    index,
    disabled: disabled || saving,
    data: { label },
    transition: { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  });
  return (
    <div
      ref={ref}
      role="listitem"
      className={styles.entry}
      data-dragging={isDragSource || undefined}
    >
      {children(
        disabled ? null : (
          <button
            ref={handleRef}
            type="button"
            className={styles.handle}
            aria-disabled={saving || undefined}
            aria-label={`Reorder ${label}`}
            title="Drag to reorder. Keyboard: Space, arrow keys, Space."
          >
            <svg width="18" height="22" viewBox="0 0 18 22" fill="currentColor" aria-hidden="true">
              {[6, 11, 16].map((y) => (
                <g key={y}>
                  <circle cx="6" cy={y} r="1.4" />
                  <circle cx="12" cy={y} r="1.4" />
                </g>
              ))}
            </svg>
          </button>
        ),
      )}
    </div>
  );
}

export type { ListMove } from './order';
