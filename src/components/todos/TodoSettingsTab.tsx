'use client';

import { resolveTodoPreferences, TODO_DEFAULTS } from '@/lib/todos';
import type { PreferenceSaveError, UserPreferences } from '@/lib/preferences';
import type { SubtaskMode, TodoAssignment, TodoDoneBehavior } from '@/types';

/**
 * Settings › To-do.
 *
 * Every switch here exists because the same behaviour helps one person and
 * hinders another: a streak motivates until the day it breaks, a Today cap
 * protects until you actually do have nine things to do. The defaults are the
 * gentler option in each pair, and none of them is load-bearing.
 */
export function TodoSettingsTab({
  preferences,
  updatePreferences,
  saveError,
}: {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  saveError: PreferenceSaveError | null;
}) {
  const prefs = resolveTodoPreferences(preferences as unknown as Record<string, unknown>);

  return (
    <div className="space-y-8">
      <Section title="New to-dos">
        <Row
          label="A new to-do lands on"
          hint="Applies to quick-add and the + button alike"
          error={saveError}
          field="todo_default_assignment"
        >
          <Segmented<TodoAssignment>
            name="Default assignment"
            value={prefs.assignment}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'unassigned', label: 'Anytime' },
            ]}
            onChange={(todo_default_assignment) => updatePreferences({ todo_default_assignment })}
          />
        </Row>
      </Section>

      <Divider />

      <Section title="When something is done">
        <Row
          label="Completed to-dos"
          hint="Staying in place keeps the day's evidence visible"
          error={saveError}
          field="todo_done_behavior"
        >
          <Segmented<TodoDoneBehavior>
            name="Done behaviour"
            value={prefs.doneBehavior}
            options={[
              { value: 'stay', label: 'Stay in place' },
              { value: 'section', label: 'Move to Done' },
            ]}
            onChange={(todo_done_behavior) => updatePreferences({ todo_done_behavior })}
          />
        </Row>
      </Section>

      <Divider />

      <Section title="Sub-tasks">
        <Row
          label="Default completion mode"
          hint="Independent lets you tick the parent whenever you like"
          error={saveError}
          field="todo_subtask_mode"
        >
          <Segmented<SubtaskMode>
            name="Sub-task mode"
            value={prefs.subtaskMode}
            options={[
              { value: 'independent', label: 'Independent' },
              { value: 'dependent', label: 'Dependent' },
            ]}
            onChange={(todo_subtask_mode) => updatePreferences({ todo_subtask_mode })}
          />
        </Row>
      </Section>

      <Divider />

      <Section title="Keeping momentum">
        <Row label="Show time estimates" error={saveError} field="todo_show_estimates">
          <Toggle
            label="Show time estimates"
            on={prefs.showEstimates}
            onChange={(todo_show_estimates) => updatePreferences({ todo_show_estimates })}
          />
        </Row>

        <Row label="Show progress bar and streak" error={saveError} field="todo_show_progress">
          <Toggle
            label="Show progress bar and streak"
            on={prefs.showProgress}
            onChange={(todo_show_progress) => updatePreferences({ todo_show_progress })}
          />
        </Row>

        <Row
          label="Cap Today at 6 visible to-dos"
          hint="The rest fold behind “show more” until you ask"
          error={saveError}
          field="todo_today_cap"
        >
          <Toggle
            label="Cap Today at 6 visible to-dos"
            on={prefs.todayCap !== null}
            // The column is an int so the cap can move later without another
            // migration; null is "no cap" because the CHECK allows 1–50 only.
            onChange={(on) =>
              updatePreferences({ todo_today_cap: on ? TODO_DEFAULTS.todayCap : null })
            }
          />
        </Row>

        <Row
          label="Roll unfinished to-dos into tomorrow"
          hint="Yesterday's leftovers move to today rather than piling up as overdue"
          error={saveError}
          field="todo_rollover"
        >
          <Toggle
            label="Roll unfinished to-dos into tomorrow"
            on={prefs.rollover}
            onChange={(todo_rollover) => updatePreferences({ todo_rollover })}
          />
        </Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-4">
        {title}
      </p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px bg-border-light" />;
}

/**
 * A label/control row.
 *
 * The rejection notice sits inside the row rather than at the top of the tab:
 * a banner 600px away from the control that failed reads as a setting that
 * unselects itself for no reason — the reasoning `SaveErrorNote` was added for
 * on the Appearance tab.
 */
function Row({
  label,
  hint,
  error,
  field,
  children,
}: {
  label: string;
  hint?: string;
  error: PreferenceSaveError | null;
  field: string;
  children: React.ReactNode;
}) {
  const failed = error && error.fields.includes(field);
  return (
    <div>
      <div className="flex items-center gap-3.5">
        <div className="flex-1 flex flex-col gap-0.5">
          <span className="text-[13px] text-text-primary">{label}</span>
          {hint && <span className="text-[11.5px] text-text-muted">{hint}</span>}
        </div>
        {children}
      </div>
      {failed && (
        <p
          role="alert"
          className="mt-2 text-[12.5px] text-danger bg-danger-bg border border-danger-border rounded-[10px] px-3 py-2"
        >
          {error!.message}
        </p>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex bg-bg-subtle rounded-btn p-[3px] flex-shrink-0">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={`px-[13px] py-[5px] text-[12px] rounded-md transition-colors duration-120 ${
              active ? 'bg-bg-base text-text-primary shadow-card' : 'text-text-secondary'
            }`}
            style={{ fontWeight: active ? 580 : 400 }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** 36×21 track, 16px knob — a real checkbox underneath, for keyboard and AT. */
function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="relative inline-flex items-center flex-shrink-0 cursor-pointer">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="w-9 h-[21px] rounded-full relative transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-blue peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-base"
        style={{ background: on ? 'var(--accent-blue)' : 'var(--border-default)' }}
      >
        <span
          className="absolute top-[2.5px] w-4 h-4 rounded-full bg-bg-base transition-all duration-150"
          style={{
            left: on ? 'calc(100% - 18.5px)' : '2.5px',
            boxShadow: '0 1px 3px rgba(44,56,72,.2)',
          }}
        />
      </span>
    </label>
  );
}
