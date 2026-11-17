// Responsive/mobile guardrails for index.html.
// The client is plain HTML + CSS (no framework, no build), so the phone and
// tablet layout lives entirely in this one file — these assertions keep the
// pieces that make it playable (viewport meta, breakpoints, touch behaviour,
// safe-area insets) from being dropped in a later edit.
// Run: node --test test/responsive.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));

test('viewport meta: device width, no zoom jump, notch-aware', () => {
  const meta = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';
  assert.match(meta, /width=device-width/);
  assert.match(meta, /viewport-fit=cover/, 'safe-area insets need viewport-fit=cover');
  assert.match(meta, /user-scalable=no/);
});

test('breakpoints: tablet (≤1024px) and phone (≤600px) layouts exist', () => {
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  // Phones on their side have almost no vertical room — separate pass.
  assert.match(css, /@media \(orientation: landscape\) and \(max-height: 520px\)/);
});

test('touch devices: no pull-to-refresh, zoom or long-press interference', () => {
  assert.match(css, /overscroll-behavior: none/, 'pull-to-refresh must be disabled');
  assert.match(css, /#game \{[^}]*touch-action: none/, 'canvas must not pan/zoom');
  assert.match(css, /@media \(pointer: coarse\)/);
  // <16px input text makes iOS Safari zoom the page on focus.
  assert.match(css, /#login input \{ font-size: 16px; \}/);
});

test('safe-area insets on the HUD and touch controls', () => {
  assert.match(css, /#hud \{[^}]*env\(safe-area-inset-top/);
  assert.match(css, /#leaderboard \{[^}]*env\(safe-area-inset-right/);
  assert.match(css, /#tc-buttons \{[^}]*env\(safe-area-inset-bottom/);
});

test('display-only HUD never swallows joystick touches', () => {
  assert.match(css, /#hud \{[^}]*pointer-events: none/);
  assert.match(css, /#leaderboard \{[^}]*pointer-events: none/);
});

test('phone layout keeps the touch controls reachable and the overlays scrollable', () => {
  const phone = css.slice(css.indexOf('@media (max-width: 600px)'));
  assert.match(phone, /#tc-stick-zone \{[^}]*height/, 'joystick zone sized for thumbs');
  assert.match(phone, /\.tc-btn-primary \{\s*width: 72px/, 'primary action stays a large tap target');
  assert.match(phone, /overflow-y: auto/, 'login/upgrade overlays must scroll on small screens');
  assert.match(phone, /#login \.card \{[^}]*width: min\(94vw/, 'login card must fit a 320px phone');
  assert.match(phone, /\.up-card, \.shop-card \{[^}]*flex: 1 1/, 'upgrade cards share one row');
});

test('touch controls are wired (floating joystick + three actions + mute)', () => {
  const touch = readFileSync(new URL('src/ui/TouchControls.js', root), 'utf8');
  for (const id of ['tc-stick-zone', 'tc-block', 'tc-attack', 'tc-skill', 'tc-mute']) {
    assert.match(touch, new RegExp(`id=\"${id}\"`), `${id} must exist in the overlay markup`);
    assert.match(css, new RegExp(`#${id}\\b|\\.tc-btn\\b`), `${id} must be styled`);
  }
  // Touch is auto-detected (coarse pointer / touch points) and can be forced
  // for desktop testing with ?touch=1.
  assert.match(touch, /pointer: coarse/);
  assert.match(touch, /touch=1/);
});
