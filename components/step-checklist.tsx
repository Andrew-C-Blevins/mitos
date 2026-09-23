'use client';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Step } from '@/lib/types';
import { completedPrefixLength } from '@/lib/domain/steps';
import { InlineText } from './inline-text';

export function StepChecklist({
  steps,
  onToggle,
  onEdit,
}: {
  steps: Step[];
  onToggle: (step: Step) => Promise<unknown>;
  onEdit: (before: Step, after?: Step) => Promise<unknown>;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const disclosure = useRef<HTMLButtonElement>(null);
  const prefix = completedPrefixLength(steps);
  const id = useId();

  useLayoutEffect(() => {
    // A checked row can join the collapsed prefix. Keep keyboard focus reachable
    // without stealing it when the user has already moved to another control.
    const focused = document.activeElement;
    if (focused && list.current?.contains(focused) && focused.closest('li[hidden]')) {
      disclosure.current?.focus({ preventScroll: true });
    }
  }, [steps, showCompleted]);

  return (
    <ul className="document-list step-list" ref={list}>
      {prefix > 0 ? (
        <li className="completed-steps-heading">
          <button
            ref={disclosure}
            className="completed-steps-toggle"
            aria-expanded={showCompleted}
            aria-controls={steps
              .slice(0, prefix)
              .map((step) => `${id}-${step.id}`)
              .join(' ')}
            onClick={() => setShowCompleted((shown) => !shown)}
          >
            <ChevronRight size={16} aria-hidden="true" />
            {prefix} completed {prefix === 1 ? 'step' : 'steps'}
          </button>
        </li>
      ) : null}
      {steps.map((step, index) => (
        <li
          key={step.id}
          id={`${id}-${step.id}`}
          className="check-row"
          hidden={index < prefix && !showCompleted}
        >
          <StepRow step={step} onToggle={onToggle} onEdit={onEdit} />
        </li>
      ))}
    </ul>
  );
}

function StepRow({
  step,
  onToggle,
  onEdit,
}: {
  step: Step;
  onToggle: (step: Step) => Promise<unknown>;
  onEdit: (before: Step, after?: Step) => Promise<unknown>;
}) {
  const [saving, setSaving] = useState(false);
  const editor = (
    <InlineText
      className={step.done ? 'done-text' : ''}
      value={step.text}
      placeholder="Edit step"
      onDelete={() => onEdit(step)}
      onSave={(text) => onEdit(step, { ...step, text })}
    />
  );
  return (
    <>
      <input
        type="checkbox"
        aria-label={`Complete step: ${step.text}`}
        checked={step.done}
        aria-disabled={saving}
        onChange={async () => {
          if (saving) return;
          setSaving(true);
          try {
            await onToggle(step);
          } finally {
            setSaving(false);
          }
        }}
      />
      {step.done ? (
        <details className="completed-step">
          <summary aria-label={`Show completed step: ${step.text}`}>
            <span className="done-text">{step.text}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </summary>
          {editor}
        </details>
      ) : (
        editor
      )}
    </>
  );
}
