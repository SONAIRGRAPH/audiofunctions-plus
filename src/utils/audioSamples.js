import * as Tone from "tone";
import mixerBus, { MIXER_GROUPS, MIXER_CHANNELS } from "../audio/mixerBus";

class AudioSampleManager {
  constructor() {
    this.samples = new Map(); // Store loaded samples
    this.samplePlayers = new Map(); // Store Tone.js players
    this.isInitialized = false;
  }

  // Initialize the audio context
  async initialize() {
    if (this.isInitialized) return;

    try {
      await Tone.start();
      this.isInitialized = true;
      // console.log("AudioSampleManager initialized");
    } catch (error) {
      console.error("Failed to initialize AudioSampleManager:", error);
    }
  }

  _connectPlayerToMixer(sampleName, player, panner) {
    const channelId = MIXER_CHANNELS.sample(sampleName);
    const gain = mixerBus.ensureChannel(
      channelId,
      MIXER_GROUPS.earcons,
      sampleName
    );
    player.disconnect();
    if (panner) {
      panner.disconnect();
      player.connect(panner);
      panner.connect(gain);
    } else {
      player.connect(gain);
    }
  }

  /**
   * Re-attach all loaded players to the mixer (e.g. after master-gain / group rebuild).
   */
  reconnectAllToMixer() {
    this.samples.forEach((sample, sampleName) => {
      if (sample?.player) {
        this._connectPlayerToMixer(sampleName, sample.player, sample.panner);
      }
    });
  }

  // Load an audio sample from the public/audio-samples folder
  async loadSample(sampleName, filename) {
    if (this.samples.has(sampleName)) {
      console.warn(`Sample ${sampleName} already loaded`);
      return;
    }

    try {
      // Ensure audio context is started before loading samples
      if (!this.isInitialized) {
        await this.initialize();
      }

      const samplePath = `/audio-samples/${filename}`;

      // Player → stereo panner → earcons mixer. Pan defaults to center;
      // cursor-related earcons set it per playback to match instrument sonification.
      const player = new Tone.Player();
      const panner = new Tone.Panner(0);
      this._connectPlayerToMixer(sampleName, player, panner);

      // Store both the player and metadata
      this.samples.set(sampleName, {
        player,
        panner,
        filename,
        path: samplePath,
        loaded: false
      });

      // Load the sample and wait for it to be ready
      await player.load(samplePath);

      // Wait a bit more to ensure the buffer is fully loaded
      await new Promise(resolve => setTimeout(resolve, 50));

      // Mark as loaded
      this.samples.get(sampleName).loaded = true;
      // console.log(`Audio sample ${sampleName} loaded successfully`);

    } catch (error) {
      console.error(`Failed to load audio sample ${sampleName}:`, error);
      const failed = this.samples.get(sampleName);
      if (failed) {
        try { failed.player?.dispose(); } catch (_) { /* ignore */ }
        try { failed.panner?.dispose(); } catch (_) { /* ignore */ }
      }
      this.samples.delete(sampleName);
      mixerBus.removeChannel(MIXER_CHANNELS.sample(sampleName));
    }
  }

  // Load multiple samples at once
  async loadSamples(sampleConfigs) {
    const loadPromises = sampleConfigs.map(config =>
      this.loadSample(config.name, config.filename)
    );

    try {
      await Promise.all(loadPromises);
      // console.log("All audio samples loaded successfully");
    } catch (error) {
      console.error("Some audio samples failed to load:", error);
    }
  }

