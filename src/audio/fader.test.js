import { describe, expect, it } from "vitest";
import {
  FADER_FLOOR_DB,
  RELATIVE_HEADROOM_DB,
  RELATIVE_RANGE,
  gainAt,
  maxGain,
  positionOf,
  sourceRange,
} from "./fader";

describe("fader law", () => {
  it("puts a source's built-in level where its dB value lies", () => {
    // Pink noise is built in at -36 dB: 24 of 60 dB above the floor
    expect(positionOf(1, sourceRange(-36))).toBeCloseTo(0.4);
    expect(positionOf(1, sourceRange(-18))).toBeCloseTo(0.7);
  });

  it("tops a source out at 0 dB, its full level", () => {
    expect(positionOf(maxGain(sourceRange(-36)), sourceRange(-36))).toBeCloseTo(1);
    expect(gainAt(1, sourceRange(-20))).toBeCloseTo(10);
  });

  it("leaves headroom above gain 1 on relative strips", () => {
    const expected = -FADER_FLOOR_DB / (RELATIVE_HEADROOM_DB - FADER_FLOOR_DB);
    expect(positionOf(1, RELATIVE_RANGE)).toBeCloseTo(expected);
    expect(maxGain(RELATIVE_RANGE)).toBeCloseTo(10 ** (RELATIVE_HEADROOM_DB / 20));
  });

  it("maps position 0 and gain 0 to silence", () => {
    expect(gainAt(0, RELATIVE_RANGE)).toBe(0);
    expect(positionOf(0, RELATIVE_RANGE)).toBe(0);
  });

  it("round-trips positions and gains", () => {
    for (const range of [RELATIVE_RANGE, sourceRange(-36), sourceRange(-12)]) {
      for (const position of [0.05, 0.25, 0.5, 0.83, 1]) {
        expect(positionOf(gainAt(position, range), range)).toBeCloseTo(position);
      }
    }
  });

  it("clamps out-of-range values", () => {
    expect(positionOf(1000, RELATIVE_RANGE)).toBe(1);
    expect(positionOf(1e-9, RELATIVE_RANGE)).toBe(0);
    expect(gainAt(2, RELATIVE_RANGE)).toBeCloseTo(maxGain(RELATIVE_RANGE));
  });
});
