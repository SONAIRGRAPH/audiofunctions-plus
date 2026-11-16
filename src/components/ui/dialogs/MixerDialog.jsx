import React, { useEffect, useMemo, useRef, useState } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { ChevronRight } from "lucide-react";
import { useMixer } from "../../../context/MixerContext";
import { useGraphContext } from "../../../context/GraphContext";
import { MIXER_CATALOG, catalogEntry, channelLabel, channelRange } from "../../../audio/mixerCatalog";
import { SegmentedOptions, VolumeControl } from "./SettingControls";

/**
 * Audio mixer: volume and mute per sound group and per single sound, plus
 * the audio options (Auto/Manual, auto mute delay, clarinet octave).
 *
 * Same pattern as the appearance dialog: changes apply at once, Cancel puts
 * the snapshot from opening back, Save keeps them. MixerContext saves the
 * settings to localStorage; function channels last for the session only.
 *
 * Every open dialog mutes the output. The ▶ buttons get around that for one
 * short sample (MixerContext.previewChannel), with all other groups silent.
 */

const GROUP_HINTS = {
  instruments: "Tones of the plotted functions. Preview plays the active function with its instrument.",
  earcons: "Short sounds for borders, landmarks, zoom and grid ticks.",
  noise: "Background noise while y is negative.",
};

const CLARINET_RANGES = {
  default: "100–1000 Hz",
  down1: "50–500 Hz",
  down2: "25–250 Hz",
};

const CATALOG_ORDER = new Map(MIXER_CATALOG.map((entry, index) => [entry.id, index]));

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : "");

/**
 * Hint under a function's slider: expression and instrument, so functions
 * with similar names can be told apart.
 */
const describeFunction = (func) => {
  const expression =
    func.type === "piecewise_function"
      ? "Piecewise function"
      : String(func.functionDef ?? "").trim() || "No expression yet";
  return func.instrument ? `${expression} · ${capitalize(func.instrument)}` : expression;
};

