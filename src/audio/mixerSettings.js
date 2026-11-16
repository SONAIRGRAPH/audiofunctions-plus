import { MIXER_GROUPS } from "./mixerBus";
import { isPersistentChannel, channelRange } from "./mixerCatalog";
import { RELATIVE_RANGE, maxGain } from "./fader";
import { readStored, writeStored } from "../utils/prefs";

/**
 * Saved mixer settings: the overall volume, volumes and mutes of the groups and of every catalog
 * channel, plus the audio options. Function channels (instrument:<id>) are
 * deliberately left out -- their ids mean something different in every graph.
 *
 * Stored as one JSON value under STORAGE_KEY. MixerContext loads it on start
 * and saves after every change, like the display preferences in prefs.js.
 */

export const STORAGE_KEY = "audioMixer";
const VERSION = 1;

/** Length of the AUTO idle fade-out, immediately before full mute. */
export const AUDIO_IDLE_FADE_DURATION_MS = 500;

/**
 * AUTO idle timeout slider (seconds of inactivity before fade-out to mute).
 * Fade always occupies the last AUDIO_IDLE_FADE_DURATION_MS of this window.
 */
export const AUDIO_IDLE_TIMEOUT_MIN_S = 2;
export const AUDIO_IDLE_TIMEOUT_MAX_S = 10;
export const AUDIO_IDLE_TIMEOUT_DEFAULT_S = 4;
export const AUDIO_IDLE_TIMEOUT_STEP_S = 1;

export const AUDIO_MODALITIES = Object.freeze({
  AUTO: "auto",
  MANUAL: "manual",
});

/** Continuous clarinet range: default, or 1–2 octaves down (each octave halves Hz). */
export const CLARINET_OCTAVES = Object.freeze({
  DEFAULT: "default",
  DOWN_1: "down1",
  DOWN_2: "down2",
});

export const CLARINET_OCTAVE_LABELS = Object.freeze({
  [CLARINET_OCTAVES.DEFAULT]: "Default",
  [CLARINET_OCTAVES.DOWN_1]: "−1 octave",
  [CLARINET_OCTAVES.DOWN_2]: "−2 octaves",
});

/** Frequency multiplier: 2^shift. Octave down = ×0.5. */
export const CLARINET_OCTAVE_SHIFT = Object.freeze({
  [CLARINET_OCTAVES.DEFAULT]: 0,
  [CLARINET_OCTAVES.DOWN_1]: -1,
  [CLARINET_OCTAVES.DOWN_2]: -2,
});

export const normalizeAudioModality = (value) => {
  const next = String(value ?? "").toLowerCase();
  if (next === AUDIO_MODALITIES.AUTO) return AUDIO_MODALITIES.AUTO;
  if (next === AUDIO_MODALITIES.MANUAL) return AUDIO_MODALITIES.MANUAL;
  return null;
};

export const normalizeClarinetOctave = (value) => {
  if (value === 0 || value === "0") return CLARINET_OCTAVES.DEFAULT;
  if (value === -1 || value === "-1") return CLARINET_OCTAVES.DOWN_1;
  if (value === -2 || value === "-2") return CLARINET_OCTAVES.DOWN_2;
  const next = String(value ?? "").toLowerCase().replace(/[-_\s]/g, "");
  if (next === CLARINET_OCTAVES.DEFAULT) return CLARINET_OCTAVES.DEFAULT;
  if (next === CLARINET_OCTAVES.DOWN_1 || next === "minus1") return CLARINET_OCTAVES.DOWN_1;
  if (next === CLARINET_OCTAVES.DOWN_2 || next === "minus2") return CLARINET_OCTAVES.DOWN_2;
  return null;
};

