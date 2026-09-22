import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import mixerBus, { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS } from "../audio/mixerBus";
import { ensureToneStarted } from "../utils/toneAudio";

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

const normalizeIdleTimeoutSec = (value) => {
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

/**
 * MixerContext — React API for the audio mixer (UI colleagues).
 *
 * Mental model (volume desk with folders):
 *   source → channel fader → group fader → master (P / AUTO idle / overlays) → speakers
 *
 * Groups (always 3): instruments, earcons, noise.
 * Channels (dynamic): one strip per source, e.g. instrument:f1, tick, sample:chart_border.
 *
 * Master output is gated by:
 *   - isAudioEnabled (P key / header / skip link)
 *   - overlay mute (command palette, dialogs)
 *   - AUTO idle mute (see AUDIO_MODALITIES)
 *
 * UI should use `useMixer()` only. Do not import mixerBus or Tone.js from UI code.
 * Full guide with examples: ./mixer-ui.md
 *
 * Mount <SonificationMuteController /> inside CommandPaletteProvider (already done in App.jsx).
 * That component is the single place that opens/closes master output.
 */

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

const MixerContext = createContext(null);

const normalizeAudioModality = (value) => {
  const next = String(value ?? "").toLowerCase();
  if (next === AUDIO_MODALITIES.AUTO) return AUDIO_MODALITIES.AUTO;
  if (next === AUDIO_MODALITIES.MANUAL) return AUDIO_MODALITIES.MANUAL;
  return null;
};

const normalizeClarinetOctave = (value) => {
  if (value === 0 || value === "0") return CLARINET_OCTAVES.DEFAULT;
  if (value === -1 || value === "-1") return CLARINET_OCTAVES.DOWN_1;
  if (value === -2 || value === "-2") return CLARINET_OCTAVES.DOWN_2;
  const next = String(value ?? "").toLowerCase().replace(/[-_\s]/g, "");
  if (next === CLARINET_OCTAVES.DEFAULT) return CLARINET_OCTAVES.DEFAULT;
  if (next === CLARINET_OCTAVES.DOWN_1 || next === "minus1") return CLARINET_OCTAVES.DOWN_1;
  if (next === CLARINET_OCTAVES.DOWN_2 || next === "minus2") return CLARINET_OCTAVES.DOWN_2;
  return null;
};

/**
 * Hook for mixer UI.
 *
 * Must be called under MixerProvider (already wrapping the app in App.jsx).
 *
 * Returns:
 *   mixerState        { groups, channels } snapshot
 *   groups            map of groupId → { id, label, muted, volume }  volume is 0..1
 *   channels          map of channelId → { id, label, groupId, muted, volume }
 *   setGroupVolume    (groupId, volume0to1) => void
 *   setGroupMuted     (groupId, mutedBool) => void
 *   setChannelVolume  (channelId, volume0to1) => void
 *   setChannelMuted   (channelId, mutedBool) => void
 *   MIXER_GROUPS      { earcons, instruments, noise }
 *   MIXER_GROUP_LABELS  display names for those groups
 *   MIXER_CHANNELS    helpers: tick, pinkNoise, instrument(id), sample(name)
 *   AUDIO_MODALITIES  { AUTO: "auto", MANUAL: "manual" }
 *   audioModality     current modality ("auto" | "manual"); default AUTO
 *   setAudioModality  (modality) => void   mutually exclusive AUTO / MANUAL
 *   CLARINET_OCTAVES  { DEFAULT, DOWN_1, DOWN_2 }
 *   CLARINET_OCTAVE_LABELS  display names for those octaves
 *   clarinetOctave    current clarinet range ("default" | "down1" | "down2")
 *   setClarinetOctave (octave) => void
 *   isAudioEnabled    user-armed master (P / header); default false
 *   setIsAudioEnabled (bool | fn) => void
 *   toggleAudio       P / header: toggle the user's mute/unmute choice
 *   isOutputOpen      true when sound should actually reach the speakers
 *   isIdleFading      AUTO: true while master gain is fading out (last 500ms)
 *   AUDIO_IDLE_FADE_DURATION_MS  length of that fade (500ms)
 *   audioIdleTimeoutSec  seconds of inactivity before AUTO fade-out to mute (2–10, default 4)
 *   setAudioIdleTimeoutSec (seconds) => void   clamped to the slider range, snapped to step
 *   AUDIO_IDLE_TIMEOUT_MIN_S / MAX_S / STEP_S / DEFAULT_S  bind these on the slider
 *   tryEnableFromCursorNavigation  first-load AUTO enable (arrow / B / Space)
 *
 * `groups` / `channels` update automatically when the bus creates, removes, or
 * changes a strip. Re-renders happen via mixerBus.subscribe.
 */
export const useMixer = () => {
  const context = useContext(MixerContext);
  if (!context) {
    throw new Error("useMixer must be used within a MixerProvider");
  }
  return context;
};

/**
 * Subscribes React state to the mixerBus singleton and exposes setters.
 * Audio engines still talk to mixerBus directly; this is the UI facade.
 *
 * Also owns master-output policy: modality, P-key arming, overlay mute, AUTO idle.
 */
export const MixerProvider = ({ children }) => {
  // Seed from the bus so first paint already has the three groups
  // (channels appear later, when sonification creates them).
  const [mixerState, setMixerState] = useState(() => mixerBus.getState());
  const [audioModality, setAudioModalityState] = useState(AUDIO_MODALITIES.AUTO);
  const [audioIdleTimeoutSec, setAudioIdleTimeoutSecState] = useState(AUDIO_IDLE_TIMEOUT_DEFAULT_S);
  const [clarinetOctave, setClarinetOctaveState] = useState(CLARINET_OCTAVES.DEFAULT);
  const [isAudioEnabled, setIsAudioEnabledState] = useState(false);
  const [isOverlayMuted, setIsOverlayMuted] = useState(false);
  const [isIdleMuted, setIsIdleMuted] = useState(false);
  const [isIdleFading, setIsIdleFading] = useState(false);
  const [isIdleHold, setIdleHold] = useState(false);

  const idleFadeTimerRef = useRef(null);
  const idleMuteTimerRef = useRef(null);
  const audioModalityRef = useRef(audioModality);
  const audioIdleTimeoutSecRef = useRef(audioIdleTimeoutSec);
  const isIdleHoldRef = useRef(isIdleHold);
  const isAudioEnabledRef = useRef(isAudioEnabled);
  const hasConsumedFirstAutoEnableRef = useRef(false);

  audioModalityRef.current = audioModality;
  audioIdleTimeoutSecRef.current = audioIdleTimeoutSec;
  isIdleHoldRef.current = isIdleHold;
  isAudioEnabledRef.current = isAudioEnabled;

  // Push a new { groups, channels } snapshot whenever the bus notifies
  // (ensureChannel, removeChannel, setGroupVolume/Muted, setChannelVolume/Muted).
  // setInstrumentsGate does not notify — it is not a UI mute/volume change.
  useEffect(() => {
    return mixerBus.subscribe(setMixerState);
  }, []);

  const clearIdleTimers = useCallback(() => {
    if (idleFadeTimerRef.current) {
      clearTimeout(idleFadeTimerRef.current);
      idleFadeTimerRef.current = null;
    }
    if (idleMuteTimerRef.current) {
      clearTimeout(idleMuteTimerRef.current);
      idleMuteTimerRef.current = null;
    }
  }, []);

  const canScheduleIdleMute = () =>
    audioModalityRef.current === AUDIO_MODALITIES.AUTO &&
    !isIdleHoldRef.current &&
    isAudioEnabledRef.current;

  // AUTO: activity lifts idle mute/fade and restarts the idle window
  // (fade during the last AUDIO_IDLE_FADE_DURATION_MS, then mute).
  // MANUAL never idle-mutes.
  const notifyActivity = useCallback(() => {
    setIsIdleMuted(false);
    setIsIdleFading(false);
    clearIdleTimers();
    if (!canScheduleIdleMute()) return;

    const muteMs = audioIdleTimeoutSecRef.current * 1000;
    const fadeStartMs = Math.max(0, muteMs - AUDIO_IDLE_FADE_DURATION_MS);

    idleFadeTimerRef.current = setTimeout(() => {
      idleFadeTimerRef.current = null;
      if (!canScheduleIdleMute()) return;
      setIsIdleFading(true);
    }, fadeStartMs);

    idleMuteTimerRef.current = setTimeout(() => {
      idleMuteTimerRef.current = null;
      if (!canScheduleIdleMute()) return;
      setIsIdleFading(false);
      setIsIdleMuted(true);
    }, muteMs);
  }, [clearIdleTimers]);

  useEffect(() => {
    return () => clearIdleTimers();
  }, [clearIdleTimers]);

  const setAudioModality = useCallback((modality) => {
    const next = normalizeAudioModality(modality);
    if (!next) {
      console.warn(`Unknown audio modality: ${modality}. Use AUDIO_MODALITIES.AUTO or AUDIO_MODALITIES.MANUAL.`);
      return;
    }
    setAudioModalityState(next);
  }, []);

  const setClarinetOctave = useCallback((octave) => {
    const next = normalizeClarinetOctave(octave);
    if (!next) {
      console.warn(`Unknown clarinet octave: ${octave}. Use CLARINET_OCTAVES.DEFAULT, DOWN_1, or DOWN_2.`);
      return;
    }
    setClarinetOctaveState(next);
  }, []);

  // Seconds until AUTO fade-out to mute. Out-of-range values clamp; non-numbers are ignored.
  const setAudioIdleTimeoutSec = useCallback((seconds) => {
    const next = normalizeIdleTimeoutSec(seconds);
    if (next == null) {
      console.warn(
        `Invalid AUTO idle timeout: ${seconds}. Use a number of seconds between ${AUDIO_IDLE_TIMEOUT_MIN_S} and ${AUDIO_IDLE_TIMEOUT_MAX_S}.`
      );
      return;
    }
    setAudioIdleTimeoutSecState(next);
  }, []);

  // Linear volume 0..1 (clamped in the bus). Mute is independent of the stored volume.
  const setGroupVolume = useCallback((groupId, volume) => {
    mixerBus.setGroupVolume(groupId, volume);
  }, []);

  const setGroupMuted = useCallback((groupId, muted) => {
    mixerBus.setGroupMuted(groupId, muted);
  }, []);

  // channelId examples: "instrument:f1", "tick", "pinkNoise", "sample:chart_border".
  // No-op if that channel has not been created yet.
  const setChannelVolume = useCallback((channelId, volume) => {
    mixerBus.setChannelVolume(channelId, volume);
  }, []);

  const setChannelMuted = useCallback((channelId, muted) => {
    mixerBus.setChannelMuted(channelId, muted);
  }, []);

  const setIsAudioEnabled = useCallback((value) => {
    setIsAudioEnabledState((prev) => {
      const next = typeof value === "function" ? Boolean(value(prev)) : Boolean(value);
      // P / header / skip-link enabling counts as the first arming; arrows/B
      // must not auto-enable again after that.
      if (next) hasConsumedFirstAutoEnableRef.current = true;
      return next;
    });
  }, []);

  const toggleAudio = useCallback(() => {
    setIsAudioEnabled((prev) => !prev);
  }, [setIsAudioEnabled]);

  // First cursor-navigation key after load, AUTO only. Later on/off is P.
  const tryEnableFromCursorNavigation = useCallback(async () => {
    if (audioModalityRef.current !== AUDIO_MODALITIES.AUTO) return false;
    if (hasConsumedFirstAutoEnableRef.current) return false;
    await ensureToneStarted();
    hasConsumedFirstAutoEnableRef.current = true;
    setIsAudioEnabledState(true);
    notifyActivity();
    return true;
  }, [notifyActivity]);

  // Start (or clear) the idle window when arming, modality, batch-hold, or timeout changes.
  useEffect(() => {
    if (audioModality !== AUDIO_MODALITIES.AUTO || !isAudioEnabled) {
      clearIdleTimers();
      setIsIdleFading(false);
      setIsIdleMuted(false);
      return;
    }
    if (isIdleHold) {
      clearIdleTimers();
      setIsIdleFading(false);
      setIsIdleMuted(false);
      return;
    }
    notifyActivity();
  }, [audioModality, isAudioEnabled, isIdleHold, audioIdleTimeoutSec, clearIdleTimers, notifyActivity]);

  const isOutputOpen =
    isAudioEnabled &&
    !isOverlayMuted &&
    !(audioModality === AUDIO_MODALITIES.AUTO && isIdleMuted);

  // Fade only while output is otherwise open (armed, no overlay). Overlay/P cut immediately.
  const shouldIdleFade =
    isIdleFading &&
    isOutputOpen &&
    audioModality === AUDIO_MODALITIES.AUTO;

  const value = useMemo(
    () => ({
      // Full snapshot; groups/channels are convenience aliases of the same data.
      mixerState,
      groups: mixerState.groups,
      channels: mixerState.channels,
      setGroupVolume,
      setGroupMuted,
      setChannelVolume,
      setChannelMuted,
      // Constants so UI does not hardcode "instruments" / "sample:…" strings.
      MIXER_GROUPS,
      MIXER_GROUP_LABELS,
      MIXER_CHANNELS,
      AUDIO_MODALITIES,
      CLARINET_OCTAVES,
      CLARINET_OCTAVE_LABELS,
      CLARINET_OCTAVE_SHIFT,
      AUDIO_IDLE_FADE_DURATION_MS,
      AUDIO_IDLE_TIMEOUT_MIN_S,
      AUDIO_IDLE_TIMEOUT_MAX_S,
      AUDIO_IDLE_TIMEOUT_DEFAULT_S,
      AUDIO_IDLE_TIMEOUT_STEP_S,
      audioModality,
      setAudioModality,
      audioIdleTimeoutSec,
      setAudioIdleTimeoutSec,
      clarinetOctave,
      setClarinetOctave,
      isAudioEnabled,
      setIsAudioEnabled,
      toggleAudio,
      isOutputOpen,
      isIdleFading: shouldIdleFade,
      tryEnableFromCursorNavigation,
      notifyActivity,
      setOverlayMuted: setIsOverlayMuted,
      setIdleHold,
    }),
    [
      mixerState,
      setGroupVolume,
      setGroupMuted,
      setChannelVolume,
      setChannelMuted,
      audioModality,
      setAudioModality,
      audioIdleTimeoutSec,
      setAudioIdleTimeoutSec,
      clarinetOctave,
      setClarinetOctave,
      isAudioEnabled,
      setIsAudioEnabled,
      toggleAudio,
      isOutputOpen,
      shouldIdleFade,
      tryEnableFromCursorNavigation,
      notifyActivity,
    ]
  );

  return (
    <MixerContext.Provider value={value}>
      {children}
    </MixerContext.Provider>
  );
};

export { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS };
export default MixerContext;
