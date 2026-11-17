// Mobile/tablet render-quality decisions: device class → pixel-ratio ceiling,
// shadow-map size, and the adaptive (down-only) DPR ladder.
// Run: node --test test/renderQuality.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deviceClass, pickDpr, pickShadowMapSize, degradeDpr } from '../src/client/renderQuality.js';

test('deviceClass: a touchscreen laptop stays on the desktop budget', () => {
  // Windows/Surface class device: touch points + a fine pointer (trackpad/mouse).
  assert.equal(deviceClass({ coarsePointer: false, finePointer: true, maxTouchPoints: 10, minSide: 800 }), 'desktop');
  // No matchMedia support at all (finePointer unknown) still detects touch.
  assert.equal(deviceClass({ maxTouchPoints: 5, minSide: 800 }), 'tablet');
});

test('deviceClass: no touch → desktop, wide touch → tablet, small touch → phone', () => {
  assert.equal(deviceClass({ coarsePointer: false, maxTouchPoints: 0, minSide: 390 }), 'desktop');
  assert.equal(deviceClass({ coarsePointer: true, maxTouchPoints: 0, minSide: 390 }), 'phone');
  assert.equal(deviceClass({ coarsePointer: false, maxTouchPoints: 5, minSide: 820 }), 'tablet');
  assert.equal(deviceClass({ coarsePointer: false, maxTouchPoints: 5, minSide: 600 }), 'phone');
  assert.equal(deviceClass({ coarsePointer: false, maxTouchPoints: 5, minSide: 601 }), 'tablet');
});

test('deviceClass: tablet rotating to portrait stays a phone-sized short side', () => {
  // 1024×768 tablet: landscape short side 768 → tablet; portrait short side
  // 768 → still tablet. A 932×430 phone in landscape → 430 → phone.
  assert.equal(deviceClass({ coarsePointer: true, minSide: Math.min(1024, 768) }), 'tablet');
  assert.equal(deviceClass({ coarsePointer: true, minSide: Math.min(932, 430) }), 'phone');
});

test('pickDpr: desktop keeps the full cap, touch devices get the lower one', () => {
  assert.equal(pickDpr({ devicePixelRatio: 3, kind: 'desktop', dprMax: 2, dprMaxTouch: 1.5 }), 2);
  assert.equal(pickDpr({ devicePixelRatio: 3, kind: 'phone', dprMax: 2, dprMaxTouch: 1.5 }), 1.5);
  assert.equal(pickDpr({ devicePixelRatio: 3, kind: 'tablet', dprMax: 2, dprMaxTouch: 1.5 }), 1.5);
});

test('pickDpr: never upscales past the device ratio and never goes below 1', () => {
  assert.equal(pickDpr({ devicePixelRatio: 1, kind: 'desktop', dprMax: 2, dprMaxTouch: 1.5 }), 1);
  assert.equal(pickDpr({ devicePixelRatio: 1, kind: 'phone', dprMax: 2, dprMaxTouch: 1.5 }), 1);
  // Garbage input / missing ratio falls back to 1 (a 0 here would blank the canvas).
  assert.equal(pickDpr({ devicePixelRatio: 0, kind: 'phone', dprMax: 2, dprMaxTouch: 1.5 }), 1);
  assert.equal(pickDpr({ devicePixelRatio: NaN, kind: 'desktop', dprMax: 2, dprMaxTouch: 1.5 }), 1);
});

test('pickDpr: a touch cap above the desktop cap still respects dprMax', () => {
  assert.equal(pickDpr({ devicePixelRatio: 4, kind: 'phone', dprMax: 1.25, dprMaxTouch: 2 }), 1.25);
});

test('pickShadowMapSize: touch devices never exceed their smaller map', () => {
  assert.equal(pickShadowMapSize({ kind: 'desktop', shadowMapSize: 2048, shadowMapTouch: 1024 }), 2048);
  assert.equal(pickShadowMapSize({ kind: 'tablet', shadowMapSize: 2048, shadowMapTouch: 1024 }), 1024);
  assert.equal(pickShadowMapSize({ kind: 'phone', shadowMapSize: 2048, shadowMapTouch: 1024 }), 1024);
  // A server-configured map smaller than the touch budget is kept as-is.
  assert.equal(pickShadowMapSize({ kind: 'phone', shadowMapSize: 512, shadowMapTouch: 1024 }), 512);
});

test('degradeDpr: healthy frame rate is left alone', () => {
  assert.equal(degradeDpr(1.5, { avgFps: 60, threshold: 45 }), 1.5);
  assert.equal(degradeDpr(1.5, { avgFps: 45, threshold: 45 }), 1.5);
});

test('degradeDpr: low frame rate steps down by one notch', () => {
  assert.equal(degradeDpr(1.5, { avgFps: 31, threshold: 45, step: 0.25 }), 1.25);
  assert.equal(degradeDpr(1.25, { avgFps: 20, threshold: 45, step: 0.25 }), 1);
});

test('degradeDpr: floor stops the ladder and never steps up', () => {
  assert.equal(degradeDpr(1, { avgFps: 10, threshold: 45, step: 0.25, floor: 1 }), 1);
  assert.equal(degradeDpr(1.5, { avgFps: 90, threshold: 45, step: 0.25, floor: 1 }), 1.5);
  // Junk current ratio degrades to the floor instead of producing NaN.
  assert.equal(degradeDpr(NaN, { avgFps: 10, threshold: 45 }), 1);
});
