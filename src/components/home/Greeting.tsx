'use client';

import { useState, useEffect } from 'react';
import { formatDate, getDayGreeting } from '@/lib/utils';

interface GreetingProps {
  name: string;
  /** Server-rendered values, used only for the first paint so hydration matches. */
  initialGreeting: string;
  initialDate: string;
}

/**
 * The greeting and date line must follow the *reader's* clock. Rendering them
 * on the server used the deploy region's timezone, so "Good afternoon" showed
 * up at nearly midnight in Jakarta. The server values are kept for the first
 * paint (so hydration is clean) and corrected to local time on mount.
 */
export function Greeting({ name, initialGreeting, initialDate }: GreetingProps) {
  const [greeting, setGreeting] = useState(initialGreeting);
  const [dateLine, setDateLine] = useState(initialDate);

  useEffect(() => {
    function sync() {
      setGreeting(getDayGreeting());
      setDateLine(formatDate(new Date().toISOString()));
    }
    sync();

    // Re-check on the hour so a session left open overnight does not keep
    // greeting the user with yesterday's part of day.
    const now = new Date();
    const msToNextHour =
      (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds();
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      sync();
      interval = setInterval(sync, 3_600_000);
    }, Math.max(1000, msToNextHour));

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="mb-7 md:mb-8">
      <h1
        className="font-serif text-[24px] md:text-[26px] text-text-primary leading-snug"
        style={{ letterSpacing: '-0.025em' }}
      >
        {greeting}, {name}.
      </h1>
      <p className="text-12 text-text-faint mt-1">{dateLine}</p>
    </div>
  );
}
