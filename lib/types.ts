import { z } from 'zod';

// Domain timestamps are ISO instants; adapters convert Firestore Timestamp at the boundary.
export const instantSchema = z.iso.datetime({ offset: true });
export const dateSchema = z.iso.date();
export const categories = ['home', 'family', 'finance-admin', 'personal', 'work'] as const;
export const contexts = ['computer', 'phone', 'home', 'yard', 'errand'] as const;
export const categoryLabels = {
  home: 'Home',
  family: 'Family',
  'finance-admin': 'Finance & Admin',
  personal: 'Personal',
  work: 'Work',
};
export const categoryMarks = {
  home: 'HM',
  family: 'FA',
  'finance-admin': 'FI',
  personal: 'PE',
  work: 'WK',
};
export const effortLabels = { quick: 'Quick', sitting: 'One sitting', multi: 'Multi-session' };
export type Context = (typeof contexts)[number];
export type Category = (typeof categories)[number];
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[\w-]+$/);
const text = z.string().trim().min(1).max(4000);
export const needSchema = z
  .object({
    id,
    text,
    kind: z.enum(['material', 'person', 'info', 'decision']),
    satisfied: z.boolean(),
    waitingOn: text.optional(),
  })
  .strict();
export const questionSchema = z.object({ id, text, createdAt: instantSchema }).strict();
export const decisionSchema = z
  .object({
    id,
    text,
    rationale: text.optional(),
    decidedAt: instantSchema,
    fromQuestionId: id.optional(),
  })
  .strict();
export const stepSchema = z.object({ id, text, done: z.boolean() }).strict();
export const linkSchema = z
  .object({
    id,
    url: z.url().refine((s) => /^https?:\/\//i.test(s), 'Use an http or https link'),
    label: text,
    kind: z.enum(['chat', 'reference', 'hearth']),
  })
  .strict();
const monthDay = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine((s) => dateSchema.safeParse(`2000-${s}`).success, 'Invalid season date');
export const recurrenceSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('calendar'),
      rule: z.string().min(1).max(500),
      season: z.object({ start: monthDay, end: monthDay }).optional(),
      lastCompletedAt: instantSchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('afterCompletion'),
      intervalDays: z.number().int().min(1).max(3650),
      season: z.object({ start: monthDay, end: monthDay }).optional(),
      lastCompletedAt: instantSchema.optional(),
    })
    .strict(),
]);
const smallList = <T extends z.ZodType>(schema: T) =>
  z
    .array(schema)
    .max(40)
    .refine(
      (rows) => new Set(rows.map((row) => (row as { id: string }).id)).size === rows.length,
      'Duplicate entry id',
    );
export const itemSchema = z
  .object({
    id,
    title: text.max(500),
    urlId: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    intent: text.optional(),
    status: z.enum(['inbox', 'active', 'done', 'cancelled']),
    scope: z.enum(['private', 'household']),
    householdId: id,
    ownerPersonIds: z.array(id).max(10),
    createdBy: z.string().min(1),
    category: z.enum(categories),
    outcome: text.optional(),
    nextAction: text.optional(),
    effort: z.enum(['quick', 'sitting', 'multi']),
    focus: z.enum(['low', 'normal', 'high']),
    contexts: z.array(z.enum(contexts)).max(5),
    businessHours: z.boolean(),
    dueDate: dateSchema.optional(),
    targetDate: dateSchema.optional(),
    snoozeUntil: dateSchema.optional(),
    availableFrom: dateSchema.optional(),
    needs: smallList(needSchema),
    questions: smallList(questionSchema),
    decisions: smallList(decisionSchema),
    steps: smallList(stepSchema),
    links: smallList(linkSchema),
    recurrence: recurrenceSchema.optional(),
    parentId: id.optional(),
    sortKey: z.string().min(1).max(100),
    version: z.number().int().positive(),
    historicalOwnerNames: z.array(text).optional(),
    createdAt: instantSchema,
    updatedAt: instantSchema,
    completedAt: instantSchema.optional(),
  })
  .strict()
  .refine(
    (item) => item.scope !== 'private' || item.ownerPersonIds.length > 0,
    'Private items need an owner',
  );
export type Item = z.infer<typeof itemSchema>;
export type Need = z.infer<typeof needSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Decision = z.infer<typeof decisionSchema>;
export type Step = z.infer<typeof stepSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Recurrence = z.infer<typeof recurrenceSchema>;
export type Section = 'needs' | 'questions' | 'decisions' | 'steps' | 'links';
export type SectionEntry = Need | Question | Decision | Step | Link;
export interface Household {
  id: string;
  name: string;
  memberUids: string[];
  adminUids?: string[];
  createdAt: string;
}
export interface Person {
  id: string;
  name: string;
  householdId: string;
  uid?: string;
  status: 'active' | 'archived';
  color: string;
  createdAt: string;
  archivedAt?: string;
}
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  personId: string;
  householdIds: string[];
  defaultContext?: Context;
  createdAt: string;
}
export interface LogEntry {
  id: string;
  at: string;
  by: string;
  kind: 'capture' | 'note' | 'status' | 'applied' | 'migrated';
  text: string;
}
export interface Credentials {
  captureTokenHash?: string;
  agentTokenHash?: string;
}
export interface Change {
  id: string;
  label: string;
  class: 'commutative' | 'conditional' | 'transition';
  op: 'add' | 'set' | 'remove' | 'transition';
  path: string;
  previousValue?: unknown;
  value: unknown;
  checked: boolean;
}
export interface Proposal {
  id: string;
  source: 'planner-ai' | 'agent' | 'dictation';
  targetItemId?: string;
  baseItemVersion?: number;
  changes: Change[];
  rawInput?: string;
  confidence: 'low' | 'medium' | 'high';
  status: 'pending' | 'applied' | 'partially-applied' | 'discarded';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}
export interface Viewer {
  uid: string;
  personId: string;
  householdIds: string[];
}
