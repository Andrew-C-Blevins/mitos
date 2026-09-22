import { ZodError } from 'zod';

export const CAPTURE_LIMIT = 50_000;

export function validateCapture(text: string): string {
  if (!text.trim()) throw new Error('Write something before saving.');
  if (text.length > CAPTURE_LIMIT)
    throw new Error('This capture is over 50,000 characters. Split it into two captures.');
  return text;
}

export function saveError(error: unknown): string {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    if (issue?.code === 'too_small') return 'Enter some text, or use Delete to remove this entry.';
    if (issue?.code === 'too_big')
      return 'This entry is too long. Put the additional detail in a note.';
    return 'Check the value you entered and try again.';
  }
  return error instanceof Error ? error.message : 'Could not save. Please try again.';
}
