import * as Tone from "tone";

/**
 * Hybrid mixer bus: owns Tone.js group/channel Gain nodes and exposes a plain
 * state API the UI can bind to without touching Tone.
 *
 * Signal flow:
 *   source → [existing Channel / Player volume logic] → channelGain → groupGain → output
 *
 * Channel and group volumes are linear 0..1 and act as the base level that
 * application attenuation (e.g. mouse-distance channel.volume) multiplies against.
 */

export const MIXER_GROUPS = Object.freeze({
  earcons: "earcons",
  instruments: "instruments",
  noise: "noise",
});

export const MIXER_GROUP_LABELS = Object.freeze({
  [MIXER_GROUPS.earcons]: "Earcons",
  [MIXER_GROUPS.instruments]: "Instruments",
  [MIXER_GROUPS.noise]: "Noise",
});

/** Well-known channel ids used by GraphSonification / audioSamples. */
export const MIXER_CHANNELS = Object.freeze({
  tick: "tick",
  pinkNoise: "pinkNoise",
  sample: (sampleName) => `sample:${sampleName}`,
  instrument: (functionId) => `instrument:${functionId}`,
});

const DEFAULT_VOLUME = 1;

const createControlState = (id, label, groupId = null) => ({
  id,
  label,
  groupId,
  muted: false,
  volume: DEFAULT_VOLUME,
});

class MixerBus {
  constructor() {
    this._listeners = new Set();
    this._initialized = false;
    this._output = null;
    this._groups = new Map();
    this._channels = new Map();
    this._groupState = {};
    this._channelState = {};

    Object.values(MIXER_GROUPS).forEach((groupId) => {
      this._groupState[groupId] = createControlState(
        groupId,
        MIXER_GROUP_LABELS[groupId]
      );
    });
  }

  /**
   * Create group Gain nodes and connect them to `output` (typically masterGain).
   * Safe to call multiple times; reconnects groups if the output changes.
   */
  initialize(output = Tone.getDestination()) {
    this._output = output;

    Object.values(MIXER_GROUPS).forEach((groupId) => {
      let entry = this._groups.get(groupId);
      if (!entry) {
        const gain = new Tone.Gain(DEFAULT_VOLUME);
        entry = { gain };
        this._groups.set(groupId, entry);
      }

      entry.gain.disconnect();
      entry.gain.connect(output);
      this._applyGroupAudio(groupId);
    });

    // Reconnect existing channels to their groups (e.g. after master gain recreate)
    this._channels.forEach((entry, channelId) => {
      const group = this._groups.get(entry.groupId);
      if (!group) return;
      entry.gain.disconnect();
      entry.gain.connect(group.gain);
      this._applyChannelAudio(channelId);
    });

    this._initialized = true;
    this._notify();
    return this;
  }

  isInitialized() {
    return this._initialized;
  }

  /** Tone node sources should connect into (group bus). */
  getGroupInput(groupId) {
    this._assertGroup(groupId);
    if (!this._groups.has(groupId)) {
      this.initialize(this._output || Tone.getDestination());
    }
    return this._groups.get(groupId).gain;
  }

  /**
   * Ensure a mixer channel exists and return its Gain input.
   * Sources connect here; the channel feeds its group bus.
   */
  ensureChannel(channelId, groupId, label = channelId) {
    this._assertGroup(groupId);

    if (!this._initialized) {
      this.initialize(this._output || Tone.getDestination());
    }

    let entry = this._channels.get(channelId);
    if (!entry) {
      const gain = new Tone.Gain(DEFAULT_VOLUME);
      entry = { gain, groupId };
      this._channels.set(channelId, entry);

      // Preserve mute/volume if this channel existed before a graph rebuild
      if (!this._channelState[channelId]) {
        this._channelState[channelId] = createControlState(channelId, label, groupId);
      } else {
        this._channelState[channelId].groupId = groupId;
        this._channelState[channelId].label = label;
      }

      const group = this._groups.get(groupId);
      if (group) {
        gain.connect(group.gain);
      }
      this._applyChannelAudio(channelId);
      this._notify();
    } else if (entry.groupId !== groupId) {
      entry.gain.disconnect();
      entry.groupId = groupId;
      this._channelState[channelId].groupId = groupId;
      const group = this._groups.get(groupId);
      if (group) {
        entry.gain.connect(group.gain);
      }
      this._notify();
    }

    return entry.gain;
  }

