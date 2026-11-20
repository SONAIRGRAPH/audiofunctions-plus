import * as Tone from "tone";

/**
 * Hybrid mixer bus: owns Tone.js group/channel Gain nodes and exposes a plain
 * state API the UI can bind to without touching Tone.
 *
 * Signal flow:
 *   source → [existing Channel / Player volume logic] → channelGain → groupGain → output
 *
 * The overall (master) volume is folded into every group gain instead of
 * adding another node.
 *
 * Master, group and channel volumes are linear gains relative to each source's
 * built-in level (1 = as designed, above 1 = boost). Application attenuation
 * (e.g. mouse-distance channel.volume) multiplies against them. The slider
 * limits per strip live in fader.js / mixerCatalog.js.
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
// Gains are relative to each source's built-in level and may boost it (a
// quiet earcon can go up to 0 dB). The exact limit per strip comes from the
// fader range (fader.js); this is only a guard against absurd values.
const MAX_VOLUME = 100;

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
    // 0/1 gate for discrete batch: silence instruments until the valid start X
    // without muting earcons, ticks, or noise (those share the same master output).
    this._instrumentsGate = 1;
    // Channel that alone may sound while a mixer preview plays (null = no preview)
    this._previewSolo = null;
    // Overall volume above the three groups (linear gain, 1 = unchanged). Not a mute: on/off
    // stays with P and the master gate in GraphSonification.
    this._masterVolume = DEFAULT_VOLUME;
    // channelId -> function that plays a short sample of that channel
    this._previews = new Map();

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

  /**
   * Create mixer state for a channel without any audio node. Lets the UI show
   * and restore settings for a channel before its sound has played once; a
   * later ensureChannel() keeps this state.
   */
  presetChannel(channelId, groupId, label = channelId) {
    this._assertGroup(groupId);
    if (this._channelState[channelId]) return;
    this._channelState[channelId] = createControlState(channelId, label, groupId);
    this._notify();
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
      master: { volume: this._masterVolume },
      groups: { ...Object.fromEntries(
        Object.entries(this._groupState).map(([id, state]) => [id, { ...state }])
      ) },
      // `previewable`: some engine has registered a preview for the channel
      channels: { ...Object.fromEntries(
        Object.entries(this._channelState).map(([id, state]) => [
          id,
          { ...state, previewable: this._previews.has(id) },
        ])
      ) },
    };
  }

  setMasterVolume(volume) {
    this._masterVolume = this._clampVolume(volume);
    Object.values(MIXER_GROUPS).forEach((id) => this._applyGroupAudio(id));
    this._notify();
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

  /**
   * Discrete-batch sonification gate for the instruments group only (0 or 1).
   * Does not change UI mixer volume/mute; multiplies with them.
   */
  setInstrumentsGate(gate) {
    this._instrumentsGate = gate ? 1 : 0;
    this._applyGroupAudio(MIXER_GROUPS.instruments);
  }

  getInstrumentsGate() {
    return this._instrumentsGate;
  }

  /**
   * Apply many group/channel settings at once with a single notification.
   * Unknown groups and channels without state are skipped.
   * @param {{groups?: Record<string, {volume?: number, muted?: boolean}>,
   *          channels?: Record<string, {volume?: number, muted?: boolean}>}} settings
   */
  applySettings({ master, groups = {}, channels = {} } = {}) {
    if (master?.volume !== undefined) this._masterVolume = this._clampVolume(master.volume);
    Object.entries(groups).forEach(([groupId, values]) => {
      const state = this._groupState[groupId];
      if (!state || !values) return;
      if (values.volume !== undefined) state.volume = this._clampVolume(values.volume);
      if (values.muted !== undefined) state.muted = Boolean(values.muted);
      this._applyGroupAudio(groupId);
    });
    Object.entries(channels).forEach(([channelId, values]) => {
      const state = this._channelState[channelId];
      if (!state || !values) return;
      if (values.volume !== undefined) state.volume = this._clampVolume(values.volume);
      if (values.muted !== undefined) state.muted = Boolean(values.muted);
      this._applyChannelAudio(channelId);
    });
    this._notify();
  }

  /**
   * While a mixer preview plays, only this channel (and its group) may sound;
   * null ends it. Other function tones or earcons that happen to fire stay
   * silent. Multiplies with the user's volume and the instruments gate.
   */
  setPreviewSolo(channelId) {
    this._previewSolo = channelId;
    Object.values(MIXER_GROUPS).forEach((id) => this._applyGroupAudio(id));
    Object.keys(this._channelState).forEach((id) => this._applyChannelAudio(id));
  }

  /**
   * Sound engines register how to play a short sample of their channel, so
   * the mixer can preview every source without owning it (samples, tick,
   * pink noise, function tones). Notifies, since the UI shows a preview
   * button only for channels that have one.
   * @returns {() => void} unregister
   */
  registerPreview(channelId, play) {
    this._previews.set(channelId, play);
    this._notify();
    return () => {
      if (this._previews.get(channelId) !== play) return;
      this._previews.delete(channelId);
      this._notify();
    };
  }

  hasPreview(channelId) {
    return this._previews.has(channelId);
  }

  /**
   * Play the registered preview of a channel. Resolves once the sound has
   * started (samples may load first); false if there is no preview.
   */
  async runPreview(channelId) {
    const play = this._previews.get(channelId);
    if (!play) return false;
    try {
      await play();
    } catch (error) {
      console.error(`Mixer preview failed for "${channelId}":`, error);
    }
    return true;
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
    this._instrumentsGate = 1;
  }

  // --- internals ---

  _applyGroupAudio(groupId) {
    const entry = this._groups.get(groupId);
    const state = this._groupState[groupId];
    if (!entry || !state) return;
    const userGain = state.muted ? 0 : state.volume;
    const gate =
      groupId === MIXER_GROUPS.instruments ? this._instrumentsGate : 1;
    const soloGroupId = this._previewSolo && this._channelState[this._previewSolo]?.groupId;
    const solo = soloGroupId && soloGroupId !== groupId ? 0 : 1;
    entry.gain.gain.value = userGain * gate * solo * this._masterVolume;
  }

  _applyChannelAudio(channelId) {
    const entry = this._channels.get(channelId);
    const state = this._channelState[channelId];
    if (!entry || !state) return;
    const solo = this._previewSolo && this._previewSolo !== channelId ? 0 : 1;
    entry.gain.gain.value = (state.muted ? 0 : state.volume) * solo;
  }

  _clampVolume(volume) {
    const n = Number(volume);
    if (!Number.isFinite(n)) return DEFAULT_VOLUME;
    return Math.max(0, Math.min(MAX_VOLUME, n));
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
