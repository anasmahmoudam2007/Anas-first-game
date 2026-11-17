/**
 * Render-quality decisions for the three form factors the game ships to:
 * desktop, tablet and phone.  Pure functions with no DOM / three.js access, so
 * they are unit-tested in Node (test/renderQuality.test.mjs) — GameScene only
 * feeds in the measured values and applies the result.
 *
 * Why this exists: a phone reports devicePixelRatio 3 and a ~400 CSS-px wide
 * viewport.  Rendering that at 3x on a mobile GPU is ~9x the fill rate of a
 * 1080p desktop frame, which is the single most common cause of "the game
 * stutters on my phone" — so phones/tablets get a lower DPR ceiling and a
 * smaller shadow map, then step further down if the measured frame rate stays
 * low (degradeDpr).
 */

/** 'desktop' | 'tablet' | 'phone' — coarse pointer/touch capability decides
 *  touch vs desktop; the shorter viewport side splits tablet from phone
 *  (phones are ≤ 600 CSS px on their short side, even in landscape).
 *  `finePointer` (CSS `any-pointer: fine`) keeps touchscreen laptops on the
 *  desktop budget: they report touch points but play with a mouse. */
export function deviceClass({
  coarsePointer = false,
  finePointer = false,
  maxTouchPoints = 0,
  minSide = 1024
} = {}) {
  const touch = coarsePointer === true || (maxTouchPoints > 0 && finePointer !== true);
  if (!touch) return 'desktop';
  return minSide <= 600 ? 'phone' : 'tablet';
}

/** Pixel-ratio ceiling for the class.  Desktop keeps the full cap; touch
 *  devices are capped lower because their GPUs are fill-rate bound. */
export function pickDpr({
  devicePixelRatio = 1,
  kind = 'desktop',
  dprMax = 2,
  dprMaxTouch = 1.5
} = {}) {
  const cap = kind === 'desktop' ? dprMax : Math.min(dprMax, dprMaxTouch);
  const dpr = Math.min(Number(devicePixelRatio) || 1, cap);
  return Math.max(1, Math.round(dpr * 100) / 100);
}

/** Shadow-map resolution for the class (a 2048² depth map costs real mobile
 *  GPU time for very little visible gain on a 6" screen). */
export function pickShadowMapSize({
  kind = 'desktop',
  shadowMapSize = 2048,
  shadowMapTouch = 1024
} = {}) {
  if (kind === 'desktop') return shadowMapSize;
  return Math.min(shadowMapSize, shadowMapTouch);
}

/**
 * One downward step of the adaptive-quality ladder.  Called with a measured
 * average frame rate every few seconds; returns `current` when the device is
 * healthy (or already at the floor) so callers can cheaply compare.
 * Down-only on purpose: stepping back up oscillates between "fine" and
 * "stuttering" on thermally-throttled phones.
 */
export function degradeDpr(current, { avgFps = 60, threshold = 45, step = 0.25, floor = 1 } = {}) {
  const cur = Number(current) || 1;
  if (avgFps >= threshold) return cur;
  const next = Math.max(floor, Math.round((cur - step) * 100) / 100);
  return next < cur ? next : cur;
}
