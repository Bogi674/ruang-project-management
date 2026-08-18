import { addDays, addMonths, isAfter } from 'date-fns';
import { fromISODate, toISODate } from './todos';
import type { TodoRecurrence } from '@/types';

/**
 * Recurrence.
 *
 * A repeating to-do is not a row with a rule that the UI reinterprets on every
 * render — it is one real row at a time. Completing an instance generates the
 * next one and points it back at the row carrying the rule
 * (`recurrence_parent_id`). That keeps every other feature working unchanged:
 * an instance can be dragged to a different day, given sub-tasks, or deleted,
 * without any of them needing to know it was generated.
 */

/**
 * The next date a rule fires strictly after `from`.
 *
 * Returns null when the rule has run out — past its end date, or its count is
 * spent — which is the caller's signal to generate nothing.
 */
export function nextOccurrence(
  recurrence: TodoRecurrence,
  from: string,
  occurrencesSoFar = 1
): string | null {
  const ends = recurrence.ends;
  if (ends?.type === 'after' && ends.count && occurrencesSoFar >= ends.count) return null;

  const interval = Math.max(1, recurrence.interval || 1);
  const start = fromISODate(from);
  let next: Date;

  switch (recurrence.freq) {
    case 'daily':
      next = addDays(start, interval);
      break;

    case 'monthly':
      next = addMonths(start, interval);
      break;

    case 'weekly':
    case 'custom': {
      const days = (recurrence.byday || []).slice().sort((a, b) => a - b);
      if (days.length === 0) {
        next = addDays(start, 7 * interval);
        break;
      }
      /*
       * Step one day at a time to the next selected weekday.
       *
       * A "Mon, Wed, Fri" rule fires three times a week, so the gap between
       * occurrences is not fixed and cannot be computed by adding a period.
       * The 371-day ceiling is a guard, not a limit: it is a year plus a week,
       * far past any reachable selected weekday, so hitting it means the rule
       * is malformed rather than merely sparse.
       */
      let cursor = addDays(start, 1);
      let guard = 0;
      while (!days.includes(cursor.getDay()) && guard < 371) {
        cursor = addDays(cursor, 1);
        guard++;
      }
      if (guard >= 371) return null;

      // `interval` on a weekly rule means "every N weeks", so skip whole weeks
      // once the weekday has been found.
      next = interval > 1 ? addDays(cursor, 7 * (interval - 1)) : cursor;
      break;
    }

    default:
      return null;
  }

  if (ends?.type === 'on' && ends.date) {
    if (isAfter(next, fromISODate(ends.date))) return null;
  }

  return toISODate(next);
}

/**
 * Catches a rule up to the present.
 *
 * `on_missed` is the whole reason this exists. With `skip` (the default), a
 * daily to-do abandoned for three weeks produces exactly one row dated today,
 * not twenty-one dated backwards — which is the difference between picking a
 * habit back up and being presented with a wall of failure. With `rollover`
 * the caller keeps the first missed date instead, so the backlog is visible.
 */
export function nextOccurrenceFrom(
  recurrence: TodoRecurrence,
  from: string,
  today: string
): string | null {
  let candidate = nextOccurrence(recurrence, from);
  if (!candidate) return null;
  if (recurrence.on_missed === 'rollover') return candidate;

  // Skip: walk forward until the occurrence is no longer in the past. Bounded
  // so a malformed rule cannot spin here.
  let guard = 0;
  while (candidate && candidate < today && guard < 1000) {
    const following: string | null = nextOccurrence(recurrence, candidate);
    if (!following) return candidate;
    candidate = following;
    guard++;
  }
  return candidate;
}
