// a11y-results.js — best-effort scrape of @storybook/addon-a11y violations.
//
// Strategy (returns the first source that yields data):
//   1. Storybook addons channel: look at cached results keyed by storyId or
//      the most recent `a11y/result` event payload, when accessible.
//   2. Direct axe-core run if `window.axe` is present in the iframe (the
//      addon-a11y bundle exposes it on recent versions).
//
// Contract: pure expression (IIFE), returns JSON-serializable value:
//   { available: boolean, violations: [{ id, impact, description, nodes }] }
//
// Never throws — exceptions fold into { available: false }.

(function () {
  try {
    const out = { available: false, violations: [] };

    // ---- 1. addons channel cache ----
    try {
      const ch =
        window.__STORYBOOK_ADDONS_CHANNEL__ ||
        (window.parent && window.parent.__STORYBOOK_ADDONS_CHANNEL__);
      if (ch) {
        // Some addon-a11y versions stash latest results on the channel via
        // `events[name]` last-emit cache; others expose `data`. Try both.
        const cache =
          (ch.events && (ch.events['a11y/result'] || ch.events['storybook/a11y/result'])) ||
          ch.data ||
          null;
        if (cache) {
          const raw = Array.isArray(cache) ? cache[cache.length - 1] : cache;
          const violations =
            (raw && raw.violations) ||
            (raw && raw.result && raw.result.violations) ||
            null;
          if (Array.isArray(violations)) {
            out.available = true;
            out.violations = violations.map(function (v) {
              return {
                id: v.id || '',
                impact: v.impact || 'minor',
                description: v.description || v.help || '',
                nodes: Array.isArray(v.nodes)
                  ? v.nodes.map(function (n) {
                      return {
                        target: n.target || [],
                        html: typeof n.html === 'string' ? n.html.slice(0, 500) : '',
                      };
                    })
                  : [],
              };
            });
            return out;
          }
        }
      }
    } catch (_e) {
      /* fall through */
    }

    // ---- 2. direct axe-core ----
    try {
      var axe = window.axe || (window.parent && window.parent.axe);
      if (axe && typeof axe.run === 'function') {
        // axe.run is async — wrap in a promise the eval caller can await
        // via batch envelope. Return the promise; agent-browser resolves it.
        return axe
          .run(document, {})
          .then(function (res) {
            return {
              available: true,
              violations: (res.violations || []).map(function (v) {
                return {
                  id: v.id || '',
                  impact: v.impact || 'minor',
                  description: v.description || v.help || '',
                  nodes: (v.nodes || []).map(function (n) {
                    return {
                      target: n.target || [],
                      html: typeof n.html === 'string' ? n.html.slice(0, 500) : '',
                    };
                  }),
                };
              }),
            };
          })
          .catch(function () {
            return { available: false, violations: [] };
          });
      }
    } catch (_e) {
      /* fall through */
    }

    return out;
  } catch (_e) {
    return { available: false, violations: [] };
  }
})()
