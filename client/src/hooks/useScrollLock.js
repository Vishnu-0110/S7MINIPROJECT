import { useEffect } from "react";

let lockCount = 0;
let saved = null;

function lockDocument() {
  if (lockCount++ > 0) return;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  saved = {
    bodyOverflow: document.body.style.overflow,
    bodyPaddingRight: document.body.style.paddingRight,
    htmlOverflow: document.documentElement.style.overflow,
    appOverflow: document.querySelector(".app-main-scroll")?.style.overflow
  };
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  // The application uses an internal page scroller, so body locking alone
  // would still allow the page behind a drawer or dialog to move.
  const appScroller = document.querySelector(".app-main-scroll");
  if (appScroller) appScroller.style.overflow = "hidden";
  if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
}

function unlockDocument() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0 || !saved) return;
  document.documentElement.style.overflow = saved.htmlOverflow;
  document.body.style.overflow = saved.bodyOverflow;
  document.body.style.paddingRight = saved.bodyPaddingRight;
  const appScroller = document.querySelector(".app-main-scroll");
  if (appScroller) appScroller.style.overflow = saved.appOverflow;
  saved = null;
}

// Safe for drawers, dialogs, and nested overlays. Each mounted active overlay owns one lock.
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    lockDocument();
    return unlockDocument;
  }, [active]);
}
