// Deploy-config guardrails for the Vercel static deployment.
// The game client is a no-build static site; the Colyseus/Node server cannot
// run on Vercel, so vercel.json must keep serving the repo root as-is.
// Run: node --test test/deploy.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const config = JSON.parse(read('vercel.json'));

test('vercel.json: no framework preset, repo root is the served output', () => {
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, '.');
});

test('vercel.json: build + install are no-ops (nothing to compile on Vercel)', () => {
  // A real build/install command would try to install the server-only Node
  // dependencies (colyseus, uWebSockets.js) on every deploy for no benefit.
  assert.match(config.buildCommand, /^echo /);
  assert.match(config.installCommand, /^echo /);
});

test('vercel.json: env.js and index.html are never cached', () => {
  const headersFor = (source) =>
    (config.headers.find((h) => h.source === source)?.headers ?? [])
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
  // env.js carries the runtime server URL: a stale copy would pin players to
  // a dead server, so it must revalidate on every load.
  assert.match(headersFor('/env.js')['Cache-Control'] ?? '', /no-store/);
  assert.match(headersFor('/index.html')['Cache-Control'] ?? '', /no-store/);
  assert.match(headersFor('/')['Cache-Control'] ?? '', /no-store/);
});

test('vercel.json: client modules revalidate, vendored libs stay immutable', () => {
  const headersFor = (source) =>
    (config.headers.find((h) => h.source === source)?.headers ?? [])
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
  assert.match(headersFor('/src/(.*)')['Cache-Control'] ?? '', /max-age=0/);
  assert.match(headersFor('/assets/vendor/(.*)')['Cache-Control'] ?? '', /immutable/);
});

test('vercel.json: security headers on every path', () => {
  const all = (config.headers.find((h) => h.source === '/(.*)')?.headers ?? [])
    .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {});
  assert.equal(all['X-Content-Type-Options'], 'nosniff');
  assert.ok(all['Referrer-Policy']);
  // No X-Frame-Options / frame-ancestors here: the client is meant to be
  // embeddable (previews, game portals) and has no server-side session.
  assert.equal(all['X-Frame-Options'], undefined);
});

test('.vercelignore: every pattern is root-anchored', () => {
  const patterns = read('.vercelignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  assert.ok(patterns.length > 0);
  for (const p of patterns) {
    // gitignore semantics: an un-anchored name matches at ANY depth. That is
    // how a bare `tools` took out src/tools/ (imported by NatureDressing.js)
    // and a bare `textures` took out assets/props/*/textures — the deployed
    // client then 404'd its module graph and died at boot.
    assert.ok(p.startsWith('/'), `pattern "${p}" must be root-anchored with a leading "/"`);
  }
});

test('.vercelignore: dev-only trees excluded, client trees never', () => {
  const patterns = read('.vercelignore')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  for (const entry of ['/node_modules', '/test', '/tools', '/data', '/docs']) {
    assert.ok(patterns.includes(entry), `${entry} should be excluded from the deploy`);
  }
  // The browser client loads everything under src/ and assets/ — including
  // src/server/{config,schema,movement} (offline LocalRoom) and the glTF
  // textures under assets/props/*/textures.
  for (const p of patterns) {
    assert.ok(!['/src', '/assets'].some((keep) => p === keep || keep.startsWith(p + '/')),
      `pattern "${p}" would exclude client files`);
    assert.ok(!p.startsWith('/src') && !p.startsWith('/assets'),
      `pattern "${p}" would exclude client files`);
  }
});

test('client import graph resolves (every relative import exists)', () => {
  const seen = new Set();
  const missing = [];
  const walk = (abs) => {
    if (seen.has(abs)) return;
    seen.add(abs);
    const src = readFileSync(abs, 'utf8');
    // static `import … from '…'` / `export … from '…'` + dynamic `import('…')`
    const specs = [
      ...src.matchAll(/(?:^|\s)(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g),
      ...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)
    ].map((m) => m[1]);
    for (const spec of specs) {
      if (!spec.startsWith('.')) continue; // importmap/CDN bare specifier
      const target = fileURLToPath(new URL(spec, `file://${abs}`));
      if (!existsSync(target)) missing.push(`${abs.slice(root.pathname.length)} -> ${spec}`);
      else walk(target);
    }
  };
  walk(fileURLToPath(new URL('src/main.js', root)));
  assert.deepEqual(missing, []);
  assert.ok(seen.size > 50, `expected a real module graph, walked ${seen.size} files`);
});

test('env.js: valid static boot config with no hardcoded server', () => {
  // Mirrors what the script tag in index.html evaluates.
  const sandbox = { window: {} };
  new Function('window', read('env.js'))(sandbox.window);
  const cfg = sandbox.window.__OPENGAME__;
  assert.equal(typeof cfg, 'object');
  assert.ok('wsUrl' in cfg, 'wsUrl key must exist (null = use the ?server=/local fallback chain)');
  assert.ok(cfg.wsUrl === null || /^wss?:\/\//.test(cfg.wsUrl),
    'wsUrl must be null or a ws(s):// URL');
});
