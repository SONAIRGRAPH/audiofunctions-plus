import React, { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useMixer } from "../../context/MixerContext";
import { ensureToneStarted } from "../../utils/toneAudio";

/**
 * TEMPORARY debug mixer. Delete this file and the header button before release.
 *
 * This is not a DialogProvider dialog on purpose: any open dialog mutes master
 * output, which would silence the sounds this panel is meant to test.
 */

const SAMPLE_LABELS = {
  chart_border: "Chart border",
  chart_border_start: "Chart border start",
  no_y: "No Y value",
  y_axis_intersection: "Y-axis intersection",
  notification: "Notification",
  deny: "Denied",
  wasd_keypress: "WASD pan",
  zoomin: "Zoom in",
  zoomout: "Zoom out",
  landmark_triangle: "Landmark (triangle)",
  landmark_square: "Landmark (square)",
  landmark_diamond: "Landmark (diamond)",
};

const CLARINET_RANGES = {
  default: "100–1000 Hz",
  down1: "50–500 Hz",
  down2: "25–250 Hz",
};

const displayLabel = (channel) => {
  if (channel.id.startsWith("sample:")) {
    const name = channel.id.slice("sample:".length);
    return SAMPLE_LABELS[name] ?? channel.label;
  }
  return channel.label;
};

const domId = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "-");

function VolumeStrip({ idPrefix, label, detail, volume, muted, onVolume, onMuted }) {
  const percent = Math.round(volume * 100);

  return (
    <div className={muted ? "opacity-60" : undefined}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`${idPrefix}-volume`} className="text-sm font-medium text-txt">
          {label}
        </label>
        <button
          type="button"
          className={`${muted ? "btn-danger" : "btn-secondary"} !px-2 !py-1 !text-xs`}
          aria-pressed={muted}
          onClick={() => onMuted(!muted)}
        >
          {muted ? "Unmute" : "Mute"}
        </button>
      </div>
      {detail ? (
        <p className="text-xs text-descriptions font-mono truncate" title={detail}>
          {detail}
        </p>
      ) : null}
      <div className="mt-1 flex items-center gap-2">
        <input
          id={`${idPrefix}-volume`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => onVolume(Number(event.target.value))}
          aria-label={`${label} volume`}
          aria-valuetext={`${percent} percent`}
          className="w-full accent-primary"
        />
        <span className="w-10 text-right text-xs tabular-nums text-txt">{percent}%</span>
      </div>
    </div>
  );
}

