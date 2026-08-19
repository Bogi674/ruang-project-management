/**
 * Which box is actually scrolling.
 *
 * Most screens in this app let the document scroll: the navbar and sidebar are
 * fixed, the page grows, the window scrollbar moves it. A few screens instead
 * fill the viewport exactly and scroll a region *inside* themselves, so their
 * own header stays put — the calendar has always worked that way, and `/todo`
 * now does too.
 *
 * Any code that scrolls something programmatically has to know which of the two
 * it is looking at. `PeriodView` anchors the scroll position when it prepends a
 * week, and the drag controller scrolls the list when the pointer reaches an
 * edge; both were written against `window` and both silently did nothing —
 * or the wrong thing — once the content moved into an inner scroller.
 *
 * A scroll region marks itself with `data-app-scroll` and everything below finds
 * it by walking up the tree. `null` means "the document is the scroller", which
 * is the right answer for every screen that has no such region.
 */

export const APP_SCROLL_ATTR = 'data-app-scroll';

/** The nearest marked scroll region above `el`, or null for the document. */
export function scrollHostFor(el: Element | null | undefined): HTMLElement | null {
  return el?.closest<HTMLElement>(`[${APP_SCROLL_ATTR}]`) ?? null;
}

/**
 * The nearest scrollable box above `el` — marked or not.
 *
 * Used by the drag auto-scroll, which has to cope with boxes nobody marked: a
 * calendar day cell, the Anytime column, the unscheduled tray. An element
 * counts only if it can actually scroll, so a `overflow-hidden` wrapper in the
 * chain is skipped rather than swallowing the gesture.
 */
export function scrollableAncestor(el: Element | null | undefined): HTMLElement | null {
  let node: Element | null = el ?? null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node instanceof HTMLElement && canScrollVertically(node)) return node;
    node = node.parentElement;
  }
  return null;
}

function canScrollVertically(el: HTMLElement): boolean {
  if (el.scrollHeight <= el.clientHeight + 1) return false;
  const overflow = getComputedStyle(el).overflowY;
  return overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay';
}

/** Current offset of the host, or of the document when host is null. */
export function scrollTopOf(host: HTMLElement | null): number {
  if (host) return host.scrollTop;
  return window.scrollY || document.documentElement.scrollTop;
}

/** Full scrollable height of the host, or of the document when host is null. */
export function scrollHeightOf(host: HTMLElement | null): number {
  return host ? host.scrollHeight : document.documentElement.scrollHeight;
}

/**
 * Move the host by `delta` pixels, never animated.
 *
 * `behavior: 'instant'` is the point of this function existing. A stylesheet
 * that sets `scroll-behavior: smooth` turns every programmatic scroll into an
 * animation, and an animated correction is useless for anchoring: the offset it
 * is meant to restore stays wrong for the length of the animation, which is
 * long enough for whatever triggered the correction to trigger again.
 */
export function scrollHostBy(host: HTMLElement | null, delta: number): void {
  if (!delta) return;
  const target = host ?? window;
  target.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior });
}