export const normalizeIdleTimeoutSec = (value) => {
  // Number(null) and Number("") are 0, which would clamp to the minimum
  if (value === null || value === "" || typeof value === "boolean") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(
    AUDIO_IDLE_TIMEOUT_MAX_S,
    Math.max(AUDIO_IDLE_TIMEOUT_MIN_S, n)
  );
  const stepsFromMin = Math.round(
    (clamped - AUDIO_IDLE_TIMEOUT_MIN_S) / AUDIO_IDLE_TIMEOUT_STEP_S
  );
  const snapped = AUDIO_IDLE_TIMEOUT_MIN_S + stepsFromMin * AUDIO_IDLE_TIMEOUT_STEP_S;
  return Math.min(AUDIO_IDLE_TIMEOUT_MAX_S, Math.max(AUDIO_IDLE_TIMEOUT_MIN_S, snapped));
};

/** Gain clamped to what the strip's slider can reach, or null if unusable. */
const normalizeGain = (value, range) => {
  if (value === null || value === "" || typeof value === "boolean") return null;
  const gain = Number(value);
  if (!Number.isFinite(gain)) return null;
  return Math.max(0, Math.min(maxGain(range), gain));
};

/** { volume, muted } with a clamped volume, or null if unusable. */
const normalizeLevel = (value, range) => {
  if (!value || typeof value !== "object") return null;
  const volume = normalizeGain(value.volume, range);
  if (volume === null) return null;
  return { volume, muted: value.muted === true };
};

export const DEFAULT_MIXER_SETTINGS = Object.freeze({
  master: Object.freeze({ volume: 1 }),
  groups: Object.freeze(
    Object.fromEntries(
      Object.values(MIXER_GROUPS).map((id) => [id, Object.freeze({ volume: 1, muted: false })])
    )
  ),
  channels: Object.freeze({}),
  audioModality: AUDIO_MODALITIES.AUTO,
  audioIdleTimeoutSec: AUDIO_IDLE_TIMEOUT_DEFAULT_S,
  clarinetOctave: CLARINET_OCTAVES.DEFAULT,
});

/**
 * Validate any value into complete settings. Unknown groups, non-catalog
 * channels and invalid fields fall back to the defaults.
 * @param {unknown} raw
 */
export function normalizeMixerSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};

  const groups = {};
  Object.values(MIXER_GROUPS).forEach((id) => {
    groups[id] = normalizeLevel(source.groups?.[id], RELATIVE_RANGE) ?? { ...DEFAULT_MIXER_SETTINGS.groups[id] };
  });

  const channels = {};
  if (source.channels && typeof source.channels === "object") {
    Object.entries(source.channels).forEach(([id, value]) => {
      if (!isPersistentChannel(id)) return;
      const level = normalizeLevel(value, channelRange(id));
      if (level) channels[id] = level;
    });
  }

  return {
    master: {
      volume: normalizeGain(source.master?.volume, RELATIVE_RANGE) ?? DEFAULT_MIXER_SETTINGS.master.volume,
    },
    groups,
    channels,
    audioModality: normalizeAudioModality(source.audioModality) ?? DEFAULT_MIXER_SETTINGS.audioModality,
    audioIdleTimeoutSec:
      normalizeIdleTimeoutSec(source.audioIdleTimeoutSec) ?? DEFAULT_MIXER_SETTINGS.audioIdleTimeoutSec,
    clarinetOctave: normalizeClarinetOctave(source.clarinetOctave) ?? DEFAULT_MIXER_SETTINGS.clarinetOctave,
  };
}

/** Saved settings, or the defaults if nothing (valid) is stored. */
export function loadMixerSettings() {
  const stored = readStored(STORAGE_KEY);
  if (!stored) return normalizeMixerSettings(null);
  try {
    return normalizeMixerSettings(JSON.parse(stored));
  } catch (error) {
    console.warn(`Ignoring invalid "${STORAGE_KEY}" in localStorage:`, error);
    return normalizeMixerSettings(null);
  }
}

/** Save settings. Function channels and unknown fields are dropped. */
export function saveMixerSettings(settings) {
  writeStored(STORAGE_KEY, JSON.stringify({ v: VERSION, ...normalizeMixerSettings(settings) }));
}
