import React, { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { useGraphContext } from "../../context/GraphContext";
import { useInstruments } from "../../context/InstrumentsContext";
import { useDialog } from "../../context/DialogContext";
import { GLOBAL_FREQUENCY_RANGE, InstrumentFrequencyType } from "../../config/instruments";
import {
  getActiveFunctions,
  getFunctionById,
  isFunctionActiveN,
  getFunctionInstrumentN,
  getFunctionIndexById,
  getLandmarksN
} from "../../utils/graphObjectOperations";
import audioSampleManager from "../../utils/audioSamples";
import landmarkEarconManager from "../../utils/landmarkEarcons";
import { horizontalEdge, resolveBorderEvent } from "../../utils/boundaryGeometry";

const GraphSonification = () => {
  const {
    cursorCoords,
    isAudioEnabled,
    graphBounds,
    functionDefinitions,
    stepSize, // <-- get stepSize from context
    PlayFunction, // <-- get PlayFunction to detect exploration mode
    explorationMode, // <-- get exploration mode for robust detection
    isShiftPressed, // <-- get Shift key state
    discreteBatchValidStartX // <-- get valid start X position for discrete batch sonification
  } = useGraphContext();

  // Refs to track previous states for event detection
  const prevCursorCoordsRef = useRef(new Map()); // Track previous cursor positions
  const prevXSignRef = useRef(new Map()); // Track previous x coordinate signs for y-axis intersection
  const boundaryTriggeredRef = useRef(new Map()); // Track if boundary event was recently triggered to avoid spam
  const yAxisTriggeredRef = useRef(new Map()); // Track if y-axis intersection was recently triggered
  const prevLandmarkPositionsRef = useRef(new Map()); // Track previous cursor positions for landmark crossing detection
  const lastTickIndexRef = useRef(null); // Track last ticked index
  const tickSynthRef = useRef(null); // Reference to tick synth
  const tickChannelRef = useRef(null); // Reference to tick channel for panning
  const masterGainRef = useRef(null); // Reference to master gain node for discrete batch sonification control
  const chartBorderLastPlayedRef = useRef(0); // When the chart border earcon last sounded
  const borderEdgeRef = useRef(null); // Horizontal border the cursor currently occupies: "left" | "right" | null

  const { getInstrumentByName } = useInstruments();
  const { isEditFunctionDialogOpen, isEditLandmarkDialogOpen } = useDialog();
  const instrumentsRef = useRef(new Map()); // Map to store instrument references
  const channelsRef = useRef(new Map()); // Map to store channel references
  const lastPitchClassesRef = useRef(new Map()); // Map to store last pitch class for discrete instruments
  const pinkNoiseRef = useRef(null); // Reference to pink noise synthesizer
  const [forceRecreate, setForceRecreate] = useState(false); // State to force recreation of sonification pipeline
  const batchResetDoneRef = useRef(false); // Track if batch reset has been done
  const prevActiveFunctionIdsRef = useRef(new Set()); // Track previously active function IDs to detect function switches
  const batchStartEarconPlayedRef = useRef(false); // Track if chart_border_start earcon has been played for current batch
  const wasAtLeftBoundaryRef = useRef(false); // Track if cursor was at left boundary in previous tick

  // Initialize tick synth
  useEffect(() => {
    if (!tickSynthRef.current) {
      tickSynthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.001,
        octaves: 1,
        envelope: {
          attack: 0,
          decay: 0.05,
          sustain: 0,
          release: 0
        },
        volume: -18 // Lower volume in dB
      });

      // Create a channel for the tick synth to handle panning
      tickChannelRef.current = new Tone.Channel({
        pan: 0,
        volume: 0
      });

      // Connect to master gain if available, otherwise to destination
      if (masterGainRef.current) {
        tickChannelRef.current.connect(masterGainRef.current);
      } else {
        tickChannelRef.current.toDestination();
      }

      // Connect tick synth to its channel
      tickSynthRef.current.connect(tickChannelRef.current);
    }

    return () => {
      if (tickSynthRef.current) {
        tickSynthRef.current.dispose();
        tickSynthRef.current = null;
      }
      if (tickChannelRef.current) {
        tickChannelRef.current.disconnect();
        tickChannelRef.current.dispose();
        tickChannelRef.current = null;
      }
    };
  }, []);

  // Initialize pink noise synthesizer
  useEffect(() => {
    if (!pinkNoiseRef.current) {
      pinkNoiseRef.current = new Tone.Noise("pink").toDestination();
      pinkNoiseRef.current.volume.value = -36; // dB - low volume background sound
    }

    return () => {
      if (pinkNoiseRef.current) {
        pinkNoiseRef.current.dispose();
        pinkNoiseRef.current = null;
      }
    };
  }, []);

  // Initialize master gain node for discrete batch sonification control
  useEffect(() => {
    if (!masterGainRef.current) {
      masterGainRef.current = new Tone.Gain(1).toDestination();

      // Reconnect all existing channels to master gain
      channelsRef.current.forEach((channel) => {
        channel.disconnect();
        channel.connect(masterGainRef.current);
      });

      // Reconnect tick channel if it exists
      if (tickChannelRef.current) {
        tickChannelRef.current.disconnect();
        tickChannelRef.current.connect(masterGainRef.current);
      }
    }

    return () => {
      if (masterGainRef.current) {
        masterGainRef.current.dispose();
        masterGainRef.current = null;
      }
    };
  }, []);

  // Initialize audio sample manager and landmark earcons
  useEffect(() => {
    const initializeAudioSystems = async () => {
      try {
        // Wait for Tone.js to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));

        await audioSampleManager.initialize();
        await landmarkEarconManager.initialize();
        // console.log("Audio systems initialized (samples and landmark earcons)");
      } catch (error) {
        console.error("Failed to initialize audio systems:", error);
      }
    };

    initializeAudioSystems();

    return () => {
      // Cleanup audio systems
      audioSampleManager.dispose();
      landmarkEarconManager.dispose();
    };
  }, []);

  // Initialize channels for all functions
  useEffect(() => {
    // Check if we need to force recreation of the entire pipeline
    if (forceRecreate) {
      // console.log("Forcing recreation of channels");

      // Dispose all existing channels
      channelsRef.current.forEach(channel => {
        channel.dispose();
      });
      channelsRef.current.clear();
    }

    // Create or update channels for each function
    functionDefinitions.forEach((func, index) => {
      const functionId = func.id;
      if (!channelsRef.current.has(functionId)) {
        const channel = new Tone.Channel({
          pan: 0,
          mute: !isFunctionActiveN(functionDefinitions, index),
          volume: 0
        });

        // Connect to master gain node if available, otherwise to destination
        if (masterGainRef.current) {
          channel.connect(masterGainRef.current);
        } else {
          channel.toDestination();
        }

        channelsRef.current.set(functionId, channel);
      } else {
        // Update existing channel's mute state
        const channel = channelsRef.current.get(functionId);
        if (channel) {
          channel.mute = !isFunctionActiveN(functionDefinitions, index);
        }
      }
    });

    // Clean up unused channels
    Array.from(channelsRef.current.keys()).forEach(functionId => {
      if (!getFunctionById(functionDefinitions, functionId)) {
        const channel = channelsRef.current.get(functionId);
        if (channel) {
          channel.disconnect();
          channel.dispose();
        }
        channelsRef.current.delete(functionId);
      }
    });

    return () => {
      channelsRef.current.forEach(channel => {
        channel.disconnect();
        channel.dispose();
      });
      channelsRef.current.clear();
    };
  }, [functionDefinitions, forceRecreate]);

  // Manage instruments and their connections
  useEffect(() => {
    // Check if we need to force recreation of the entire pipeline
    if (forceRecreate) {
      // console.log("Forcing recreation of sonification pipeline");

      // Dispose all existing instruments
      instrumentsRef.current.forEach(instrument => {
        if (instrument.dispose) {
          instrument.dispose();
        }
      });
      instrumentsRef.current.clear();

      // Clear last pitch classes
      lastPitchClassesRef.current.clear();

      // Reset batch exploration tracking
      batchResetDoneRef.current = false;

      // Reset the flag
      setForceRecreate(false);
    }

    const activeFunctions = getActiveFunctions(functionDefinitions);

    // Clean up unused instruments
    Array.from(instrumentsRef.current.keys()).forEach(functionId => {
      if (!getFunctionById(functionDefinitions, functionId)) {
        if (instrumentsRef.current.get(functionId)) {
          instrumentsRef.current.get(functionId).dispose();
        }
        instrumentsRef.current.delete(functionId);
      }
    });

    // Set up instruments for active functions
    activeFunctions.forEach(func => {
      if (!instrumentsRef.current.has(func.id)) {
        const functionIndex = getFunctionIndexById(functionDefinitions, func.id);
        const instrumentConfig = getInstrumentByName(getFunctionInstrumentN(functionDefinitions, functionIndex));
        if (instrumentConfig && instrumentConfig.createInstrument) {
          const instrument = instrumentConfig.createInstrument();
          instrumentsRef.current.set(func.id, instrument);

          // Connect to channel
          const channel = channelsRef.current.get(func.id);
          if (channel) {
            instrument.connect(channel);

            // Special case for organ
            if (getFunctionInstrumentN(functionDefinitions, functionIndex) === 'organ') {
              instrument.start();
            }
          }
        }
      }
    });

    Tone.start();

    return () => {
      instrumentsRef.current.forEach(instrument => {
        if (instrument.dispose) {
          instrument.dispose();
        }
      });
      instrumentsRef.current.clear();
    };
  }, [functionDefinitions, getInstrumentByName, forceRecreate]);

  // Clean up sonification when edit dialog closes
  useEffect(() => {
    let timeoutId = null;

    if (!isEditFunctionDialogOpen && !isEditLandmarkDialogOpen && isAudioEnabled) {
      // When edit dialog closes, force recreation of the entire sonification pipeline
      // console.log("Sonification resumed: Edit dialog closed - forcing pipeline recreation");

      // Stop all current tones and clear references immediately
      stopAllTones();
      stopPinkNoise();

      // Force recreation with a small delay to ensure state updates are complete
      timeoutId = setTimeout(() => {
        setForceRecreate(true);
      }, 50);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isEditFunctionDialogOpen, isEditLandmarkDialogOpen, isAudioEnabled]);

  // Reset lastPitchClass for functions that just became active (for discrete sonification)
  useEffect(() => {
    if (!isAudioEnabled || isEditFunctionDialogOpen) return;

    // Get currently active function IDs
    const activeFunctionIds = new Set(
      functionDefinitions
        .filter(func => func.isActive)
        .map(func => func.id)
    );

    // Find functions that just became active (were not active before but are now)
    const newlyActiveFunctionIds = Array.from(activeFunctionIds).filter(
      functionId => !prevActiveFunctionIdsRef.current.has(functionId)
    );

    // Reset lastPitchClass for newly active functions to ensure note plays on function switch
    newlyActiveFunctionIds.forEach(functionId => {
      lastPitchClassesRef.current.delete(functionId);
      // console.log(`Function ${functionId} just became active - resetting lastPitchClass for discrete sonification`);
    });

    // Update the previous active function IDs (create a new Set to avoid mutation issues)
    prevActiveFunctionIdsRef.current = new Set(activeFunctionIds);
  }, [functionDefinitions, isAudioEnabled, isEditFunctionDialogOpen]);

  // Clean up tracking refs when functions change
  useEffect(() => {
    // Clean up tracking refs for functions that no longer exist
    const currentFunctionIds = new Set(functionDefinitions.map(func => func.id));

    // Clean up prevCursorCoordsRef
    Array.from(prevCursorCoordsRef.current.keys()).forEach(functionId => {
      if (!currentFunctionIds.has(functionId)) {
        prevCursorCoordsRef.current.delete(functionId);
      }
    });

    // Clean up prevXSignRef
    Array.from(prevXSignRef.current.keys()).forEach(functionId => {
      if (!currentFunctionIds.has(functionId)) {
        prevXSignRef.current.delete(functionId);
      }
    });

    // Clean up boundaryTriggeredRef (now handles boundary-specific keys)
    Array.from(boundaryTriggeredRef.current.keys()).forEach(key => {
      const functionId = key.split('_')[0]; // Extract functionId from boundary key
      if (!currentFunctionIds.has(functionId)) {
        boundaryTriggeredRef.current.delete(key);
      }
    });

    // Clean up yAxisTriggeredRef
    Array.from(yAxisTriggeredRef.current.keys()).forEach(functionId => {
      if (!currentFunctionIds.has(functionId)) {
        yAxisTriggeredRef.current.delete(functionId);
      }
    });

    // Clean up prevActiveFunctionIdsRef
    Array.from(prevActiveFunctionIdsRef.current).forEach(functionId => {
      if (!currentFunctionIds.has(functionId)) {
        prevActiveFunctionIdsRef.current.delete(functionId);
      }
    });
  }, [functionDefinitions]);

  const calculateFrequency = (y) => {
    if (y === null || y === undefined) return null;

    const normalizedY = (y - graphBounds.yMin)/(graphBounds.yMax-graphBounds.yMin);
    return GLOBAL_FREQUENCY_RANGE.min + normalizedY * (GLOBAL_FREQUENCY_RANGE.max - GLOBAL_FREQUENCY_RANGE.min);
  };

  const calculatePan = (x) => {
    if (x === null || x === undefined) return 0;
    const pan = -1 + 2*(x - graphBounds.xMin)/(graphBounds.xMax-graphBounds.xMin);
    if (pan > 1) return 1;
    if (pan < -1) return -1;
    return pan;
  };

  const calculateVolume = (functionY, mouseY, graphBounds) => {
    if (mouseY === null || mouseY === undefined) {
      return 0; // Default volume when no mouse Y is available
    }

    // Calculate distance between function value and mouse Y
    const distance = Math.abs(functionY - mouseY);
    const maxDistance = graphBounds.yMax - graphBounds.yMin;

    // Normalize distance (0 = on the function, 1 = maximum distance)
    const normalizedDistance = Math.min(distance / maxDistance, 1);

    // Convert to volume: closer = louder, farther = quieter
    // Use a less steep curve for discrete sonification - linear instead of exponential
    const volume = 1 - normalizedDistance;

    // Convert to dB: volume of 1 = 0 dB (full volume), volume of 0 = -30 dB (quieter but not silent)
    const volumeDB = (volume - 1) * 30;

    return volumeDB;
  };

  const handleDiscreteSonification = (functionId, y, pan, instrumentConfig, mouseY) => {
    try {
      if (!instrumentConfig.availablePitchClasses || instrumentConfig.availablePitchClasses.length === 0) {
        return;
      }

      // Map y value to pitch class index
      const normalizedY = (y - graphBounds.yMin) / (graphBounds.yMax - graphBounds.yMin);
      const pitchClassIndex = Math.floor(normalizedY * instrumentConfig.availablePitchClasses.length);
      const clampedIndex = Math.max(0, Math.min(pitchClassIndex, instrumentConfig.availablePitchClasses.length - 1));
      const currentPitchClass = instrumentConfig.availablePitchClasses[clampedIndex];

      // Get the last pitch class for this function
      const lastPitchClass = lastPitchClassesRef.current.get(functionId);

      // Only trigger sound if pitch class has changed
      if (currentPitchClass !== lastPitchClass) {
        // Convert pitch class to frequency
        const frequency = Tone.Frequency(currentPitchClass).toFrequency();

        // Stop any current sound
        stopTone(functionId);

        // Start new sound with the actual function Y value for volume calculation
        startTone(functionId, frequency, pan, mouseY, y);

        // Update the last pitch class
        lastPitchClassesRef.current.set(functionId, currentPitchClass);
      }
    } catch (error) {
      console.warn(`Error in discrete sonification for function ${functionId}:`, error);
      // Stop the tone for this function to prevent further errors
      stopTone(functionId);
    }
  };

  const startTone = (functionId, frequency, pan, mouseY = null, functionY = null) => {
    const instrument = instrumentsRef.current.get(functionId);
    const channel = channelsRef.current.get(functionId);

    if (instrument && channel) {
      try {
        // Get the current time from Tone.js
        const now = Tone.now();

        // Add a tiny offset based on the functionId to prevent simultaneous triggers
        // Using the last character of functionId to create a small offset
        const offset = parseInt(functionId.slice(-1), 10) * 0.01;

        // Ensure the start time is in the future to prevent "Start time must be strictly greater than previous start time" error
        const startTime = Math.max(now + offset, now + 0.001);

        instrument.triggerAttack(frequency, startTime);
        channel.pan.value = pan;

        // Apply volume control based on mouse distance (only when mouseY is available)
        if (mouseY !== null && mouseY !== undefined) {
          // Use provided functionY if available (for discrete sonification), otherwise calculate from frequency
          const actualFunctionY = functionY !== null ? functionY : (frequency - GLOBAL_FREQUENCY_RANGE.min) / (GLOBAL_FREQUENCY_RANGE.max - GLOBAL_FREQUENCY_RANGE.min) * (graphBounds.yMax - graphBounds.yMin) + graphBounds.yMin;
          const volumeDB = calculateVolume(actualFunctionY, parseFloat(mouseY), graphBounds);
          channel.volume.value = volumeDB;
        } else {
          // Reset to default volume when no mouse Y is available
          channel.volume.value = 0;
        }
      } catch (error) {
        console.warn(`Error starting tone for function ${functionId}:`, error);
        // Fallback: try to start immediately without timing
        try {
          instrument.triggerAttack(frequency);
          channel.pan.value = pan;

          // Apply volume control in fallback as well
          if (mouseY !== null && mouseY !== undefined) {
            // Use provided functionY if available (for discrete sonification), otherwise calculate from frequency
            const actualFunctionY = functionY !== null ? functionY : (frequency - GLOBAL_FREQUENCY_RANGE.min) / (GLOBAL_FREQUENCY_RANGE.max - GLOBAL_FREQUENCY_RANGE.min) * (graphBounds.yMax - graphBounds.yMin) + graphBounds.yMin;
            const volumeDB = calculateVolume(actualFunctionY, parseFloat(mouseY), graphBounds);
            channel.volume.value = volumeDB;
          } else {
            channel.volume.value = 0;
          }
        } catch (fallbackError) {
          console.error(`Fallback error starting tone for function ${functionId}:`, fallbackError);
        }
      }
    }
  };

  const stopTone = (functionId) => {
    const instrument = instrumentsRef.current.get(functionId);
    if (instrument) {
      instrument.triggerRelease();
    }
  };

  const stopAllTones = () => {
    instrumentsRef.current.forEach((instrument, functionId) => {
      stopTone(functionId);
    });
  };

  const startPinkNoise = () => {
    if (pinkNoiseRef.current && pinkNoiseRef.current.state === "stopped") {
      pinkNoiseRef.current.start();
    }
  };

  const stopPinkNoise = () => {
    if (pinkNoiseRef.current && pinkNoiseRef.current.state === "started") {
      pinkNoiseRef.current.stop();
    }
  };

  // Add a visual indicator when sonification is paused during editing
  if ((isEditFunctionDialogOpen || isEditLandmarkDialogOpen) && isAudioEnabled) {
    // console.log("Sonification paused: Edit dialog is open");
  }

  // Main effect for processing cursor coordinates and triggering sonification
  useEffect(() => {
    if (!isAudioEnabled || isEditFunctionDialogOpen || isEditLandmarkDialogOpen || !cursorCoords) {
      stopAllTones();
      stopPinkNoise();
      return;
    }

    // Reset pitch classes when batch exploration starts
    if (explorationMode === "batch" && PlayFunction.active && PlayFunction.source === "play") {
      // Reset last pitch classes every time batch exploration starts
      // This ensures that even if the same pitch would be played, it gets played again in a new batch
      if (!batchResetDoneRef.current) {
        // console.log("Batch exploration started - resetting last pitch classes for discrete sonification");
        lastPitchClassesRef.current.clear();
        // Reset y-axis intersection tracking for batch mode
        prevXSignRef.current.clear();
        yAxisTriggeredRef.current.clear();
        batchResetDoneRef.current = true;
        // Reset batch start earcon tracking
        batchStartEarconPlayedRef.current = false;
        wasAtLeftBoundaryRef.current = false;
        // Playback starts parked on one edge; pre-seed it so the border earcon is not
        // fired for a position the user did not navigate to. Leaving that edge is
        // announced by chart_border_start instead.
        borderEdgeRef.current = PlayFunction.speed > 0 ? "left" : "right";
        chartBorderLastPlayedRef.current = Date.now();
      }
    } else {
      // Reset flags when not in batch mode or when batch stops
      batchResetDoneRef.current = false;
      batchStartEarconPlayedRef.current = false;
      wasAtLeftBoundaryRef.current = false;
    }

    // Control master gain based on cursor position vs valid start position for discrete batch sonification
    if (masterGainRef.current) {
      if (discreteBatchValidStartX !== null && cursorCoords && cursorCoords.length > 0 &&
          explorationMode === "batch" && PlayFunction.active && PlayFunction.source === "play") {
        // Get the current cursor X position (use first coordinate as reference)
        const currentX = parseFloat(cursorCoords[0].x);

        if (typeof currentX === 'number' && !isNaN(currentX) && isFinite(currentX)) {
          // Determine direction based on PlayFunction speed
          const direction = PlayFunction.speed >= 0 ? 1 : -1;

          // Calculate gain: 0 if before valid start, 1 if at or after
          let gainValue = 1;
          if (direction > 0) {
            // Moving forward: gain is 0 if currentX < validStartX
            gainValue = currentX >= discreteBatchValidStartX ? 1 : 0;
          } else {
            // Moving backward: gain is 0 if currentX > validStartX
            gainValue = currentX <= discreteBatchValidStartX ? 1 : 0;
          }

          // Set the gain value
          masterGainRef.current.gain.value = gainValue;
        } else {
          // Invalid cursor position, set gain to normal
          masterGainRef.current.gain.value = 1;
        }
      } else {
        // Not in discrete batch mode or no valid start position, set gain to normal (1)
        masterGainRef.current.gain.value = 1;
      }
    }

    // Check if any active function has a y-value below zero
    const hasNegativeY = cursorCoords.some(coord => {
      const y = parseFloat(coord.y);
      return !isNaN(y) && isFinite(y) && y < 0;
    });

    // Horizontal borders depend only on x, which every cursor shares, so they are
    // resolved once per frame rather than once per function.
    const borderEdge = processHorizontalBorder(cursorCoords);
    const isAtBorder = borderEdge !== null;

    // Check if batch sonification is leaving the left boundary (for chart_border_start earcon)
    if (explorationMode === "batch" && PlayFunction.active && PlayFunction.source === "play" &&
        cursorCoords && cursorCoords.length > 0) {
      const isAtLeftBoundaryNow = borderEdge === "left";
      // If we were at the left boundary before and now we're not, play the start earcon
      if (wasAtLeftBoundaryRef.current && !isAtLeftBoundaryNow && !batchStartEarconPlayedRef.current) {
        // Only play if moving forward (positive speed) - leaving left boundary going right
        if (PlayFunction.speed > 0) {
          playAudioSample("chart_border_start", { volume: -15 });
          batchStartEarconPlayedRef.current = true;
          // console.log("Batch sonification leaving left boundary - playing chart_border_start.mp3");
        }
      }
      // Update the tracking ref for next tick
      wasAtLeftBoundaryRef.current = isAtLeftBoundaryNow;
    }

    // Check for landmark intersections
    checkLandmarkIntersections(cursorCoords);

    // Only start pink noise if there's a negative y value AND not at a boundary
    if (hasNegativeY && !isAtBorder) {
      startPinkNoise();
    } else {
      stopPinkNoise();
    }

    // Check if any functions are visible in the current interval
    const hasVisibleFunctions = cursorCoords.some(coord => {
      const y = parseFloat(coord.y);
      return !isNaN(y) && isFinite(y) && y >= graphBounds.yMin && y <= graphBounds.yMax;
    });

    // Check if any functions are out of bounds (invalid y values or outside visible bounds)
    const hasOutOfBoundsFunctions = cursorCoords.some(coord => {
      const y = parseFloat(coord.y);
      return isNaN(y) || y === undefined || y === null || !isFinite(y) ||
             y < graphBounds.yMin || y > graphBounds.yMax;
    });

    // If no functions are visible in the current interval, play no_y.mp3 and stop all tones
    if (!hasVisibleFunctions && cursorCoords.length > 0) {
      // Check if we haven't recently triggered this event to avoid spam
      const lastTriggered = boundaryTriggeredRef.current.get('no_visible_functions');
      const now = Date.now();

      if (!lastTriggered || (now - lastTriggered) > 200) { // 200ms cooldown
        // Stop all tones before playing the earcon
        stopAllTones();

        playAudioSample("no_y", { volume: -25 });
        boundaryTriggeredRef.current.set('no_visible_functions', now);
        // console.log(`No visible functions in current interval, playing no_y.mp3. cursorCoords:`, cursorCoords);
      }
    } else if (hasVisibleFunctions) {
      // Clear the no_visible_functions trigger when functions become visible again
      boundaryTriggeredRef.current.delete('no_visible_functions');

      // If some functions are out of bounds but others are visible, play no_y.mp3
      if (hasOutOfBoundsFunctions) {
        const lastTriggered = boundaryTriggeredRef.current.get('some_out_of_bounds');
        const now = Date.now();

        if (!lastTriggered || (now - lastTriggered) > 200) { // 200ms cooldown
          playAudioSample("no_y", { volume: -25 });
          boundaryTriggeredRef.current.set('some_out_of_bounds', now);
          // console.log(`Some functions out of bounds, playing no_y.mp3 while continuing sonification of visible functions. cursorCoords:`, cursorCoords);
        }
      } else {
        // Clear the some_out_of_bounds trigger when all functions are visible
        boundaryTriggeredRef.current.delete('some_out_of_bounds');
      }
    }

    // Process each cursor coordinate
    cursorCoords.forEach((coord) => {
      const functionId = coord.functionId;
      const x = parseFloat(coord.x);
      const y = parseFloat(coord.y);
      const mouseY = coord.mouseY === null || coord.mouseY === undefined ? null : parseFloat(coord.mouseY);
      const pan = calculatePan(x);

      // Handle tick sound with panning - only when Shift is pressed, regardless of exploration mode
      if (stepSize && stepSize > 0 && typeof x === 'number' && !isNaN(x) && isAudioEnabled && isShiftPressed &&
          (explorationMode === "keyboard_smooth" || explorationMode === "mouse" || explorationMode === "batch")) {
        let n = Math.floor(x / stepSize);
        if (n !== lastTickIndexRef.current) {
          // Update tick synth panning based on x position
          if (tickChannelRef.current) {
            tickChannelRef.current.pan.value = pan;
          }
          tickSynthRef.current?.triggerAttackRelease("C6", "16n");
          lastTickIndexRef.current = n;
        }
      }

      checkYAxisIntersectionEvents(functionId, coord);
      checkDiscontinuityEvents(functionId, coord);

      // The cursor cannot advance past a horizontal border, so hold the tone silent
      // there rather than sustaining a pitch the user can no longer change
      if (isAtBorder) {
        stopTone(functionId);
        return;
      }

      // Get the function's instrument configuration
      const functionIndex = getFunctionIndexById(functionDefinitions, functionId);
      const instrumentConfig = getInstrumentByName(getFunctionInstrumentN(functionDefinitions, functionIndex));

      if (!instrumentConfig) return;

      // Check if the function value is valid before proceeding with sonification
      const isValidY = typeof y === 'number' && !isNaN(y) && isFinite(y);
      const isWithinBounds = isValidY && y >= graphBounds.yMin && y <= graphBounds.yMax;

      if (isWithinBounds) {
        // Handle discrete vs continuous instruments differently
        if (instrumentConfig.instrumentType === InstrumentFrequencyType.discretePitchClassBased) {
          handleDiscreteSonification(functionId, y, pan, instrumentConfig, mouseY);
        } else {
          // Continuous sonification
          const frequency = calculateFrequency(y);
          if (frequency !== null) {
            startTone(functionId, frequency, pan, mouseY, y);
          } else {
            stopTone(functionId);
          }
        }
      } else {
        // Stop the tone for this function when it's not valid or outside bounds
        stopTone(functionId);
      }
    });
  }, [cursorCoords, isAudioEnabled, isEditFunctionDialogOpen, isEditLandmarkDialogOpen, functionDefinitions, graphBounds, stepSize, explorationMode]);

  /**
   * Resolve the left/right chart border once per frame and sound the earcon when it
   * is reached, or repeatedly while the user keeps trying to move past it. All
   * cursors share the same x, so a single shared state is enough.
   *
   * Vertical exits are not treated as borders: a function value leaving the view is
   * reported by the no_y earcon instead.
   *
   * Returns the border currently occupied, or null.
   */
  const processHorizontalBorder = (coords) => {
    const sample = coords.find(coord => Number.isFinite(parseFloat(coord.x)));

    if (!sample) {
      borderEdgeRef.current = null;
      return null;
    }

    const x = parseFloat(sample.x);
    // Whether the navigation actually tried to leave the chart. This is reported by
    // the clamp, so it needs no tolerance and holds at every zoom level. A clamped
    // cursor always lands inside the enter window, so a blocked attempt that does not
    // agree with the position below is stale (the view moved, not the cursor) and is
    // ignored by resolveBorderEvent.
    const blocked = sample.blockedEdge ?? null;
    const previousEdge = borderEdgeRef.current;
    const edge = horizontalEdge(x, graphBounds, previousEdge);
    const now = Date.now();

    const { play } = resolveBorderEvent({
      previousEdge,
      edge,
      blocked,
      now,
      lastPlayedAt: chartBorderLastPlayedRef.current
    });

    borderEdgeRef.current = edge;

    if (play) {
      playAudioSample("chart_border", { volume: -20 });
      chartBorderLastPlayedRef.current = now;
    }

    return edge;
  };

  const checkYAxisIntersectionEvents = (functionId, coords) => {
    const x = parseFloat(coords.x);
    const prevXSign = prevXSignRef.current.get(functionId);
    const currentXSign = Math.sign(x);

    let shouldTriggerEarcon = false;

    // Case 1: Reached x=0 (y-axis) - play earcon regardless of previous position
    if (currentXSign === 0) {
      shouldTriggerEarcon = true;
    }
    // Case 2: Crossed the y-axis (x coordinate sign changed) - but not if we're leaving x=0
    else if (prevXSign !== null && prevXSign !== undefined && prevXSign !== currentXSign && prevXSign !== 0) {
      shouldTriggerEarcon = true;
    }
    // Case 3: Special case for batch mode - if we start very close to y-axis and cross it
    else if (explorationMode === "batch" && prevXSign === null && Math.abs(x) < 0.1) {
      // If this is the first tick in batch mode and we're very close to y-axis,
      // treat it as a potential y-axis intersection
      shouldTriggerEarcon = true;
    }

    if (shouldTriggerEarcon) {
      const lastTriggered = yAxisTriggeredRef.current.get(functionId);
      const now = Date.now();

      if (!lastTriggered || (now - lastTriggered) > 300) { // 300ms cooldown
        playAudioSample("y_axis_intersection", { volume: -12 });
        yAxisTriggeredRef.current.set(functionId, now);
        // console.log(`Y-axis intersection event triggered for function ${functionId} at x=${x} (batch mode: ${explorationMode === "batch"})`);
      }
    }

    // Update the previous x sign
    prevXSignRef.current.set(functionId, currentXSign);
  };

  const checkDiscontinuityEvents = (functionId, coords) => {
    // Handle both numeric and string representations of y
    let y;
    if (typeof coords.y === 'string') {
      // If y is a string, try to parse it, but also check for special string values
      if (coords.y === 'NaN' || coords.y === 'undefined' || coords.y === 'null' || coords.y === 'Infinity' || coords.y === '-Infinity') {
        y = NaN; // Force NaN for these special cases
      } else {
        y = parseFloat(coords.y);
      }
    } else {
      y = parseFloat(coords.y);
    }

    // Check if the function value is NaN, undefined, null, infinite, or outside visible bounds
    const isInvalid = isNaN(y) || y === undefined || y === null || !isFinite(y);
    const isOutsideBounds = typeof y === 'number' && (y < graphBounds.yMin || y > graphBounds.yMax);

    if (isInvalid || isOutsideBounds) {
      // Check if we haven't recently triggered this event to avoid spam
      const lastTriggered = boundaryTriggeredRef.current.get(`${functionId}_discontinuity`);
      const now = Date.now();

      if (!lastTriggered || (now - lastTriggered) > 200) { // 200ms cooldown for discontinuities
        // Stop the tone for this function before playing the earcon
        stopTone(functionId);
        // console.log(`Stopping tone for function ${functionId} due to ${isInvalid ? 'discontinuity' : 'out of bounds'} at x=${coords.x}, y=${coords.y}`);

        playAudioSample("no_y", { volume: -35 });
        boundaryTriggeredRef.current.set(`${functionId}_discontinuity`, now);
        // console.log(`${isInvalid ? 'Discontinuity' : 'Out of bounds'} event triggered for function ${functionId} at x=${coords.x}, y=${coords.y}`);
      }
    } else {
      // Clear the discontinuity trigger when function becomes valid again
      boundaryTriggeredRef.current.delete(`${functionId}_discontinuity`);
    }
  };

  // Check for landmark intersections and play appropriate earcons
  const checkLandmarkIntersections = (cursorCoords) => {
    // Don't check for landmark intersections if edit-landmark dialog is open
    if (isEditLandmarkDialogOpen) {
      return;
    }

    if (!cursorCoords || cursorCoords.length === 0) return;

    // Get active functions
    const activeFunctions = getActiveFunctions(functionDefinitions);

    activeFunctions.forEach(func => {
      const functionId = func.id;
      const functionIndex = functionDefinitions.findIndex(f => f.id === functionId);

      if (functionIndex === -1) return;

      // Get landmarks for this function
      const landmarks = getLandmarksN(functionDefinitions, functionIndex);
      if (!landmarks || landmarks.length === 0) return;

      // Find cursor position for this function
      const cursorCoord = cursorCoords.find(coord => coord.functionId === functionId);
      if (!cursorCoord) return;

      const cursorX = parseFloat(cursorCoord.x);
      const cursorY = parseFloat(cursorCoord.y);

      // Get previous cursor position for this function
      const prevPosition = prevLandmarkPositionsRef.current.get(functionId);

      // Check each landmark for crossing detection
      landmarks.forEach((landmark, landmarkIndex) => {
        const landmarkX = parseFloat(landmark.x);
        const landmarkY = parseFloat(landmark.y);

        // Create landmark key for tracking
        const landmarkKey = `${functionId}_landmark_${landmarkIndex}`;

        let shouldTriggerEarcon = false;

        if (prevPosition) {
          const prevX = prevPosition.x;
          const prevY = prevPosition.y;

          // Check if cursor crossed the landmark position
          // We consider it crossed if the cursor moved from one side of the landmark to the other
          const prevDistance = Math.sqrt(
            Math.pow(prevX - landmarkX, 2) + Math.pow(prevY - landmarkY, 2)
          );
          const currentDistance = Math.sqrt(
            Math.pow(cursorX - landmarkX, 2) + Math.pow(cursorY - landmarkY, 2)
          );

          // Define a small threshold for "reaching" the landmark (much smaller than before)
          const reachThreshold = 0.05; // Very small threshold

          // Trigger if we're very close to the landmark and weren't close before
          if (currentDistance <= reachThreshold && prevDistance > reachThreshold) {
            shouldTriggerEarcon = true;
          }
        } else {
          // First time tracking this function - check if we're already at a landmark
          const distance = Math.sqrt(
            Math.pow(cursorX - landmarkX, 2) + Math.pow(cursorY - landmarkY, 2)
          );

          if (distance <= 0.05) { // Very small threshold for initial detection
            shouldTriggerEarcon = true;
          }
        }

        if (shouldTriggerEarcon) {
          // Don't play earcon if edit-landmark dialog is open
          if (isEditLandmarkDialogOpen) {
            return;
          }

          // Check if we haven't recently triggered this landmark to avoid spam
          const lastTriggered = boundaryTriggeredRef.current.get(landmarkKey);
          const now = Date.now();

          if (!lastTriggered || (now - lastTriggered) > 300) { // 300ms cooldown for landmarks
            // Play landmark earcon
            const shape = landmark.shape || landmark.appearance || "triangle";
            landmarkEarconManager.playLandmarkEarcon(landmark, {
              pan: (cursorX - graphBounds.xMin) / (graphBounds.xMax - graphBounds.xMin) * 2 - 1 // -1 to 1
            });

            boundaryTriggeredRef.current.set(landmarkKey, now);
            // console.log(`Landmark intersection: ${landmark.label || `Landmark ${landmarkIndex + 1}`} (${shape}) at x=${cursorX.toFixed(2)}, y=${cursorY.toFixed(2)}`);
          }
        }
      });

      // Update previous position for this function
      prevLandmarkPositionsRef.current.set(functionId, { x: cursorX, y: cursorY });
    });
  };

  // Helper function to play audio samples
  const playAudioSample = async (sampleName, options = {}) => {
    // Don't play samples if audio is not enabled
    if (!isAudioEnabled) {
      return;
    }

    try {
      await audioSampleManager.playSample(sampleName, options);
    } catch (error) {
      console.warn(`Failed to play audio sample ${sampleName}:`, error);
    }
  };

  // Example function to demonstrate how to play samples during sonification
  // You can call this function when specific events occur
  const triggerSampleEvent = async (eventType) => {
    // Don't trigger samples if audio is not enabled
    if (!isAudioEnabled) {
      return;
    }

    try {
      switch (eventType) {
        case 'chart_border':
          await playAudioSample('chart_border', { volume: -20 });
          break;
        case 'no_y':
          await playAudioSample('no_y', { volume: -10 });
          break;
        case 'y_axis_intersection':
          await playAudioSample('y_axis_intersection', { volume: -12 });
          break;
        default:
          console.warn(`Unknown event type: ${eventType}`);
      }
    } catch (error) {
      console.warn(`Failed to trigger sample event ${eventType}:`, error);
    }
  };

  return null;
};

export default GraphSonification;
