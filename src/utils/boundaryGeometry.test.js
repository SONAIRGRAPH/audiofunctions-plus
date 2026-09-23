import { describe, expect, it } from "vitest";
import {
  BORDER_REPEAT_MS,
  ENTER_RATIO,
  EXIT_RATIO,
  INSET_RATIO,
  boundaryWindows,
  clampX,
  horizontalEdge,
  resolveBorderEvent,
} from "./boundaryGeometry";

// minBoundDifference / maxBoundDifference in graphSettings allow ranges from 0.1 to
// 100, so the sweep covers both extremes plus a few asymmetric and off-centre views.
const views = [
  { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
  { xMin: -50, xMax: 50, yMin: -50, yMax: 50 },
  { xMin: -0.05, xMax: 0.05, yMin: -0.05, yMax: 0.05 },
  { xMin: 1000, xMax: 1000.1, yMin: -3, yMax: 3 },
  { xMin: -12.1, xMax: 12.1, yMin: -0.05, yMax: 0.05 },
  { xMin: -1.234, xMax: 23.456, yMin: -99, yMax: 1 },
];

describe("window ratios", () => {
  it("keeps the inset inside the enter window, and the enter window inside the exit window", () => {
    expect(INSET_RATIO).toBeLessThan(ENTER_RATIO);
    expect(ENTER_RATIO).toBeLessThan(EXIT_RATIO);
  });

  it.each(views)("scales every window with the visible range for %o", (bounds) => {
    const { insetX, enterX, exitX } = boundaryWindows(bounds);
    const xRange = bounds.xMax - bounds.xMin;

    expect(insetX).toBeLessThan(enterX);
    expect(enterX).toBeLessThan(exitX);
    expect(exitX).toBeLessThan(xRange / 2);
  });
});

describe("clampX", () => {
  it.each(views)("parks a blocked cursor where it is still detected as an edge, for %o", (bounds) => {
    const xRange = bounds.xMax - bounds.xMin;

    for (const requested of [bounds.xMin - xRange, bounds.xMin, bounds.xMin + xRange * 1e-6]) {
      const { x, blocked } = clampX(requested, bounds);
      expect(blocked).toBe("left");
      expect(horizontalEdge(x, bounds, null)).toBe("left");
    }

    for (const requested of [bounds.xMax + xRange, bounds.xMax, bounds.xMax - xRange * 1e-6]) {
      const { x, blocked } = clampX(requested, bounds);
      expect(blocked).toBe("right");
      expect(horizontalEdge(x, bounds, null)).toBe("right");
    }
  });

  it.each(views)("leaves the middle of the view untouched and unblocked for %o", (bounds) => {
    const middle = (bounds.xMin + bounds.xMax) / 2;
    const { x, blocked } = clampX(middle, bounds);

    expect(x).toBe(middle);
    expect(blocked).toBeNull();
    expect(horizontalEdge(x, bounds, null)).toBeNull();
  });

  it("passes non-finite requests through without claiming a border", () => {
    const bounds = views[0];

    expect(clampX(NaN, bounds).blocked).toBeNull();
    expect(clampX(undefined, bounds).blocked).toBeNull();
  });
});

describe("horizontalEdge", () => {
  it.each(views)("holds an edge until the wider exit window is cleared, for %o", (bounds) => {
    const { enterX, exitX } = boundaryWindows(bounds);
    const justOutsideEnter = bounds.xMin + (enterX + exitX) / 2;

    expect(horizontalEdge(justOutsideEnter, bounds, null)).toBeNull();
    expect(horizontalEdge(justOutsideEnter, bounds, "left")).toBe("left");
    expect(horizontalEdge(bounds.xMin + exitX * 1.01, bounds, "left")).toBeNull();
  });
});

describe("resolveBorderEvent", () => {
  const at = (overrides) => resolveBorderEvent({
    previousEdge: null,
    edge: null,
    blocked: null,
    now: 10_000,
    lastPlayedAt: 0,
    ...overrides,
  });

  it("sounds when an edge is first reached", () => {
    expect(at({ edge: "left" }).play).toBe(true);
  });

  it("stays silent while resting on an edge the user is not pushing against", () => {
    expect(at({ previousEdge: "left", edge: "left" }).play).toBe(false);
  });

  it("repeats on a fixed cadence while the user keeps pushing outwards", () => {
    const pushing = { previousEdge: "left", edge: "left", blocked: "left" };

    expect(at({ ...pushing, lastPlayedAt: 10_000 - BORDER_REPEAT_MS }).play).toBe(true);
    expect(at({ ...pushing, lastPlayedAt: 10_000 - BORDER_REPEAT_MS + 1 }).play).toBe(false);
  });

  it("sounds immediately when jumping straight to the opposite edge", () => {
    expect(at({ previousEdge: "left", edge: "right", blocked: "right", lastPlayedAt: 10_000 }).play).toBe(true);
  });

  it("stays silent once the cursor is back inside the chart", () => {
    expect(at({ previousEdge: "left", edge: null }).play).toBe(false);
  });

  it.each(views)("sounds for a blocked navigation attempt at any zoom level, for %o", (bounds) => {
    const { x, blocked } = clampX(bounds.xMin - 1, bounds);
    const edge = horizontalEdge(x, bounds, null);

    expect(at({ edge, blocked }).play).toBe(true);
  });
});
