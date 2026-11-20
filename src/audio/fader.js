/**
 * Fader law of the mixer sliders: slider position (0..1) is linear in dB,
 * like a mixing desk, so equal slider steps sound like equal changes.
 *
 * The mixer API stores linear gains relative to each source's built-in
 * level (1 = as designed). A fader range describes where that gain sits:
 *
 *   baseDb  absolute level of the source at gain 1 (its built-in volume)
 *   maxDb   absolute level at the top of the slider
 *
 * Sounds with a built-in volume (earcons, tick, noise) top out at 0 dB, the
 * full level of the sound file or synth. Their slider therefore starts where
 * the built-in volume puts it, e.g. pink noise (-36 dB) at 40 %.
 * Groups, the overall volume and function tones have no built-in level of
 * their own (baseDb 0) and get RELATIVE_HEADROOM_DB of boost above it.
 */

/** Bottom of the slider; anything below is treated as silent. */
export const FADER_FLOOR_DB = -60;

/** Boost available on groups, overall volume and function tones. */
export const RELATIVE_HEADROOM_DB = 12;

export const RELATIVE_RANGE = Object.freeze({ baseDb: 0, maxDb: RELATIVE_HEADROOM_DB });

/** Range of a source with a built-in level of `baseDb`. */
export const sourceRange = (baseDb) => Object.freeze({ baseDb, maxDb: 0 });

const dbToGain = (db) => 10 ** (db / 20);

/** Largest gain the slider can reach. */
export const maxGain = (range) => dbToGain(range.maxDb - range.baseDb);

/** Slider position 0..1 of a gain. */
export function positionOf(gain, range) {
  if (!(gain > 0)) return 0;
  const absoluteDb = range.baseDb + 20 * Math.log10(gain);
  const position = (absoluteDb - FADER_FLOOR_DB) / (range.maxDb - FADER_FLOOR_DB);
  return Math.max(0, Math.min(1, position));
}

/** Gain at a slider position 0..1. Position 0 is silence. */
export function gainAt(position, range) {
  if (!(position > 0)) return 0;
  const clamped = Math.min(1, position);
  const absoluteDb = FADER_FLOOR_DB + clamped * (range.maxDb - FADER_FLOOR_DB);
  return dbToGain(absoluteDb - range.baseDb);
}
