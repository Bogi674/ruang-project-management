'use client';

import { useEffect } from 'react';

/**
 * Tracks how much of the viewport the on-screen keyboard is covering and
 * publishes it as `--kb-inset` on <html>, plus a `data-keyboard` attribute.
 *
 * Why this is needed at all: on iOS (Safari and, more importantly here, a
 * standalone PWA) opening the keyboard does **not** change `window.innerHeight`
 * and does not resize the layout viewport. It only shrinks the *visual*
 * viewport. A `position: fixed; bottom: 0` bar therefore stays pinned to the
 * bottom of the layout viewport — underneath the keyboard, where it cannot be
 * seen or tapped. The only way to dock something above the keyboard on the web
 * is to measure the difference and offset the element by it.
 *
 *   keyboard height = layout viewport height − (visual height + visual offset)
 *
 * `offsetTop` matters while the page is scrolled with the keyboard up: iOS
 * slides the visual viewport within the layout viewport rather than scrolling
 * the document, and without that term the bar drifts away from the keyboard.
 *
 * The value is written straight to the DOM rather than held in React state on
 * purpose — this fires on every scroll frame while the keyboard animates, and
 * re-rendering the toolbar that often makes the bar lag behind the keyboard.
 *
 * Browsers without `visualViewport` (and desktop generally) simply keep an
 * inset of 0, which is the correct answer there.
 */
export function useKeyboardInset(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    const vv = window.visualViewport;

    function clear() {
      root.style.setProperty('--kb-inset', '0px');
      root.removeAttribute('data-keyboard');
    }

    if (!vv) {
      clear();
      return;
    }

    let frame = 0;

    function measure() {
      frame = 0;
      const viewport = window.visualViewport;
      if (!viewport) return;

      const inset = Math.round(
        document.documentElement.clientHeight - (viewport.height + viewport.offsetTop)
      );
      // A few pixels of drift show up during rubber-band scrolling and while
      // the URL bar collapses; anything under this threshold is not a keyboard.
      const open = inset > 80;

      document.documentElement.style.setProperty('--kb-inset', `${open ? inset : 0}px`);
      if (open) document.documentElement.setAttribute('data-keyboard', 'open');
      else document.documentElement.removeAttribute('data-keyboard');
    }

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    }

    measure();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    window.addEventListener('orientationchange', schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      window.removeEventListener('orientationchange', schedule);
      clear();
    };
  }, [enabled]);
}
