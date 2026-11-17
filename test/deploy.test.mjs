// Deploy-config guardrails for the Vercel static deployment.
// The game client is a no-build static site; the Colyseus/Node server cannot
// run on Vercel, so vercel.json must keep serving the repo root as-is.
// Run: node --test test/deploy.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

test('.vercelignore: dev-only trees excluded, src/server kept', () => {
  const ignore = read('.vercelignore').split('\n').map((l) => l.trim());
  for (const entry of ['node_modules', 'test', 'tools', 'data']) {
    assert.ok(ignore.includes(entry), `${entry} should be excluded from the deploy`);
  }
  // The browser client imports src/server/{config,schema,movement}: excluding
  // it would break the offline (LocalRoom) path on the deployed site.
  assert.ok(!ignore.includes('src/server'), 'src/server must stay (client imports)');
  assert.ok(!ignore.includes('assets'), 'assets must stay');
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
