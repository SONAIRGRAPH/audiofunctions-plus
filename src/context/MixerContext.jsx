import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import mixerBus, { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS } from "../audio/mixerBus";

/**
 * MixerContext — React API for the audio mixer (UI colleagues).
 *
 * Mental model (volume desk with folders):
 *   source → channel fader → group fader → master (P key, not this context) → speakers
 *
 * Groups (always 3): instruments, earcons, noise.
 * Channels (dynamic): one strip per source, e.g. instrument:f1, tick, sample:chart_border.
 *
 * UI should use `useMixer()` only. Do not import mixerBus or Tone.js from UI code.
 * Full guide with examples: ./mixer-ui.md
 */

const MixerContext = createContext(null);

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
 *
 * `groups` / `channels` update automatically when the bus creates, removes, or
 * changes a strip. Re-renders happen via mixerBus.subscribe.
 *
 * P (master mute) is NOT exposed here — that lives on masterGain in GraphSonification.
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
 */
export const MixerProvider = ({ children }) => {
  // Seed from the bus so first paint already has the three groups
  // (channels appear later, when sonification creates them).
  const [mixerState, setMixerState] = useState(() => mixerBus.getState());

  // Push a new { groups, channels } snapshot whenever the bus notifies
  // (ensureChannel, removeChannel, setGroupVolume/Muted, setChannelVolume/Muted).
  // setInstrumentsGate does not notify — it is not a UI mute/volume change.
  useEffect(() => {
    return mixerBus.subscribe(setMixerState);
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

  return (
    <MixerContext.Provider
      value={{
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
      }}
    >
      {children}
    </MixerContext.Provider>
  );
};

export { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS };
export default MixerContext;
