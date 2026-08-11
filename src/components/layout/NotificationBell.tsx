'use client';

import { useState, useEffect } from 'react';

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((data) => setCount(Array.isArray(data) ? data.filter((n: { is_read: boolean }) => !n.is_read).length : 0))
      .catch(() => {});
  }, []);

  return (
    <button
      className="relative w-8 h-8 flex items-center justify-center rounded-full hover:bg-bg-subtle transition-colors duration-120"
      aria-label="Notifications"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent-blue text-accent-ink text-[9px] font-semibold rounded-full flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
