import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mixerBus creates Tone nodes lazily; the settings never touch audio
vi.mock("tone", () => ({}));

const {
  STORAGE_KEY,
  DEFAULT_MIXER_SETTINGS,
  loadMixerSettings,
  normalizeMixerSettings,
  saveMixerSettings,
} = await import("./mixerSettings");
const { RELATIVE_RANGE, maxGain, sourceRange } = await import("./fader");

/** Minimal in-memory localStorage. */
const createStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};

describe("normalizeMixerSettings", () => {
  it("returns the defaults for anything that is not an object", () => {
    for (const raw of [null, undefined, 42, "x", []]) {
      expect(normalizeMixerSettings(raw)).toEqual({
        ...DEFAULT_MIXER_SETTINGS,
        master: { volume: 1 },
        groups: { ...DEFAULT_MIXER_SETTINGS.groups },
        channels: {},
      });
    }
  });

  it("clamps volumes to the strip's slider range and coerces mute to a boolean", () => {
    const result = normalizeMixerSettings({
      groups: { earcons: { volume: 50, muted: "yes" }, noise: { volume: -1, muted: true } },
      channels: { "sample:chart_border": { volume: 50 }, tick: { volume: 2 } },
    });
    expect(result.groups.earcons).toEqual({ volume: maxGain(RELATIVE_RANGE), muted: false });
    // chart_border is built in at -20 dB, so it can go up 20 dB = gain 10
    expect(result.channels["sample:chart_border"].volume).toBeCloseTo(maxGain(sourceRange(-20)));
    expect(result.channels["sample:chart_border"].volume).toBeCloseTo(10);
    expect(result.channels.tick.volume).toBe(2);
    expect(result.groups.noise).toEqual({ volume: 0, muted: true });
    expect(result.groups.instruments).toEqual({ volume: 1, muted: false });
  });

  it("clamps the overall volume and defaults it when missing", () => {
    expect(normalizeMixerSettings({ master: { volume: 0.4 } }).master).toEqual({ volume: 0.4 });
    expect(normalizeMixerSettings({ master: { volume: 5 } }).master).toEqual({ volume: maxGain(RELATIVE_RANGE) });
    expect(normalizeMixerSettings({ master: { volume: 2 } }).master).toEqual({ volume: 2 });
    expect(normalizeMixerSettings({ master: { volume: "loud" } }).master).toEqual({ volume: 1 });
    expect(normalizeMixerSettings({}).master).toEqual({ volume: 1 });
  });

  it("drops unknown groups, function channels and invalid levels", () => {
    const result = normalizeMixerSettings({
      groups: { drums: { volume: 0.5 } },
      channels: {
        "sample:chart_border": { volume: 0.2, muted: true },
        "instrument:f1": { volume: 0.3 },
        "sample:unknown": { volume: 0.4 },
        tick: { volume: "loud" },
      },
    });
    expect(result.groups).not.toHaveProperty("drums");
    expect(result.channels).toEqual({ "sample:chart_border": { volume: 0.2, muted: true } });
  });

  it("validates the options and falls back per field", () => {
    expect(
      normalizeMixerSettings({ audioModality: "MANUAL", audioIdleTimeoutSec: 99, clarinetOctave: "down2" })
    ).toMatchObject({ audioModality: "manual", audioIdleTimeoutSec: 10, clarinetOctave: "down2" });

    expect(
      normalizeMixerSettings({ audioModality: "loud", audioIdleTimeoutSec: null, clarinetOctave: "up" })
    ).toMatchObject({
      audioModality: DEFAULT_MIXER_SETTINGS.audioModality,
      audioIdleTimeoutSec: DEFAULT_MIXER_SETTINGS.audioIdleTimeoutSec,
      clarinetOctave: DEFAULT_MIXER_SETTINGS.clarinetOctave,
    });
  });
});

describe("load and save", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("round-trips settings without function channels", () => {
    saveMixerSettings({
      master: { volume: 0.7 },
      groups: { earcons: { volume: 0.2, muted: false } },
      channels: {
        tick: { volume: 0.5, muted: true },
        "instrument:f1": { volume: 0.1, muted: true },
      },
      audioModality: "manual",
      audioIdleTimeoutSec: 6,
      clarinetOctave: "down1",
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.v).toBe(1);
    expect(stored.channels).not.toHaveProperty("instrument:f1");

    const loaded = loadMixerSettings();
    expect(loaded.master).toEqual({ volume: 0.7 });
    expect(loaded.groups.earcons).toEqual({ volume: 0.2, muted: false });
    expect(loaded.channels).toEqual({ tick: { volume: 0.5, muted: true } });
    expect(loaded).toMatchObject({ audioModality: "manual", audioIdleTimeoutSec: 6, clarinetOctave: "down1" });
  });

  it("falls back to the defaults for broken JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadMixerSettings().audioModality).toBe(DEFAULT_MIXER_SETTINGS.audioModality);
  });

  it("falls back to the defaults when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    });
    expect(loadMixerSettings().groups.earcons).toEqual({ volume: 1, muted: false });
    expect(() => saveMixerSettings(DEFAULT_MIXER_SETTINGS)).not.toThrow();
  });
});
