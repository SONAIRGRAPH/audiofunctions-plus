/**
 * Landmark hit geometry.
 *
 * Sonification uses X-crossing: the cursor navigates mainly along x, so "reached
 * this landmark" is whether the segment from the previous x to the current x
 * contains the landmark's x. That is zoom-proof and survives stepwise jumps that
 * never land inside a fixed radius.
 *
 * Creation / "already here?" checks still need a positional window; that window
 * scales with the visible range (and never thinner than half a step) so it stays
 * meaningful at every zoom level.
 */

/** Fraction of the visible range used as the positional "same spot" window. */
export const MATCH_RATIO = 0.004;
/** Absolute floor so tiny ranges and float noise do not collapse the window to 0. */
export const MATCH_FLOOR = 1e-9;

/** Cooldown between repeated earcons for the same landmark. */
export const LANDMARK_COOLDOWN_MS = 300;

export function landmarkWindows(bounds, stepSize = 0) {
  const xRange = Math.abs(bounds.xMax - bounds.xMin);
  const yRange = Math.abs(bounds.yMax - bounds.yMin);
  const minX = stepSize > 0 ? stepSize / 2 : 0;

  return {
    matchX: Math.max(xRange * MATCH_RATIO, minX, MATCH_FLOOR),
    matchY: Math.max(yRange * MATCH_RATIO, MATCH_FLOOR),
  };
}

/**
 * True when the cursor moved across (or landed on) the landmark's x.
 * Stationary frames (prevX === cursorX) never count, so sitting on a landmark
 * does not re-trigger.
 */
export function crossedLandmarkX(prevX, cursorX, landmarkX) {
  if (!Number.isFinite(prevX) || !Number.isFinite(cursorX) || !Number.isFinite(landmarkX)) {
    return false;
  }
  if (prevX === cursorX) return false;
  return (prevX - landmarkX) * (cursorX - landmarkX) <= 0;
}

/**
 * Positional "same spot" test used when creating or announcing landmarks.
 */
export function isNearLandmark(landmark, x, y, windows) {
  if (!landmark || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(landmark.x - x) < windows.matchX && Math.abs(landmark.y - y) < windows.matchY;
}

/**
 * Decide whether the landmark earcon should sound this frame.
 *
 * With a previous x: fire on an X-crossing.
 * Without one (first observation of this function): fire only if the cursor is
 * already inside the scaled match window, matching the old "already at landmark"
 * behaviour without a fixed radius.
 */
export function resolveLandmarkHit({ prevX, cursorX, landmarkX, matchX = MATCH_FLOOR }) {
  if (!Number.isFinite(cursorX) || !Number.isFinite(landmarkX)) {
    return { hit: false };
  }

  if (prevX === null || prevX === undefined || !Number.isFinite(prevX)) {
    return { hit: Math.abs(cursorX - landmarkX) <= matchX };
  }

  return { hit: crossedLandmarkX(prevX, cursorX, landmarkX) };
}
