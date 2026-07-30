import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import mixerBus, { MIXER_GROUPS, MIXER_GROUP_LABELS, MIXER_CHANNELS } from "../audio/mixerBus";

const MixerContext = createContext(null);

/**
 * React facade over the mixerBus singleton.
 * UI code should use this hook; audio engines may import mixerBus directly.
 */
export const useMixer = () => {
  const context = useContext(MixerContext);
  if (!context) {
    throw new Error("useMixer must be used within a MixerProvider");
  }
  return context;
};

export const MixerProvider = ({ children }) => {
  const [mixerState, setMixerState] = useState(() => mixerBus.getState());

  useEffect(() => {
    return mixerBus.subscribe(setMixerState);
  }, []);

  const setGroupVolume = useCallback((groupId, volume) => {
    mixerBus.setGroupVolume(groupId, volume);
  }, []);

  const setGroupMuted = useCallback((groupId, muted) => {
    mixerBus.setGroupMuted(groupId, muted);
  }, []);

  const setChannelVolume = useCallback((channelId, volume) => {
    mixerBus.setChannelVolume(channelId, volume);
  }, []);

  const setChannelMuted = useCallback((channelId, muted) => {
    mixerBus.setChannelMuted(channelId, muted);
  }, []);

  return (
    <MixerContext.Provider
      value={{
        mixerState,
        groups: mixerState.groups,
        channels: mixerState.channels,
        setGroupVolume,
        setGroupMuted,
        setChannelVolume,
        setChannelMuted,
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