const MixerDebugPanel = ({ onClose }) => {
  const panelRef = useRef(null);
  const {
    mixerState,
    groups,
    channels,
    setGroupVolume,
    setGroupMuted,
    setChannelVolume,
    setChannelMuted,
    MIXER_GROUPS,
    MIXER_GROUP_LABELS,
    AUDIO_MODALITIES,
    audioModality,
    setAudioModality,
    audioIdleTimeoutSec,
    setAudioIdleTimeoutSec,
    AUDIO_IDLE_TIMEOUT_MIN_S,
    AUDIO_IDLE_TIMEOUT_MAX_S,
    AUDIO_IDLE_TIMEOUT_STEP_S,
    AUDIO_IDLE_FADE_DURATION_MS,
    CLARINET_OCTAVES,
    CLARINET_OCTAVE_LABELS,
    clarinetOctave,
    setClarinetOctave,
    isAudioEnabled,
    toggleAudio,
    isOutputOpen,
    isIdleFading,
  } = useMixer();

  const channelsByGroup = useMemo(() => {
    const grouped = Object.fromEntries(
      Object.values(MIXER_GROUPS).map((groupId) => [groupId, []])
    );
    Object.values(channels).forEach((channel) => {
      (grouped[channel.groupId] ??= []).push(channel);
    });
    Object.values(grouped).forEach((list) => {
      list.sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)));
    });
    return grouped;
  }, [MIXER_GROUPS, channels]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (!panelRef.current?.contains(event.target)) return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const fadeSeconds = AUDIO_IDLE_FADE_DURATION_MS / 1000;
  const fadeStartsAt = Math.max(0, audioIdleTimeoutSec - fadeSeconds);

  const handleToggleAudio = async () => {
    if (!isAudioEnabled) {
      await ensureToneStarted();
    }
    toggleAudio();
  };

  const rawState = {
    audioModality,
    audioIdleTimeoutSec,
    clarinetOctave,
    isAudioEnabled,
    isOutputOpen,
    isIdleFading,
    ...mixerState,
  };

  return createPortal(
    <div
      ref={panelRef}
      id="mixer-debug-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="mixer-debug-title"
      aria-describedby="mixer-debug-description"
      className="fixed top-20 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] max-h-[calc(100vh-6rem)] flex-col rounded-lg border border-border bg-background shadow-lg"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Debug</p>
          <h2 id="mixer-debug-title" className="text-lg font-bold text-titles">
            Audio mixer
          </h2>
          <p id="mixer-debug-description" className="text-sm text-descriptions">
            Temporary panel. The chart stays live, so you can hear each control.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="!p-2 border-transparent bg-transparent"
          aria-label="Close debug mixer"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <div
          className="grid grid-cols-3 gap-2"
          aria-live="polite"
        >
          <StatusChip label="Armed" value={isAudioEnabled ? "On" : "Off"} active={isAudioEnabled} />
          <StatusChip label="Output" value={isOutputOpen ? "Open" : "Closed"} active={isOutputOpen} />
          <StatusChip label="Idle fade" value={isIdleFading ? "Fading" : "Off"} active={isIdleFading} />
        </div>

        <button type="button" className="btn-primary w-full" onClick={handleToggleAudio}>
          {isAudioEnabled ? "Disable audio (P)" : "Enable audio (P)"}
        </button>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-titles">Audio modality</legend>
          <div className="flex flex-wrap gap-4">
            <RadioOption
              name="mixer-debug-modality"
              checked={audioModality === AUDIO_MODALITIES.AUTO}
              onChange={() => setAudioModality(AUDIO_MODALITIES.AUTO)}
              label="Auto"
            />
            <RadioOption
              name="mixer-debug-modality"
              checked={audioModality === AUDIO_MODALITIES.MANUAL}
              onChange={() => setAudioModality(AUDIO_MODALITIES.MANUAL)}
              label="Manual"
            />
          </div>
          <p className="text-xs text-descriptions">
            Auto arms on the first cursor move, then fades out after inactivity. Manual stays on until P.
          </p>
        </fieldset>

        <div className="space-y-1">
          <label htmlFor="mixer-debug-idle" className="text-sm font-bold text-titles">
            Auto mute after {audioIdleTimeoutSec}s
          </label>
          <input
            id="mixer-debug-idle"
            type="range"
            min={AUDIO_IDLE_TIMEOUT_MIN_S}
            max={AUDIO_IDLE_TIMEOUT_MAX_S}
            step={AUDIO_IDLE_TIMEOUT_STEP_S}
            value={audioIdleTimeoutSec}
            onChange={(event) => setAudioIdleTimeoutSec(Number(event.target.value))}
            aria-valuetext={`${audioIdleTimeoutSec} seconds`}
            className="w-full accent-primary"
          />
          <p className="text-xs text-descriptions">
            Applies in Auto. Fade starts at {fadeStartsAt}s and mute lands at {audioIdleTimeoutSec}s.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-titles">Clarinet octave</legend>
          <div className="space-y-1">
            {Object.values(CLARINET_OCTAVES).map((octave) => (
              <RadioOption
                key={octave}
                name="mixer-debug-clarinet"
                checked={clarinetOctave === octave}
                onChange={() => setClarinetOctave(octave)}
                label={`${CLARINET_OCTAVE_LABELS[octave]} (${CLARINET_RANGES[octave]})`}
              />
            ))}
          </div>
        </fieldset>

        <section className="space-y-4">
          <h3 className="text-sm font-bold text-titles">Groups and channels</h3>
          <p className="text-xs text-descriptions">
            Channels show up when a sound starts. Enable audio and move on the chart to create them.
          </p>
          {[MIXER_GROUPS.instruments, MIXER_GROUPS.earcons, MIXER_GROUPS.noise].map((groupId) => {
            const group = groups[groupId];
            const groupChannels = channelsByGroup[groupId] ?? [];

            return (
              <div key={groupId} className="space-y-3 rounded-lg border border-border p-3">
                <VolumeStrip
                  idPrefix={`mixer-debug-group-${groupId}`}
                  label={MIXER_GROUP_LABELS[groupId]}
                  detail={groupId}
                  volume={group.volume}
                  muted={group.muted}
                  onVolume={(volume) => setGroupVolume(groupId, volume)}
                  onMuted={(muted) => setGroupMuted(groupId, muted)}
                />
                {groupChannels.length === 0 ? (
                  <p className="text-xs text-descriptions">No channels yet</p>
                ) : (
                  <ul className="space-y-3 border-l border-border pl-3">
                    {groupChannels.map((channel) => (
                      <li key={channel.id}>
                        <VolumeStrip
                          idPrefix={`mixer-debug-channel-${domId(channel.id)}`}
                          label={displayLabel(channel)}
                          detail={channel.id}
                          volume={channel.volume}
                          muted={channel.muted}
                          onVolume={(volume) => setChannelVolume(channel.id, volume)}
                          onMuted={(muted) => setChannelMuted(channel.id, muted)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </section>

        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-txt">Raw mixer state</summary>
          <pre className="mt-2 overflow-x-auto rounded border border-border bg-elem-background p-2 text-txt">
            {JSON.stringify(rawState, null, 2)}
          </pre>
        </details>
      </div>
    </div>,
    document.body
  );
};

function StatusChip({ label, value, active }) {
  return (
    <div className="rounded border border-border px-2 py-1">
      <p className="text-[0.65rem] uppercase tracking-wide text-descriptions">{label}</p>
      <p className={`text-sm font-semibold ${active ? "text-primary" : "text-txt"}`}>{value}</p>
    </div>
  );
}

function RadioOption({ name, checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-sm text-txt">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export default MixerDebugPanel;
