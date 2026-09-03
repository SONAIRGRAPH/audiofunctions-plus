import * as Tone from "tone";

/**
 * Resume the Web Audio context. Must be called from a user gesture (keydown,
 * click). Do not call from mount effects: browsers leave the context suspended,
 * and caching that pending promise would block later gesture-based starts.
 *
 * Safe to call often; Tone.start() resolves immediately once the context is running.
 */
export function ensureToneStarted() {
  return Tone.start();
}
