'use strict';
/* Pre-seals the small WebP "plates" of the cabinet in memory so the self-hosted
   server can answer the first paint without touching the disk on every request.

   Contract used by serve.mjs:
     const sealed = sparsePlates(root);
     sealed.has(name)  -> true only for an /assets plate that exists on disk
     sealed.get(name)  -> Buffer of that plate

   It is deliberately *sparse*: only plates up to BUDGET bytes are held in RAM.
   Anything larger (or non-WebP) is left on disk and streamed by serve.mjs, so
   the process never pins the whole artwork folder. */

const fs = require('node:fs');
const path = require('node:path');

const BUDGET = 24 * 1024 * 1024;

function sparsePlates(root, { budget = BUDGET, dir = 'assets' } = {}) {
  const base = path.join(root, dir);
  let names = [];
  try {
    names = fs.readdirSync(base).filter(name => name.toLowerCase().endsWith('.webp'));
  } catch {
    names = [];
  }

  const keep = new Set();
  let held = 0;
  const ordered = names.slice().sort((a, b) => {
    const stat = n => {
      try { return fs.statSync(path.join(base, n)).size; } catch { return 0; }
    };
    return stat(a) - stat(b);
  });
  for (const name of ordered) {
    let size = 0;
    try { size = fs.statSync(path.join(base, name)).size; } catch { continue; }
    if (held + size > budget) continue;
    keep.add(name);
    held += size;
  }

  const cache = new Map();
  const api = {
    has(name) {
      const key = String(name || '').replace(/^\/+/, '');
      if (!keep.has(key)) return false;
      if (!cache.has(key)) {
        try { cache.set(key, fs.readFileSync(path.join(base, key))); } catch { return false; }
      }
      return true;
    },
    get(name) {
      const key = String(name || '').replace(/^\/+/, '');
      if (!api.has(key)) return undefined;
      return cache.get(key);
    },
    get size() { return cache.size; },
    get budget() { return budget; },
    get held() {
      let n = 0;
      for (const buf of cache.values()) n += buf.length;
      return n;
    }
  };
  return api;
}

module.exports = sparsePlates;
module.exports.sparsePlates = sparsePlates;
module.exports.BUDGET = BUDGET;