  // Play a specific sample (loads on-demand if not already loaded)
  async playSample(sampleName, options = {}) {
    let sample = this.samples.get(sampleName);

    // If sample doesn't exist, try to load it
    if (!sample) {
      // console.log(`Loading audio sample ${sampleName} on-demand...`);
      try {
        await this.loadSample(sampleName, this.getFilenameForSample(sampleName));
        sample = this.samples.get(sampleName);
      } catch (error) {
        console.error(`Failed to load audio sample ${sampleName} on-demand:`, error);
        return;
      }
    }

    if (!sample || !sample.loaded) {
      console.warn(`Audio sample ${sampleName} not loaded`);
      return;
    }

    try {
      const player = sample.player;

      // Check if the player is ready to play
      if (!player.loaded) {
        console.warn(`Audio sample ${sampleName} player not ready`);
        return;
      }

      // Re-attach to mixer in case the bus was rebuilt after master-gain init
      if (!mixerBus.hasChannel(MIXER_CHANNELS.sample(sampleName))) {
        this._connectPlayerToMixer(sampleName, player, sample.panner);
      }

      // Apply options
      if (options.volume !== undefined) {
        player.volume.value = options.volume;
      }

      if (options.playbackRate !== undefined) {
        player.playbackRate = options.playbackRate;
      }

      // Same stereo range as Tone.Channel used by the instrument / tick sonification
      if (sample.panner) {
        const pan = options.pan;
        if (typeof pan === "number" && Number.isFinite(pan)) {
          sample.panner.pan.value = Math.max(-1, Math.min(1, pan));
        } else {
          sample.panner.pan.value = 0;
        }
      }

      // Use a simple approach: stop any current playback and start fresh
      try {
        player.stop();
      } catch (error) {
        // Ignore stop errors
      }

      // Play immediately without timing constraints
      player.start();

      // console.log(`Playing audio sample: ${sampleName}`);

    } catch (error) {
      console.error(`Failed to play audio sample ${sampleName}:`, error);
    }
  }

  // Helper method to get filename for a sample name
  getFilenameForSample(sampleName) {
    const filenameMap = {
      'chart_border': 'chart_border.mp3',
      'chart_border_start': 'chart_border_start.mp3',
      'no_y': 'no_y.mp3',
      'y_axis_intersection': 'y-axis-intersection.wav',
      'deny': 'deny.wav',
      'notification': 'notification.mp3',
      // Landmark earcons
      'landmark_square': 'landmark_square.mp3',
      'landmark_triangle': 'landmark_triangle.mp3',
      'landmark_diamond': 'landmark_diamond.mp3'
    };
    return filenameMap[sampleName];
  }

  // Stop a specific sample
  stopSample(sampleName) {
    const sample = this.samples.get(sampleName);

    if (sample && sample.loaded) {
      try {
        sample.player.stop();
        // console.log(`Stopped audio sample: ${sampleName}`);
      } catch (error) {
        console.error(`Failed to stop audio sample ${sampleName}:`, error);
      }
    }
  }

  // Stop all samples
  stopAllSamples() {
    this.samples.forEach((sample, name) => {
      if (sample.loaded) {
        try {
          sample.player.stop();
        } catch (error) {
          console.error(`Failed to stop audio sample ${name}:`, error);
        }
      }
    });
  }

  // Get list of loaded samples
  getLoadedSamples() {
    const loadedSamples = [];
    this.samples.forEach((sample, name) => {
      if (sample.loaded) {
        loadedSamples.push({
          name,
          filename: sample.filename,
          path: sample.path
        });
      }
    });
    return loadedSamples;
  }

  // Check if a sample is loaded
  isSampleLoaded(sampleName) {
    const sample = this.samples.get(sampleName);
    return sample && sample.loaded;
  }

  // Dispose of all samples and clean up
  dispose() {
    this.samples.forEach((sample, name) => {
      if (sample.loaded) {
        try {
          sample.player.dispose();
        } catch (error) {
          console.error(`Failed to dispose audio sample ${name}:`, error);
        }
      }
      if (sample.panner) {
        try {
          sample.panner.dispose();
        } catch (error) {
          console.error(`Failed to dispose panner for audio sample ${name}:`, error);
        }
      }
      mixerBus.disposeChannelAudio(MIXER_CHANNELS.sample(name));
    });

    this.samples.clear();
    this.isInitialized = false;
    // console.log("AudioSampleManager disposed");
  }
}

// Create a singleton instance
const audioSampleManager = new AudioSampleManager();

export default audioSampleManager;
