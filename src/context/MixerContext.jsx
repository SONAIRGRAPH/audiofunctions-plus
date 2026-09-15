import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import mixerBus, { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS } from "../audio/mixerBus";
import { ensureToneStarted } from "../utils/toneAudio";

/** AUTO idle: full mute after this many ms without activity. */
export const AUDIO_IDLE_MUTE_MS = 4000;
/** AUTO idle: start master-gain fade-out after this many ms (before mute). */
export const AUDIO_IDLE_FADE_START_MS = 3500;
/** Duration of the idle fade-out (AUDIO_IDLE_MUTE_MS - AUDIO_IDLE_FADE_START_MS). */
export const AUDIO_IDLE_FADE_DURATION_MS = AUDIO_IDLE_MUTE_MS - AUDIO_IDLE_FADE_START_MS;

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
 * Mount <SonificationMuteController /> inside KBarProvider (already done in App.jsx).
 * That component is the single place that opens/closes master output.
 */

export const AUDIO_MODALITIES = Object.freeze({
  AUTO: "auto",
  MANUAL: "manual",
});

const MixerContext = createContext(null);

const normalizeAudioModality = (value) => {
  const next = String(value ?? "").toLowerCase();
  if (next === AUDIO_MODALITIES.AUTO) return AUDIO_MODALITIES.AUTO;
  if (next === AUDIO_MODALITIES.MANUAL) return AUDIO_MODALITIES.MANUAL;
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
 *   isAudioEnabled    user-armed master (P / header); default false
 *   setIsAudioEnabled (bool | fn) => void
 *   toggleAudio       P / header: toggle the user's mute/unmute choice
 *   isOutputOpen      true when sound should actually reach the speakers
 *   isIdleFading      AUTO: true while master gain is fading out (3.5s→4s idle)
 *   AUDIO_IDLE_FADE_DURATION_MS  length of that fade (500ms)
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
  const [isAudioEnabled, setIsAudioEnabledState] = useState(false);
  const [isOverlayMuted, setIsOverlayMuted] = useState(false);
  const [isIdleMuted, setIsIdleMuted] = useState(false);
  const [isIdleFading, setIsIdleFading] = useState(false);
  const [isIdleHold, setIdleHold] = useState(false);

  const idleFadeTimerRef = useRef(null);
  const idleMuteTimerRef = useRef(null);
  const audioModalityRef = useRef(audioModality);
  const isIdleHoldRef = useRef(isIdleHold);
  const isAudioEnabledRef = useRef(isAudioEnabled);
  const hasConsumedFirstAutoEnableRef = useRef(false);

  audioModalityRef.current = audioModality;
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

  // AUTO: activity lifts idle mute/fade and restarts the 4s window
  // (fade from 3.5s, mute at 4s). MANUAL never idle-mutes.
  const notifyActivity = useCallback(() => {
    setIsIdleMuted(false);
    setIsIdleFading(false);
    clearIdleTimers();
    if (!canScheduleIdleMute()) return;

    idleFadeTimerRef.current = setTimeout(() => {
      idleFadeTimerRef.current = null;
      if (!canScheduleIdleMute()) return;
      setIsIdleFading(true);
    }, AUDIO_IDLE_FADE_START_MS);

    idleMuteTimerRef.current = setTimeout(() => {
      idleMuteTimerRef.current = null;
      if (!canScheduleIdleMute()) return;
      setIsIdleFading(false);
      setIsIdleMuted(true);
    }, AUDIO_IDLE_MUTE_MS);
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

  // Start (or clear) the idle window when arming, modality, or batch-hold changes.
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
  }, [audioModality, isAudioEnabled, isIdleHold, clearIdleTimers, notifyActivity]);

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
      AUDIO_IDLE_MUTE_MS,
      AUDIO_IDLE_FADE_START_MS,
      AUDIO_IDLE_FADE_DURATION_MS,
      audioModality,
      setAudioModality,
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