const domId = (value) => `mixer-${String(value).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const MixerDialog = ({ isOpen, onClose }) => {
  const {
    master,
    groups,
    channels,
    setMasterVolume,
    setGroupVolume,
    setGroupMuted,
    setChannelVolume,
    setChannelMuted,
    MIXER_GROUPS,
    MIXER_GROUP_LABELS,
    MIXER_CHANNELS,
    AUDIO_MODALITIES,
    audioModality,
    setAudioModality,
    audioIdleTimeoutSec,
    setAudioIdleTimeoutSec,
    AUDIO_IDLE_TIMEOUT_MIN_S,
    AUDIO_IDLE_TIMEOUT_MAX_S,
    AUDIO_IDLE_TIMEOUT_STEP_S,
    CLARINET_OCTAVES,
    CLARINET_OCTAVE_LABELS,
    clarinetOctave,
    setClarinetOctave,
    getSettingsSnapshot,
    restoreSettingsSnapshot,
    resetToDefaults,
    previewChannel,
    preparePreviews,
    previewingChannelId,
  } = useMixer();

  const { functionDefinitions } = useGraphContext();
  // The function the user is exploring; the instruments group previews it
  const activeFunctionId = functionDefinitions?.find((func) => func.isActive)?.id ?? null;

  const snapshotRef = useRef(null);
  const statusTimerRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState("");

  const announceStatus = (message) => {
    setStatusMessage(message);
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(""), 3000);
  };

  useEffect(() => {
    if (!isOpen) return;
    snapshotRef.current = getSettingsSnapshot();
    preparePreviews();
  }, [isOpen, getSettingsSnapshot, preparePreviews]);

  useEffect(() => () => clearTimeout(statusTimerRef.current), []);

  // Function channels by mixer id: position, name and hint as the rest of the
  // app shows them (stored name, else "Function <position>")
  const functionInfo = useMemo(
    () =>
      new Map(
        (functionDefinitions ?? []).map((func, index) => [
          MIXER_CHANNELS.instrument(func.id),
          {
            order: index,
            label: func.functionName || `Function ${index + 1}`,
            hint: describeFunction(func),
          },
        ])
      ),
    [functionDefinitions, MIXER_CHANNELS]
  );

  // Catalog sounds in catalog order, functions in the order of the function list
  const channelsByGroup = useMemo(() => {
    const orderOf = (channel) =>
      CATALOG_ORDER.get(channel.id) ?? functionInfo.get(channel.id)?.order ?? Number.MAX_SAFE_INTEGER;
    const grouped = Object.fromEntries(Object.values(MIXER_GROUPS).map((id) => [id, []]));
    Object.values(channels).forEach((channel) => {
      (grouped[channel.groupId] ??= []).push(channel);
    });
    Object.values(grouped).forEach((list) => list.sort((a, b) => orderOf(a) - orderOf(b)));
    return grouped;
  }, [MIXER_GROUPS, channels, functionInfo]);

  const handleSave = () => {
    snapshotRef.current = null;
    onClose();
  };

  const handleCancel = () => {
    if (snapshotRef.current) {
      restoreSettingsSnapshot(snapshotRef.current);
      snapshotRef.current = null;
    }
    onClose();
  };

  const handleReset = () => {
    resetToDefaults();
    announceStatus("All volumes reset to their default level, options to default. Cancel undoes this.");
  };

  const muteHandler = (label, apply) => (muted) => {
    apply(muted);
    announceStatus(`${label} ${muted ? "muted" : "unmuted"}`);
  };

  const modalityOptions = [
    { value: AUDIO_MODALITIES.AUTO, label: "Auto" },
    { value: AUDIO_MODALITIES.MANUAL, label: "Manual" },
  ];

  const octaveOptions = Object.values(CLARINET_OCTAVES).map((octave) => ({
    value: octave,
    label: `${CLARINET_OCTAVE_LABELS[octave]} (${CLARINET_RANGES[octave]})`,
  }));

  return (
    <Dialog
      open={isOpen}
      onClose={handleCancel}
      className="relative"
      aria-modal="true"
      role="dialog"
      aria-labelledby="mixer-title"
      aria-describedby="mixer-description"
    >
      <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel className="w-full max-w-lg max-h-[90vh] bg-background rounded-lg shadow-lg flex flex-col">
          <div className="p-6 pb-4">
            {/* Initial focus on the title, not on a slider: arrow keys would
                change a volume right away (WAI-ARIA dialog pattern). */}
            <DialogTitle
              id="mixer-title"
              className="text-lg font-bold text-titles outline-none"
              tabIndex={-1}
              data-autofocus
            >
              Audio Mixer
            </DialogTitle>
            <Description id="mixer-description" className="text-descriptions">
              Set the volume of each kind of sound. Changes apply immediately; use the preview buttons to hear a sound. Cancel restores the previous settings.
            </Description>
          </div>

          <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
            {statusMessage}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-6">
            <section aria-labelledby="mixer-volume-title" className="space-y-3">
              <h3 id="mixer-volume-title" className="customize-section-title">Volume</h3>
              {/* No mute button here: switching all sound on and off is P */}
              <div className="mixer-group mixer-group-master">
                <VolumeControl
                  id="mixer-master"
                  label="Overall volume"
                  hint="Volume of all sounds together. P switches the sound on and off."
                  volume={master.volume}
                  onVolume={setMasterVolume}
                  prominent
                />
              </div>
              {[MIXER_GROUPS.instruments, MIXER_GROUPS.earcons, MIXER_GROUPS.noise].map((groupId) => {
                const group = groups[groupId];
                const groupLabel = MIXER_GROUP_LABELS[groupId];
                const groupChannels = channelsByGroup[groupId] ?? [];
                const isInstruments = groupId === MIXER_GROUPS.instruments;
                // Group preview: the active function, or the only noise.
                // Earcons are too different from one another for one sample.
                const groupPreviewCandidate = isInstruments
                  ? activeFunctionId && MIXER_CHANNELS.instrument(activeFunctionId)
                  : groupId === MIXER_GROUPS.noise
                    ? groupChannels[0]?.id
                    : null;
                const groupPreviewId = channels[groupPreviewCandidate]?.previewable
                  ? groupPreviewCandidate
                  : null;

                return (
                  <div key={groupId} className="mixer-group">
                    <VolumeControl
                      id={domId(`group-${groupId}`)}
                      label={groupLabel}
                      hint={GROUP_HINTS[groupId]}
                      volume={group.volume}
                      muted={group.muted}
                      onVolume={(volume) => setGroupVolume(groupId, volume)}
                      onMuted={muteHandler(groupLabel, (muted) => setGroupMuted(groupId, muted))}
                      onPreview={groupPreviewId ? () => previewChannel(groupPreviewId) : undefined}
                      isPreviewing={groupPreviewId !== null && previewingChannelId === groupPreviewId}
                      prominent
                    />

                    <details className="mixer-disclosure">
                      <summary>
                        <ChevronRight className="mixer-disclosure-icon w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          {isInstruments ? "Single functions" : "Single sounds"} ({groupChannels.length})
                        </span>
                      </summary>
                      <div className="mixer-disclosure-body">
                        {isInstruments && (
                          <p className="customize-hint">
                            Levels per function apply to this session only.
                          </p>
                        )}
                        {groupChannels.length === 0 ? (
                          <p className="customize-hint">
                            {isInstruments ? "No functions yet." : "No sounds yet."}
                          </p>
                        ) : (
                          <ul className="space-y-4">
                            {groupChannels.map((channel) => {
                              const fn = functionInfo.get(channel.id);
                              const label = fn?.label ?? channelLabel(channel);
                              const hint = fn?.hint ?? catalogEntry(channel.id)?.description;
                              return (
                                <li key={channel.id}>
                                  <VolumeControl
                                    id={domId(channel.id)}
                                    label={label}
                                    hint={hint}
                                    volume={channel.volume}
                                    range={channelRange(channel.id)}
                                    muted={channel.muted}
                                    onVolume={(volume) => setChannelVolume(channel.id, volume)}
                                    onMuted={muteHandler(label, (muted) => setChannelMuted(channel.id, muted))}
                                    onPreview={channel.previewable ? () => previewChannel(channel.id) : undefined}
                                    isPreviewing={previewingChannelId === channel.id}
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </details>
                  </div>
                );
              })}
            </section>

            <section aria-labelledby="mixer-playback-title" className="space-y-4">
              <h3 id="mixer-playback-title" className="customize-section-title">Playback</h3>

              <SegmentedOptions
                name="mixer-modality"
                legend="Audio mode"
                hint="Auto starts the sound with the first cursor move and mutes after a pause. Manual plays until you press P."
                options={modalityOptions}
                value={audioModality}
                onChange={(value, label) => {
                  setAudioModality(value);
                  announceStatus(`Audio mode: ${label}`);
                }}
              />

              {audioModality === AUDIO_MODALITIES.AUTO && (
                <div>
                  <label htmlFor="mixer-idle-timeout" className="customize-legend">
                    Auto mute after
                  </label>
                  <p className="customize-hint" id="mixer-idle-timeout-hint">
                    Seconds without activity before the sound fades out.
                  </p>
                  <div className="mt-1 flex items-center gap-3">
                    <input
                      id="mixer-idle-timeout"
                      type="range"
                      min={AUDIO_IDLE_TIMEOUT_MIN_S}
                      max={AUDIO_IDLE_TIMEOUT_MAX_S}
                      step={AUDIO_IDLE_TIMEOUT_STEP_S}
                      value={audioIdleTimeoutSec}
                      onChange={(event) => setAudioIdleTimeoutSec(Number(event.target.value))}
                      aria-describedby="mixer-idle-timeout-hint"
                      aria-valuetext={`${audioIdleTimeoutSec} seconds`}
                      className="volume-slider"
                    />
                    <span className="volume-value" aria-hidden="true">{audioIdleTimeoutSec} s</span>
                  </div>
                </div>
              )}

              <SegmentedOptions
                name="mixer-clarinet-octave"
                legend="Clarinet pitch"
                hint="Lowers the pitch range of continuous function tones. Can help if high tones are hard to hear."
                options={octaveOptions}
                value={clarinetOctave}
                onChange={(value, label) => {
                  setClarinetOctave(value);
                  announceStatus(`Clarinet pitch: ${label}`);
                }}
              />
            </section>
          </div>

          <div className="px-6 py-4" role="group" aria-label="Dialog actions">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <button type="button" onClick={handleReset} className="btn-secondary sm:w-auto">
                Reset to defaults
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleCancel} className="btn-secondary sm:w-auto">
                  Cancel
                </button>
                <button type="button" onClick={handleSave} className="btn-primary sm:w-auto">
                  Save
                </button>
              </div>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

export default MixerDialog;
