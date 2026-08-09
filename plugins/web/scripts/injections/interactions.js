// interactions.js — scrape @storybook/addon-interactions run state.
//
// Reads the instrumenter state from `window.__STORYBOOK_INSTRUMENTER_STATE__`
// (the addon's public-ish hook). Returns each call/step with normalized
// status. A run with at least one `done`/`error` call is considered to have
// executed.
//
// Contract: pure expression (IIFE), returns JSON-serializable value:
//   { available: boolean, runs: [{ name, status, exception? }] }
//
// Status mapping:
//   - 'error'  → 'failed'
//   - 'done'   → 'passed'
//   - 'active' → 'running'
//   - other    → 'unknown'

(function () {
  try {
    const state =
      window.__STORYBOOK_INSTRUMENTER_STATE__ ||
      (window.parent && window.parent.__STORYBOOK_INSTRUMENTER_STATE__) ||
      null;

    if (!state) {
      return { available: false, runs: [] };
    }

    // The state can be keyed by storyId or be a flat object on legacy
    // versions. Flatten the calls/calls-by-story to a single list.
    let calls = [];
    if (Array.isArray(state.calls)) {
      calls = state.calls;
    } else if (state.calls && typeof state.calls === 'object') {
      Object.keys(state.calls).forEach(function (k) {
        const v = state.calls[k];
        if (Array.isArray(v)) calls = calls.concat(v);
      });
    } else if (state.callsByStory && typeof state.callsByStory === 'object') {
      Object.keys(state.callsByStory).forEach(function (k) {
        const v = state.callsByStory[k];
        if (Array.isArray(v)) calls = calls.concat(v);
      });
    }

    const mapStatus = function (s) {
      if (s === 'error') return 'failed';
      if (s === 'done') return 'passed';
      if (s === 'active' || s === 'waiting') return 'running';
      return s || 'unknown';
    };

    const runs = calls.map(function (c) {
      const name = c.method
        ? (c.path && c.path.length ? c.path.join('.') + '.' : '') + c.method
        : c.id || '<call>';
      const status = mapStatus(c.status);
      const out = { name: name, status: status };
      if (status === 'failed' && c.exception) {
        out.exception =
          (c.exception && (c.exception.message || c.exception.name)) ||
          String(c.exception);
      }
      return out;
    });

    return { available: true, runs: runs };
  } catch (_e) {
    return { available: false, runs: [] };
  }
})()
