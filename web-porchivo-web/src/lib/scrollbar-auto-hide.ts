/**
 * Auto-hiding scrollbar controller.
 *
 * Adds a `scrolling` class to <html> while the user is actively scrolling
 * and removes it ~600ms after scrolling stops. The CSS in index.css uses
 * this class to fade the scrollbar thumb opacity between 0 (hidden) and
 * a visible semi-transparent color.
 *
 * Uses capture-phase listeners so scroll events from any nested scrollable
 * container are caught, not just window. Also listens for `wheel` and
 * `touchmove` so the bar appears instantly when the user initiates a scroll
 * gesture, before the first `scroll` event fires.
 */

const SCROLL_CLASS = "scrolling";
const HIDE_DELAY = 600;

let hideTimer: ReturnType<typeof setTimeout> | undefined;

function showScrollbar(): void {
  document.documentElement.classList.add(SCROLL_CLASS);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    document.documentElement.classList.remove(SCROLL_CLASS);
  }, HIDE_DELAY);
}

export function initScrollbarAutoHide(): void {
  // Capture phase catches scroll events from all nested scroll containers.
  window.addEventListener("scroll", showScrollbar, { passive: true, capture: true });
  // Show the bar the instant the user starts a wheel/touch gesture.
  window.addEventListener("wheel", showScrollbar, { passive: true, capture: true });
  window.addEventListener("touchmove", showScrollbar, { passive: true, capture: true });
}
