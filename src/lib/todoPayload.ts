/**
 * Request-body validation for the to-do routes.
 *
 * Server-side only in practice, but kept framework-free so POST, PATCH and the
 * migration route all run a request through exactly the same rules — a field
 * that is checked in one place and waved through in another is how a CHECK
 * constraint ends up rejecting a write as an opaque 500.
 */

import { isISODate, isISOTime } from './todos';
import type { RecurrenceOnMissed, TodoRecurrence, TodoReminder } from '@/types';

export const MAX_TITLE = 500;
export const MAX_DESCRIPTION = 2000;
const REMINDER_LEADS = ['15m', '30m', '1h', '3h', '1d', '3d', '1w'];
const FREQS = ['daily', 'weekly', 'monthly', 'custom'];

/** A rejection message, or null when the value is acceptable. */
export type Problem = string | null;

export function validateTitle(value: unknown): Problem {
  if (typeof value !== 'string') return 'title must be a string';
  if (!value.trim()) return 'A to-do needs a title';
  if (value.length > MAX_TITLE) return 'That title is too long';
  return null;
}

export function validateDescription(value: unknown): Problem {
  if (value === null) return null;
  if (typeof value !== 'string') return 'description must be a string or null';
  if (value.length > MAX_DESCRIPTION) return 'That description is too long';
  return null;
}

export function validateEstimate(value: unknown): Problem {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return 'estimate_minutes must be a whole number of minutes or null';
  }
  if (value < 1 || value > 1440) return 'An estimate has to be between 1 minute and 24 hours';
  return null;
}

/**
 * Positions are float8 in the database, where NaN and Infinity are accepted
 * values that sort above everything real — one of those would pin a row to the
 * bottom of its group permanently. The CHECK constraint catches it too; this
 * turns it into a 400 rather than a 500.
 */
export function validatePosition(value: unknown): Problem {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'position must be a finite number';
  if (value < -1e15 || value > 1e15) return 'position is out of range';
  return null;
}

export function validateRecurrence(value: unknown): Problem {
  if (value === null) return null;
  if (typeof value !== 'object') return 'recurrence must be an object or null';
  const r = value as Partial<TodoRecurrence>;
  if (!FREQS.includes(r.freq as string)) return 'Unknown repeat frequency';
  if (typeof r.interval !== 'number' || !Number.isInteger(r.interval) || r.interval < 1 || r.interval > 366) {
    return 'Repeat interval must be between 1 and 366';
  }
  if (r.byday !== undefined) {
    if (!Array.isArray(r.byday) || r.byday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      return 'Repeat weekdays must be numbers from 0 to 6';
    }
  }
  const onMissed: RecurrenceOnMissed | undefined = r.on_missed;
  if (onMissed !== 'skip' && onMissed !== 'rollover') return 'Unknown missed-repeat behaviour';
  if (r.ends) {
    const t = r.ends.type;
    if (t !== 'never' && t !== 'on' && t !== 'after') return 'Unknown repeat end type';
    if (t === 'on' && !isISODate(r.ends.date)) return 'Repeat end date must be YYYY-MM-DD';
    if (t === 'after' && (!Number.isInteger(r.ends.count) || (r.ends.count as number) < 1)) {
      return 'Repeat count must be a positive whole number';
    }
  }
  return null;
}

export function validateReminder(value: unknown): Problem {
  if (value === null) return null;
  if (typeof value !== 'object') return 'reminder must be an object or null';
  const r = value as Partial<TodoReminder>;
  if (!REMINDER_LEADS.includes(r.lead as string)) return 'Unknown reminder lead time';
  if (r.repeat_count !== null && (!Number.isInteger(r.repeat_count) || (r.repeat_count as number) < 1 || (r.repeat_count as number) > 10)) {
    return 'Reminder repeat count must be null or between 1 and 10';
  }
  return null;
}

export function validateDueDate(value: unknown): Problem {
  if (value === null) return null;
  return isISODate(value) ? null : 'due_date must be YYYY-MM-DD or null';
}

export function validateDueTime(value: unknown): Problem {
  if (value === null) return null;
  return isISOTime(value) ? null : 'due_time must be HH:MM or null';
}

export function validateSubtaskMode(value: unknown): Problem {
  return value === 'independent' || value === 'dependent' ? null : 'Unknown sub-task mode';
}

/**
 * The writable columns, each with its validator and the normaliser that turns
 * an accepted value into what goes to the database.
 *
 * `space_id`, `parent_id` and `source_note_id` are absent on purpose: they are
 * foreign keys that arrive from the client and have to be resolved through
 * lib/ownership before they can be trusted, which needs a database round-trip
 * and therefore lives in the route.
 */
export const TODO_FIELDS: Record<
  string,
  { validate: (v: unknown) => Problem; normalise?: (v: unknown) => unknown }
> = {
  title: { validate: validateTitle, normalise: (v) => (v as string).trim().slice(0, MAX_TITLE) },
  description: {
    validate: validateDescription,
    normalise: (v) => (v === null ? null : (v as string).trim().slice(0, MAX_DESCRIPTION) || null),
  },
  due_date: { validate: validateDueDate },
  due_time: {
    validate: validateDueTime,
    // Postgres stores `time` as HH:mm:ss; normalising on the way in keeps
    // string comparisons in the client working on a fixed width.
    normalise: (v) => (v === null ? null : `${(v as string).slice(0, 5)}:00`),
  },
  estimate_minutes: { validate: validateEstimate },
  position: { validate: validatePosition },
  subtask_mode: { validate: validateSubtaskMode },
  recurrence: { validate: validateRecurrence },
  reminder: { validate: validateReminder },
};

/**
 * Applies TODO_FIELDS to a request body.
 *
 * Returns the accepted updates, or the first problem found. Fields absent from
 * the body are left alone, so a PATCH never has to send the whole row.
 */
export function collectTodoFields(
  body: Record<string, unknown>
): { updates: Record<string, unknown>; problem: null } | { updates: null; problem: string } {
  const updates: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(TODO_FIELDS)) {
    if (!(key in body)) continue;
    const problem = spec.validate(body[key]);
    if (problem) return { updates: null, problem };
    updates[key] = spec.normalise ? spec.normalise(body[key]) : body[key];
  }
  return { updates, problem: null };
}
