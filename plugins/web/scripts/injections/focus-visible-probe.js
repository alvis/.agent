// focus-visible-probe.js — synthesize keyboard focus on the primary
// interactive element and check `:focus-visible` matching.
//
// Strategy:
//   1. Pick primary element via selector cascade.
//   2. Dispatch a synthetic Tab keydown (some UAs use this signal to flip
//      the focus-visible heuristic).
//   3. Call `.focus({ focusVisible: true })` when supported (Firefox), else
//      plain `.focus()`.
//   4. Check `el.matches(':focus-visible')`.
//
// Contract: pure expression (IIFE), returns:
//   { focused: boolean, matches_focus_visible: boolean, selector_used: string|null }

(function () {
  const sels = [
    '[role=button]',
    'button',
    '[role=link]',
    'a',
    '[role=textbox]',
    'input',
    '[data-testid="root"]',
    '#storybook-root > *',
  ];

  let el = null;
  let used = null;
  for (let i = 0; i < sels.length; i++) {
    const s = sels[i];
    try {
      const found = document.querySelector(s);
      if (found) {
        el = found;
        used = s;
        break;
      }
    } catch (_e) {
      /* invalid selector — skip */
    }
  }

  if (!el) {
    return { focused: false, matches_focus_visible: false, selector_used: null };
  }

  // Synthetic Tab — primes UA heuristic that the latest input was keyboard.
  try {
    const tabDown = new KeyboardEvent('keydown', {
      key: 'Tab',
      code: 'Tab',
      keyCode: 9,
      which: 9,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(tabDown);
  } catch (_e) {
    /* best-effort */
  }

  let focused = false;
  try {
    // `focusVisible` option is honored by Firefox; ignored elsewhere.
    if (typeof el.focus === 'function') {
      try {
        el.focus({ focusVisible: true });
      } catch (_e) {
        el.focus();
      }
      focused = document.activeElement === el;
    }
  } catch (_e) {
    /* swallow */
  }

  let matches = false;
  try {
    matches = !!(el.matches && el.matches(':focus-visible'));
  } catch (_e) {
    /* selector unsupported in very old engines */
  }

  return {
    focused: focused,
    matches_focus_visible: matches,
    selector_used: used,
  };
})()