  getChannelInput(channelId) {
    const entry = this._channels.get(channelId);
    return entry ? entry.gain : null;
  }

  hasChannel(channelId) {
    return this._channels.has(channelId);
  }

  removeChannel(channelId) {
    this.disposeChannelAudio(channelId);
    delete this._channelState[channelId];
    this._notify();
  }

  /**
   * Dispose the Tone Gain for a channel but keep mute/volume state so a later
   * ensureChannel() restores the user's mixer settings.
   */
  disposeChannelAudio(channelId) {
    const entry = this._channels.get(channelId);
    if (!entry) return;

    try {
      entry.gain.disconnect();
      entry.gain.dispose();
    } catch {
      // ignore disposal races
    }
    this._channels.delete(channelId);
  }

  // --- UI-facing controls ---

  getState() {
    return {
      groups: { ...Object.fromEntries(
        Object.entries(this._groupState).map(([id, state]) => [id, { ...state }])
      ) },
      channels: { ...Object.fromEntries(
        Object.entries(this._channelState).map(([id, state]) => [id, { ...state }])
      ) },
    };
  }

  setGroupVolume(groupId, volume) {
    this._assertGroup(groupId);
    const state = this._groupState[groupId];
    state.volume = this._clampVolume(volume);
    this._applyGroupAudio(groupId);
    this._notify();
  }

  setGroupMuted(groupId, muted) {
    this._assertGroup(groupId);
    this._groupState[groupId].muted = Boolean(muted);
    this._applyGroupAudio(groupId);
    this._notify();
  }

  setChannelVolume(channelId, volume) {
    if (!this._channelState[channelId]) return;
    this._channelState[channelId].volume = this._clampVolume(volume);
    this._applyChannelAudio(channelId);
    this._notify();
  }

  setChannelMuted(channelId, muted) {
    if (!this._channelState[channelId]) return;
    this._channelState[channelId].muted = Boolean(muted);
    this._applyChannelAudio(channelId);
    this._notify();
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Disconnect and dispose all Tone nodes. Call when tearing down the audio graph.
   * State (mute/volume values) is preserved so UI settings survive a rebuild.
   */
  disposeAudio() {
    this._channels.forEach((entry) => {
      try {
        entry.gain.disconnect();
        entry.gain.dispose();
      } catch {
        // ignore
      }
    });
    this._channels.clear();

    this._groups.forEach((entry) => {
      try {
        entry.gain.disconnect();
        entry.gain.dispose();
      } catch {
        // ignore
      }
    });
    this._groups.clear();

    this._output = null;
    this._initialized = false;
  }

  // --- internals ---

  _applyGroupAudio(groupId) {
    const entry = this._groups.get(groupId);
    const state = this._groupState[groupId];
    if (!entry || !state) return;
    entry.gain.gain.value = state.muted ? 0 : state.volume;
  }

  _applyChannelAudio(channelId) {
    const entry = this._channels.get(channelId);
    const state = this._channelState[channelId];
    if (!entry || !state) return;
    entry.gain.gain.value = state.muted ? 0 : state.volume;
  }

  _clampVolume(volume) {
    const n = Number(volume);
    if (!Number.isFinite(n)) return DEFAULT_VOLUME;
    return Math.max(0, Math.min(1, n));
  }

  _assertGroup(groupId) {
    if (!Object.values(MIXER_GROUPS).includes(groupId)) {
      throw new Error(`Unknown mixer group: ${groupId}`);
    }
  }

  _notify() {
    const snapshot = this.getState();
    this._listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("MixerBus listener error:", error);
      }
    });
  }
}

const mixerBus = new MixerBus();

export default mixerBus;
