import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import mixerBus, { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS } from "../audio/mixerBus";
import { MIXER_CATALOG, sampleNameOf } from "../audio/mixerCatalog";
import {
  AUDIO_IDLE_FADE_DURATION_MS,
  AUDIO_IDLE_TIMEOUT_MIN_S,
  AUDIO_IDLE_TIMEOUT_MAX_S,
  AUDIO_IDLE_TIMEOUT_DEFAULT_S,
  AUDIO_IDLE_TIMEOUT_STEP_S,
  AUDIO_MODALITIES,
  CLARINET_OCTAVES,
  CLARINET_OCTAVE_LABELS,
  CLARINET_OCTAVE_SHIFT,
  DEFAULT_MIXER_SETTINGS,
  loadMixerSettings,
  saveMixerSettings,
  normalizeAudioModality,
  normalizeClarinetOctave,
  normalizeIdleTimeoutSec,
} from "../audio/mixerSettings";
import audioSampleManager from "../utils/audioSamples";
import { ensureToneStarted } from "../utils/toneAudio";

export {
  AUDIO_IDLE_FADE_DURATION_MS,
  AUDIO_IDLE_TIMEOUT_MIN_S,
  AUDIO_IDLE_TIMEOUT_MAX_S,
  AUDIO_IDLE_TIMEOUT_DEFAULT_S,
  AUDIO_IDLE_TIMEOUT_STEP_S,
  AUDIO_MODALITIES,
  CLARINET_OCTAVES,
  CLARINET_OCTAVE_LABELS,
  CLARINET_OCTAVE_SHIFT,
};

/** How long the output stays open for a mixer preview. */
const PREVIEW_DURATION_MS = 1500;

/** Settings are saved this long after the last change (sliders fire often). */
const SAVE_DELAY_MS = 300;

/** Only volume and mute of each strip, the shape the settings use. */
const levelsOf = (strips) =>
  Object.fromEntries(
    Object.values(strips).map(({ id, volume, muted }) => [id, { volume, muted }])
  );

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

const MixerContext = createContext(null);

