import React from "react";
import { Check, Play, Volume2, VolumeX } from "lucide-react";
import { RELATIVE_RANGE, gainAt, positionOf } from "../../../audio/fader";

/**
 * Building blocks shared by the settings dialogs (appearance, audio mixer),
 * so both look and behave the same. Styles live in styles/components.css.
 */

/**
 * Segmented radio buttons: styled labels around visually hidden native
 * radios. The selected option is marked by border, weight and a check icon,
 * never by color alone.
 *
 * @param {object} props
 * @param {string} props.name     radio group name, also the id prefix
 * @param {string} props.legend
 * @param {string} [props.hint]
 * @param {{value: string, label: string}[]} props.options
 * @param {string} props.value
 * @param {(value: string, label: string) => void} props.onChange
 */
export const SegmentedOptions = ({ name, legend, hint, options, value, onChange }) => {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <fieldset aria-describedby={hintId}>
      <legend className="customize-legend">{legend}</legend>
      {hint && <p className="customize-hint" id={hintId}>{hint}</p>}
      <div className="flex flex-wrap gap-2 mt-2">
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label key={option.value} className="option-segment">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value, option.label)}
                className="sr-only"
              />
              {checked && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

/**
 * One volume strip: label, slider (0–100 %), mute toggle and an optional
 * preview button. `volume` is the mixer's linear gain; the slider shows its
 * position on the fader range (fader.js), so a quiet sound starts low and
 * can be turned up.
 *
 * Mute is shown by aria-pressed, icon and a pressed frame; the dimmed slider
 * is only an extra cue.
 *
 * @param {object} props
 * @param {string} props.id        unique DOM id prefix
 * @param {string} props.label
 * @param {string} [props.hint]
 * @param {number} props.volume    linear gain, 1 = built-in level
 * @param {{baseDb: number, maxDb: number}} [props.range]  fader range
 * @param {boolean} [props.muted]
 * @param {(volume: number) => void} props.onVolume
 * @param {(muted: boolean) => void} [props.onMuted]  no mute button without it
 * @param {() => void} [props.onPreview]
 * @param {boolean} [props.isPreviewing]
 * @param {boolean} [props.prominent]  group strip: larger label
 */
export const VolumeControl = ({
  id,
  label,
  hint,
  volume,
  range = RELATIVE_RANGE,
  muted = false,
  onVolume,
  onMuted,
  onPreview,
  isPreviewing = false,
  prominent = false,
}) => {
  const percent = Math.round(positionOf(volume, range) * 100);
  const sliderId = `${id}-volume`;
  const hintId = hint ? `${id}-hint` : undefined;
  const MuteIcon = muted ? VolumeX : Volume2;

  return (
    <div className="volume-control" data-muted={muted || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex-1 min-w-40">
          <label
            htmlFor={sliderId}
            className={prominent ? "customize-section-title" : "customize-legend"}
          >
            {label}
          </label>
          {hint && <p className="customize-hint" id={hintId}>{hint}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onPreview && (
            <button
              type="button"
              className="mixer-icon-button"
              onClick={onPreview}
              aria-label={`Preview ${label}`}
              title={`Preview ${label}`}
              data-active={isPreviewing || undefined}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          {onMuted && (
            <button
              type="button"
              className="mixer-mute-button"
              onClick={() => onMuted(!muted)}
              aria-pressed={muted}
              aria-label={`Mute ${label}`}
            >
              <MuteIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {/* Same word in both states, so the visible text stays part of the
                  accessible name; the state is aria-pressed, icon and frame */}
              <span>Mute</span>
            </button>
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-3">
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          onChange={(event) => onVolume(gainAt(Number(event.target.value) / 100, range))}
          aria-describedby={hintId}
          aria-valuetext={muted ? `${percent} percent, muted` : `${percent} percent`}
          className="volume-slider"
        />
        <span className="volume-value" aria-hidden="true">{percent}%</span>
      </div>
    </div>
  );
};
