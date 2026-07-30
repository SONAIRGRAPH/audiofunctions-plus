import { describe, expect, it } from "vitest";
import {
  LANDMARK_COOLDOWN_MS,
  MATCH_FLOOR,
  MATCH_RATIO,
  crossedLandmarkX,
  isNearLandmark,
  landmarkWindows,
  resolveLandmarkHit,
} from "./landmarkGeometry";

const views = [
  { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  { xMin: -50, xMax: 50, yMin: -50, yMax: 50 },
  { xMin: -0.05, xMax: 0.05, yMin: -0.05, yMax: 0.05 },
  { xMin: 1000, xMax: 1000.1, yMin: -3, yMax: 3 },
  { xMin: -1.234, xMax: 23.456, yMin: -99, yMax: 1 },
];

describe("landmarkWindows", () => {
  it.each(views)("scales with the visible range for %o", (bounds) => {
    const { matchX, matchY } = landmarkWindows(bounds);
    const xRange = bounds.xMax - bounds.xMin;
    const yRange = bounds.yMax - bounds.yMin;

    expect(matchX).toBeGreaterThanOrEqual(xRange * MATCH_RATIO);
    expect(matchY).toBeGreaterThanOrEqual(yRange * MATCH_RATIO);
    expect(matchX).toBeGreaterThanOrEqual(MATCH_FLOOR);
  });

  it("never makes the X window thinner than half a step", () => {
    const bounds = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
    const { matchX } = landmarkWindows(bounds, 0.25);
    expect(matchX).toBeGreaterThanOrEqual(0.125);
  });
});

describe("crossedLandmarkX", () => {
  it("detects crossing from either side", () => {
    expect(crossedLandmarkX(-1, 1, 0)).toBe(true);
    expect(crossedLandmarkX(1, -1, 0)).toBe(true);
  });

  it("detects landing exactly on the landmark", () => {
    expect(crossedLandmarkX(-1, 0, 0)).toBe(true);
    expect(crossedLandmarkX(1, 0, 0)).toBe(true);
  });

  it("detects a stepwise jump that skips past the landmark", () => {
    // Default stepSize 0.25 over a landmark at 0.1 — the old 0.05 radius missed this
    expect(crossedLandmarkX(0, 0.25, 0.1)).toBe(true);
    expect(crossedLandmarkX(0.25, 0, 0.1)).toBe(true);
  });

  it("stays silent while sitting still on or near the landmark", () => {
    expect(crossedLandmarkX(0, 0, 0)).toBe(false);
    expect(crossedLandmarkX(1, 1, 0)).toBe(false);
  });

  it("stays silent when moving on the same side of the landmark", () => {
    expect(crossedLandmarkX(-2, -1, 0)).toBe(false);
    expect(crossedLandmarkX(2, 1, 0)).toBe(false);
  });

  it.each(views)("is independent of zoom for a straddling step, for %o", (bounds) => {
    const mid = (bounds.xMin + bounds.xMax) / 2;
    const step = (bounds.xMax - bounds.xMin) * 0.05;
    expect(crossedLandmarkX(mid - step, mid + step, mid)).toBe(true);
  });
});

describe("resolveLandmarkHit", () => {
  it("fires on an X-crossing", () => {
    expect(resolveLandmarkHit({ prevX: -1, cursorX: 1, landmarkX: 0 }).hit).toBe(true);
  });

  it("does not re-fire while resting on the landmark", () => {
    expect(resolveLandmarkHit({ prevX: 0, cursorX: 0, landmarkX: 0 }).hit).toBe(false);
  });

  it("on first observation, fires only when already inside the match window", () => {
    expect(resolveLandmarkHit({ prevX: null, cursorX: 0, landmarkX: 0, matchX: 0.1 }).hit).toBe(true);
    expect(resolveLandmarkHit({ prevX: null, cursorX: 1, landmarkX: 0, matchX: 0.1 }).hit).toBe(false);
  });

  it("keeps the documented cooldown constant available for callers", () => {
    expect(LANDMARK_COOLDOWN_MS).toBeGreaterThan(0);
  });
});

describe("isNearLandmark", () => {
  it.each(views)("matches a landmark at the same spot across zoom levels for %o", (bounds) => {
    const windows = landmarkWindows(bounds);
    const landmark = { x: (bounds.xMin + bounds.xMax) / 2, y: (bounds.yMin + bounds.yMax) / 2 };

    expect(isNearLandmark(landmark, landmark.x, landmark.y, windows)).toBe(true);
    expect(isNearLandmark(landmark, landmark.x + windows.matchX * 2, landmark.y, windows)).toBe(false);
  });
});
