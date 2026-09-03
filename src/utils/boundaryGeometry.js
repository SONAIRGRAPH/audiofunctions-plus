/**
 * Geometry of the chart borders.
 *
 * Every window is a fraction of the currently visible range, so detection behaves
 * identically at any zoom level. The ordering
 *
 *   INSET_RATIO < ENTER_RATIO < EXIT_RATIO
 *
 * is load bearing: a cursor parked at the clamp inset must always fall inside the
 * enter window, otherwise the border earcon can never fire. See
 * boundaryGeometry.test.js, which asserts this across the whole zoom range.
 */

/** Where the cursor is parked once it can no longer move outwards. */
export const INSET_RATIO = 0.001;
/** Distance from an edge at which the cursor counts as having reached it. */
export const ENTER_RATIO = 0.004;
/** Wider window used to release the edge, to stop it flickering on and off. */
export const EXIT_RATIO = 0.01;

/** Cadence at which the earcon repeats while the user keeps pushing outwards. */
export const BORDER_REPEAT_MS = 250;

export function boundaryWindows(bounds) {
  const xRange = bounds.xMax - bounds.xMin;
  const yRange = bounds.yMax - bounds.yMin;

  return {
    insetX: xRange * INSET_RATIO,
    enterX: xRange * ENTER_RATIO,
    exitX: xRange * EXIT_RATIO,
    insetY: yRange * INSET_RATIO,
    enterY: yRange * ENTER_RATIO,
    exitY: yRange * EXIT_RATIO,
  };
}

/**
 * Keep x inside the chart. `blocked` is the edge the caller tried to cross, which
 * makes "the user hit the border" an exact fact rather than a threshold guess.
 */
export function clampX(requestedX, bounds) {
  if (!Number.isFinite(requestedX)) {
    return { x: requestedX, blocked: null };
  }

  const { insetX } = boundaryWindows(bounds);
  const lo = bounds.xMin + insetX;
  const hi = bounds.xMax - insetX;

  if (requestedX < lo) return { x: lo, blocked: "left" };
  if (requestedX > hi) return { x: hi, blocked: "right" };
  return { x: requestedX, blocked: null };
}

/**
 * Which horizontal edge the cursor currently occupies, if any. Passing the
 * previously reported edge applies the hysteresis.
 */
export function horizontalEdge(x, bounds, previousEdge = null) {
  if (!Number.isFinite(x)) return null;

  const { enterX, exitX } = boundaryWindows(bounds);
  const leftWindow = previousEdge === "left" ? exitX : enterX;
  const rightWindow = previousEdge === "right" ? exitX : enterX;

  if (x <= bounds.xMin + leftWindow) return "left";
  if (x >= bounds.xMax - rightWindow) return "right";
  return null;
}

/**
 * Decide whether the border earcon should sound this frame.
 *
 * It sounds when an edge is first reached, and again on a fixed cadence while the
 * user keeps requesting a position beyond it. Reaching a different edge always
 * sounds immediately, so jumping from one side to the other is never swallowed.
 */
export function resolveBorderEvent({
  previousEdge,
  edge,
  blocked,
  now,
  lastPlayedAt,
  repeatMs = BORDER_REPEAT_MS,
}) {
  const entered = edge !== null && edge !== previousEdge;
  const pushing = blocked !== null && blocked === edge;
  const repeated = pushing && (!lastPlayedAt || now - lastPlayedAt >= repeatMs);

  return { play: entered || repeated, edge };
}
