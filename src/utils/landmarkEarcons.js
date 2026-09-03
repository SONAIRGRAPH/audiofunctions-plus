import audioSampleManager from "./audioSamples";

/**
 * Landmark Earcon System
 * Creates distinctive audio feedback for different landmark shapes using Tone.js synthesis
 */

class LandmarkEarconManager {
  constructor() {
    this.synths = new Map();
    this.channels = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the earcon system
   */
  async initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  // No synth creation needed when using samples

  /**
   * Play earcon for a specific landmark shape
   * @param {string} shape - The landmark shape ("diamond", "triangle", "square")
   * @param {Object} options - Optional parameters for customization
   */
  playEarcon(shape, options = {}) {
    if (!this.isInitialized) {
      console.warn("LandmarkEarconManager not initialized");
      return;
    }

    // Map shapes to landmark sample names
    let sampleName = null;
    switch (shape) {
      case "square":
        sampleName = "landmark_square";
        break;
      case "triangle":
        sampleName = "landmark_triangle";
        break;
      case "diamond":
        sampleName = "landmark_diamond";
        break;
      case "triangle":
      default:
        // Changed: use triangle sample as default instead of diamond
        sampleName = "landmark_triangle";
        break;
    }

    try {
      audioSampleManager.playSample(sampleName, {
        volume: options.volume !== undefined ? options.volume : -12,
        pan: options.pan
      });
    } catch (error) {
      console.error(`Error playing landmark sample for shape ${shape}:`, error);
    }
  }

  /**
   * Play earcon for a landmark with automatic shape detection
   * @param {Object} landmark - The landmark object
   * @param {Object} options - Optional parameters
   */
  playLandmarkEarcon(landmark, options = {}) {
    if (!landmark) return;

    const shape = landmark.shape || landmark.appearance || "triangle";
    this.playEarcon(shape, options);
  }

  /**
   * Stop all earcons
   */
  stopAllEarcons() {
    // Stop all currently playing samples
    try {
      // Delegate to sample manager to stop all if needed
      if (audioSampleManager && audioSampleManager.stopAllSamples) {
        audioSampleManager.stopAllSamples();
      }
    } catch (error) {
      console.error("Error stopping landmark samples:", error);
    }
  }

  /**
   * Set volume for all earcons
   * @param {number} volume - Volume in dB
   */
  setVolume(volume) {
    // Not globally supported for samples; leave no-op for now
  }

  /**
   * Test all earcon shapes (for development/testing)
   */
  testAllEarcons() {
    if (!this.isInitialized) {
      console.warn("LandmarkEarconManager not initialized");
      return;
    }

    // console.log("Testing all landmark earcons...");

    // Test each shape with a slight delay
    setTimeout(() => this.playEarcon("diamond"), 0);
    setTimeout(() => this.playEarcon("triangle"), 1000);
    setTimeout(() => this.playEarcon("square"), 2000);
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.synths.clear();
    this.channels.clear();
    this.isInitialized = false;
  }
}

// Create singleton instance
const landmarkEarconManager = new LandmarkEarconManager();

export default landmarkEarconManager;
