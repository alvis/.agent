/**
 * story-index.js -- Storybook in-page story enumerator.
 *
 * This file is a single JavaScript EXPRESSION (an IIFE that returns a value).
 * It is consumed by `list-stories.sh` and pasted into agent-browser's
 * `eval` argument. No top-level statements -- the entire payload evaluates
 * to a JSON-serializable array of:
 *
 *   { id, title, name, importPath, tags }
 *
 * Resolution order:
 *   1. Storybook v7+ -- window.__STORYBOOK_PREVIEW__.storyStore.storyIndex
 *      (preferred; matches the shape served by /index.json).
 *   2. Storybook v7+ -- window.__STORYBOOK_PREVIEW__.storyStoreValue.storyIndex
 *      (older 7.x builds).
 *   3. Storybook v6  -- window.__STORYBOOK_STORY_STORE__.extract()
 *      (returns { <id>: { id, kind, name, ... } }).
 *   4. Storybook v6 manager -- window.__STORYBOOK_CLIENT_API__.raw()
 *      (returns an array of { id, kind, name, ... }).
 *   5. Fallback: empty array.
 *
 * The expression intentionally swallows errors per branch so a missing or
 * mid-initialization Storybook instance still resolves to []. Callers should
 * treat an empty array as "fall back to HTTP /index.json or fail loudly".
 */
(function () {
  function normalize(entry) {
    return {
      id: (entry && entry.id) || '',
      title: (entry && (entry.title || entry.kind)) || '',
      name: (entry && entry.name) || '',
      importPath:
        (entry && (entry.importPath || (entry.parameters && entry.parameters.fileName))) || '',
      tags: (entry && entry.tags) || []
    };
  }

  function fromIndexEntries(entries) {
    var out = [];
    if (!entries || typeof entries !== 'object') return out;
    var keys = Object.keys(entries);
    for (var i = 0; i < keys.length; i++) {
      var v = entries[keys[i]];
      if (!v) continue;
      if (v.type && v.type !== 'story') continue;
      out.push(normalize(v));
    }
    return out;
  }

  // 1. Storybook v7+ canonical preview API.
  try {
    var preview = window.__STORYBOOK_PREVIEW__;
    if (preview) {
      var store =
        (preview.storyStore && preview.storyStore.storyIndex) ||
        (preview.storyStoreValue && preview.storyStoreValue.storyIndex) ||
        null;
      if (store && store.entries) {
        var v7 = fromIndexEntries(store.entries);
        if (v7.length) return v7;
      }
      // Some 7.x builds expose extract() directly.
      if (preview.storyStore && typeof preview.storyStore.extract === 'function') {
        var extracted = preview.storyStore.extract();
        var v7b = fromIndexEntries(extracted);
        if (v7b.length) return v7b;
      }
    }
  } catch (_) {
    /* fall through */
  }

  // 2. Storybook v6 story store.
  try {
    var legacyStore = window.__STORYBOOK_STORY_STORE__;
    if (legacyStore && typeof legacyStore.extract === 'function') {
      var v6 = fromIndexEntries(legacyStore.extract());
      if (v6.length) return v6;
    }
  } catch (_) {
    /* fall through */
  }

  // 3. Storybook v6 manager API.
  try {
    var clientApi = window.__STORYBOOK_CLIENT_API__;
    if (clientApi && typeof clientApi.raw === 'function') {
      var rows = clientApi.raw() || [];
      var out = [];
      for (var i = 0; i < rows.length; i++) out.push(normalize(rows[i]));
      if (out.length) return out;
    }
  } catch (_) {
    /* fall through */
  }

  return [];
})()