/**
 * Hook for mixer UI.
 *
 * Must be called under MixerProvider (already wrapping the app in App.jsx).
 *
 * Returns:
 *   mixerState        { master, groups, channels } snapshot
 *   master            { volume }  overall volume 0..1 above the groups (not a mute; that is P)
 *   setMasterVolume   (volume0to1) => void
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
 *   getSettingsSnapshot     () => settings   levels of every strip + the three options
 *   restoreSettingsSnapshot (settings) => void   e.g. Cancel in the mixer dialog
 *   resetToDefaults         () => void   every level back to its built-in level, unmuted, default options
 *   previewChannel          (channelId) => void   short sample of a channel with channel.previewable
 *   preparePreviews         () => void   preload the preview samples (call when the mixer opens)
 *   previewingChannelId     channel whose preview is playing, else null
 *   isPreviewing            true while a preview holds the output open
 *
 * Settings are loaded on start and saved after every change (see
 * audio/mixerSettings.js). Function channels are not saved.
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
  // Load saved settings once, before the first render reads the bus: catalog
  // channels get their state up front, so saved levels apply before a sound
  // has ever played and the mixer dialog can list every earcon.
  const [initialSettings] = useState(() => {
    MIXER_CATALOG.forEach(({ id, groupId, label }) => mixerBus.presetChannel(id, groupId, label));
    const settings = loadMixerSettings();
    mixerBus.applySettings(settings);
    return settings;
  });
  const [mixerState, setMixerState] = useState(() => mixerBus.getState());
  const [audioModality, setAudioModalityState] = useState(initialSettings.audioModality);
  const [audioIdleTimeoutSec, setAudioIdleTimeoutSecState] = useState(initialSettings.audioIdleTimeoutSec);
  const [clarinetOctave, setClarinetOctaveState] = useState(initialSettings.clarinetOctave);
  const [isAudioEnabled, setIsAudioEnabledState] = useState(false);
  const [isOverlayMuted, setIsOverlayMuted] = useState(false);
  const [isIdleMuted, setIsIdleMuted] = useState(false);
  const [isIdleFading, setIsIdleFading] = useState(false);
  const [isIdleHold, setIdleHold] = useState(false);
  // Set while a mixer preview plays: { channelId, nonce }
  const [preview, setPreview] = useState(null);

  const idleFadeTimerRef = useRef(null);
  const idleMuteTimerRef = useRef(null);
  const previewTimerRef = useRef(null);
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
  // Child effects (GraphSonification) run before this one and may already have
  // created channels, so read the bus once right after subscribing.
  useEffect(() => {
    const unsubscribe = mixerBus.subscribe(setMixerState);
    setMixerState(mixerBus.getState());
    return unsubscribe;
  }, []);

  // Everything the settings consist of, including function channels. Saving
  // drops those (mixerSettings.js); Cancel in the dialog restores them.
  const currentSettings = useMemo(
    () => ({
      master: { volume: mixerState.master.volume },
      groups: levelsOf(mixerState.groups),
      channels: levelsOf(mixerState.channels),
      audioModality,
      audioIdleTimeoutSec,
      clarinetOctave,
    }),
    [mixerState, audioModality, audioIdleTimeoutSec, clarinetOctave]
  );
  const currentSettingsRef = useRef(currentSettings);
  currentSettingsRef.current = currentSettings;

  // Save after every change, like the display preferences. Debounced because
  // a slider fires on every step; flushed when the page is hidden or closed.
  useEffect(() => {
    const timer = setTimeout(() => saveMixerSettings(currentSettings), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentSettings]);

  useEffect(() => {
    const flush = () => saveMixerSettings(currentSettingsRef.current);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  const getSettingsSnapshot = useCallback(() => currentSettingsRef.current, []);

  /** Put back a snapshot from getSettingsSnapshot() (Cancel in the dialog). */
  const restoreSettingsSnapshot = useCallback((snapshot) => {
    if (!snapshot) return;
    mixerBus.applySettings(snapshot);
    setAudioModalityState(snapshot.audioModality);
    setAudioIdleTimeoutSecState(snapshot.audioIdleTimeoutSec);
    setClarinetOctaveState(snapshot.clarinetOctave);
  }, []);

  /** Overall volume, every group and channel back to gain 1 (built-in level) and unmuted, options to default. */
  const resetToDefaults = useCallback(() => {
    const channels = Object.fromEntries(
      Object.keys(mixerBus.getState().channels).map((id) => [id, { volume: 1, muted: false }])
    );
    restoreSettingsSnapshot({ ...DEFAULT_MIXER_SETTINGS, channels });
  }, [restoreSettingsSnapshot]);

  /**
   * Load every previewable sample ahead of time. Samples otherwise load on
   * their first play, which made the first ▶ press per sound noticeably late.
   * Decoding works while the audio context is still suspended.
   */
  const preparePreviews = useCallback(() => {
    const pending = MIXER_CATALOG
      .map(({ id }) => sampleNameOf(id))
      .filter((name) => name && !audioSampleManager.samples.has(name))
      .map((name) => ({ name, filename: audioSampleManager.getFilenameForSample(name) }))
      .filter(({ filename }) => filename);
    if (pending.length > 0) audioSampleManager.loadSamples(pending);
  }, []);

  const endPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    mixerBus.setPreviewSolo(null);
    setPreview(null);
  }, []);

  /**
   * Play a short sample of one channel, even while a dialog is open or audio
   * is off -- the user asked for it explicitly. Only this one channel may
   * sound meanwhile, so other function tones do not drone along. The sound
   * itself starts in the effect below, once the master gain has opened.
   * Works for every channel whose engine registered a preview
   * (channel.previewable): samples, tick, pink noise, every function.
   */
  const previewChannel = useCallback(async (channelId) => {
    if (!mixerBus.hasPreview(channelId)) return;
    await ensureToneStarted();
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    mixerBus.setPreviewSolo(channelId);
    setPreview({ channelId, nonce: Date.now() });
  }, []);

  // Runs after GraphSonification (a child) has applied isOutputOpen to the
  // master gain in the same commit, so the sample is not cut off at its start.
  // The output closes PREVIEW_DURATION_MS after the sound started; a sample
  // that is loaded on demand first does not lose its time to the download.
  useEffect(() => {
    if (!preview) return undefined;
    let cancelled = false;
    mixerBus.runPreview(preview.channelId).finally(() => {
      if (cancelled) return;
      previewTimerRef.current = setTimeout(endPreview, PREVIEW_DURATION_MS);
    });
    return () => {
      cancelled = true;
    };
  }, [preview, endPreview]);

  useEffect(() => endPreview, [endPreview]);

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

  // Overall volume above the groups, linear 0..1. On/off stays with P.
  const setMasterVolume = useCallback((volume) => {
    mixerBus.setMasterVolume(volume);
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

  // A preview opens the output regardless of P, overlays and AUTO idle.
  const isOutputOpen =
    preview !== null ||
    (isAudioEnabled &&
      !isOverlayMuted &&
      !(audioModality === AUDIO_MODALITIES.AUTO && isIdleMuted));

  // Fade only while output is otherwise open (armed, no overlay). Overlay/P cut immediately.
  const shouldIdleFade =
    preview === null &&
    isIdleFading &&
    isOutputOpen &&
    audioModality === AUDIO_MODALITIES.AUTO;

  const value = useMemo(
    () => ({
      // Full snapshot; groups/channels are convenience aliases of the same data.
      mixerState,
      master: mixerState.master,
      groups: mixerState.groups,
      channels: mixerState.channels,
      setMasterVolume,
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
      getSettingsSnapshot,
      restoreSettingsSnapshot,
      resetToDefaults,
      previewChannel,
      preparePreviews,
      previewingChannelId: preview?.channelId ?? null,
      isPreviewing: preview !== null,
    }),
    [
      mixerState,
      setMasterVolume,
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
      getSettingsSnapshot,
      restoreSettingsSnapshot,
      resetToDefaults,
      previewChannel,
      preparePreviews,
      preview,
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
