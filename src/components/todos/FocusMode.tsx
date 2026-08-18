'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatEstimate, formatTime, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { TodoCheckbox } from './TodoCheckbox';
import { CloseIcon } from './icons';
import { useTodos } from './TodoProvider';

/** A pomodoro, in seconds. The label says 25 minutes; this is the source of it. */
const SESSION_SECONDS = 25 * 60;

/**
 * Focus mode.
 *
 * One to-do, nothing else on screen. This is the "one thing at a time" half of
 * the ADHD brief and the reason the page has a Focus button at all: a list of
 * six is a decision, and the decision is the part that stalls. Picking the
 * next one automatically removes it.
 *
 * "Not this one" sends the current to-do to the back of the queue for this
 * session only — it does not reorder anything or mark it anywhere, because
 * skipping something should not cost you the thing itself.
 */
export function FocusMode({ onClose }: { onClose: () => void }) {
  const { groups, toggleComplete, announce } = useTodos();
  const today = todayISO();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  // Overdue first, then today's — the same order the list shows, so focus mode
  // never surfaces something the page did not appear to be offering.
  const queue = useMemo(() => {
    const candidates = [...groups.overdue, ...(groups.dated[today] || [])];
    const notSkipped = candidates.filter((t) => !skipped.includes(t.id));
    return notSkipped.length > 0 ? notSkipped : candidates;
  }, [groups.dated, groups.overdue, skipped, today]);

  const todo: Todo | undefined = queue[0];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!running || secondsLeft === null) return;
    if (secondsLeft <= 0) {
      setRunning(false);
      announce('Twenty-five minutes are up.');
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [announce, running, secondsLeft]);

  if (typeof document === 'undefined') return null;

  const total = queue.length;
  const elapsed = secondsLeft === null ? 0 : SESSION_SECONDS - secondsLeft;
  const progress = secondsLeft === null ? 0 : elapsed / SESSION_SECONDS;

  return createPortal(
    <div className="fixed inset-0 z-[140] bg-bg-base flex flex-col items-center justify-center gap-6 p-9 animate-fadeIn">
      <span className="absolute top-[18px] left-5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
        {todo ? `Focus · 1 of ${total}` : 'Focus'}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Leave focus mode"
        className="absolute top-4 right-5 text-text-muted hover:text-text-secondary transition-colors duration-120"
      >
        <CloseIcon size={16} strokeWidth={1.7} />
      </button>

      {!todo ? (
        <>
          <h2
            className="m-0 font-serif text-[30px] font-normal text-[color:var(--heading-color)] text-center"
            style={{ letterSpacing: '-0.015em' }}
          >
            Nothing left for today.
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-13 text-text-secondary border border-border-medium rounded-widget px-5 py-[11px]"
          >
            Back to the list
          </button>
        </>
      ) : (
        <>
          <p className="m-0 text-12 text-text-muted">Just this one. Everything else is put away.</p>

          <h2
            className="m-0 font-serif text-[30px] font-normal text-[color:var(--heading-color)] text-center max-w-[440px] leading-[1.28]"
            style={{ letterSpacing: '-0.015em' }}
          >
            {todo.title}
          </h2>

          <div className="flex gap-2 items-center flex-wrap justify-center">
            {todo.estimate_minutes && (
              <span className="font-mono text-10.5 text-text-secondary border border-border-default rounded-md px-2.5 py-1">
                {formatEstimate(todo.estimate_minutes)}
              </span>
            )}
            {todo.due_time && (
              <span className="text-11.5 text-accent-blue-dark bg-accent-blue-bg rounded-md px-2.5 py-1">
                due {formatTime(todo.due_time)}
              </span>
            )}
            {todo.space && (
              <span className="flex items-center gap-[5px] text-11.5 text-text-secondary">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: todo.space.color }}
                />
                {todo.space.name}
              </span>
            )}
          </div>

          {secondsLeft !== null && <TimerRing secondsLeft={secondsLeft} progress={progress} />}

          {(todo.subtasks?.length ?? 0) > 0 && secondsLeft === null && (
            <div className="flex flex-col gap-2 w-[340px] max-w-full">
              {todo.subtasks!.map((subtask, index) => {
                const isNext = !subtask.is_completed && !todo.subtasks!.slice(0, index).some((s) => !s.is_completed);
                return (
                  <div
                    key={subtask.id}
                    className={`flex items-center gap-2.5 rounded-widget px-3 py-2.5 ${
                      subtask.is_completed
                        ? 'border border-border-light bg-bg-surface'
                        : isNext
                        ? 'border-[1.5px] border-accent-blue'
                        : 'border border-border-light'
                    }`}
                  >
                    <TodoCheckbox
                      checked={subtask.is_completed}
                      onChange={() => toggleComplete(subtask.id)}
                      label={`Mark ${subtask.title} done`}
                      size={16}
                      radius={5}
                      tone={subtask.is_completed ? 'green' : 'accent'}
                    />
                    <span
                      className={`text-12.5 ${
                        subtask.is_completed ? 'text-text-muted line-through' : 'text-text-primary'
                      }`}
                    >
                      {subtask.title}
                    </span>
                    {isNext && (
                      <span className="ml-auto font-mono text-[9.5px] text-text-faint">up next</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-2.5 flex-wrap justify-center">
            {secondsLeft === null ? (
              <button
                type="button"
                onClick={() => {
                  setSecondsLeft(SESSION_SECONDS);
                  setRunning(true);
                }}
                className="text-13 text-accent-ink bg-accent-blue rounded-widget px-[22px] py-[11px] shadow-fab"
                style={{ fontWeight: 580 }}
              >
                Start 25 minutes
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setRunning((r) => !r)}
                className="text-13 text-text-secondary border border-border-medium rounded-widget px-5 py-[11px]"
              >
                {running ? 'Pause' : 'Resume'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                toggleComplete(todo.id);
                setSecondsLeft(null);
                setRunning(false);
              }}
              className="text-13 text-text-secondary border border-border-medium rounded-widget px-5 py-[11px]"
            >
              Mark done
            </button>
            <button
              type="button"
              onClick={() => {
                setSkipped((s) => [...s, todo.id]);
                setSecondsLeft(null);
                setRunning(false);
              }}
              className="text-13 text-text-secondary border border-border-medium rounded-widget px-5 py-[11px]"
            >
              Not this one
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

/** The 196px countdown ring the mobile design specifies; used on both. */
function TimerRing({ secondsLeft, progress }: { secondsLeft: number; progress: number }) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const RADIUS = 91;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  return (
    <div className="relative w-[196px] h-[196px] flex flex-col items-center justify-center">
      {/*
        An SVG arc rather than the border trick the mockup uses: a border can
        only show quarters, so it jumps in 25% steps while the countdown ticks
        every second.
      */}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 196 196" aria-hidden="true">
        <circle cx="98" cy="98" r={RADIUS} fill="none" stroke="var(--bg-elevated)" strokeWidth="7" />
        <circle
          cx="98"
          cy="98"
          r={RADIUS}
          fill="none"
          stroke="var(--accent-blue)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <span
        className="font-mono text-[32px] text-text-primary tabular-nums"
        style={{ letterSpacing: '-0.02em' }}
        role="timer"
        aria-live="off"
      >
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>
      <span className="text-11.5 text-text-muted">of 25 minutes</span>
    </div>
  );
}
