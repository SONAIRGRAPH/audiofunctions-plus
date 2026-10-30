import React, { useEffect, useRef, useState } from "react";
import { Description, Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Check } from "lucide-react";
import { THEMES, setTheme, getTheme } from "../../../utils/theme";
import {
  lineWidthPref,
  textSizePref,
  fontPref,
  spacingPref,
  shortcutPositionPref,
  highlightStylePref,
  toastPositionPref,
  getPreferenceSnapshot,
  restorePreferenceSnapshot,
  getPreset,
} from "../../../utils/prefs";

/**
 * Every adjustable axis below the color palette, grouped into sections.
 * `options` maps each value to its label. `autoDefault` is what 'auto' means
 * when the theme suggests nothing, so the label can name it. `control` picks
 * the widget: a dropdown for long lists, segmented radios (default) for up to
 * four short options.
 *
 * A future per-element line width belongs into the "Lines & text" section.
 */
// Font of the sample line below the font dropdown. Mirrors --af-font in
// styles/theme.css.
const FONT_PREVIEW = {
  auto: "system-ui, sans-serif",
  system: "system-ui, sans-serif",
  inter: '"Inter", system-ui, sans-serif',
  atkinson: '"Atkinson Hyperlegible Next", system-ui, sans-serif',
  lexend: '"Lexend", system-ui, sans-serif',
  andika: '"Andika", system-ui, sans-serif',
  "comic-neue": '"Comic Neue", system-ui, sans-serif',
  opendyslexic: '"OpenDyslexic", system-ui, sans-serif',
};

const SECTIONS = [
  {
    title: "Reading",
    axes: [
      {
        pref: fontPref,
        label: "Font",
        description:
          "Atkinson Hyperlegible keeps similar characters such as 1, l and I apart. Lexend, Andika, Comic Neue and OpenDyslexic are often preferred by readers with dyslexia. Wider spacing below helps many readers.",
        options: {
          system: "System",
          inter: "Inter",
          atkinson: "Atkinson Hyperlegible",
          lexend: "Lexend",
          andika: "Andika",
          "comic-neue": "Comic Neue",
          opendyslexic: "OpenDyslexic",
        },
        autoDefault: "system",
        control: "select",
        previewFont: (value) => FONT_PREVIEW[value],
      },
      {
        pref: spacingPref,
        label: "Spacing",
        description: "Wider line, letter and word spacing.",
        options: { normal: "Normal", wide: "Wide" },
        autoDefault: "normal",
      },
    ],
  },
  {
    title: "Lines & text",
    axes: [
      {
        pref: lineWidthPref,
        label: "Line width",
        description: "Thickness of curves, axes, grid, focus rings and borders.",
        options: { thin: "Thin", normal: "Normal", thick: "Thick", "x-thick": "Extra thick" },
        autoDefault: "normal",
        control: "select",
      },
      {
        pref: textSizePref,
        label: "Text size",
        description: "Scales text and spacing together, like browser zoom.",
        options: { sm: "Small", normal: "Normal", lg: "Large", xl: "Extra large" },
        autoDefault: "normal",
        control: "select",
      },
    ],
  },
  {
    title: "Command palette",
    axes: [
      {
        pref: shortcutPositionPref,
        label: "Shortcut hints",
        description: "Where a command's keyboard shortcut is shown.",
        options: { end: "End of row", inline: "After the command" },
        autoDefault: "end",
      },
      {
        pref: highlightStylePref,
        label: "Active entry",
        description: "How the selected command is marked.",
        options: { fill: "Filled", outline: "Outline" },
        autoDefault: "fill",
      },
    ],
  },
  {
    title: "Info toasts",
    axes: [
      {
        pref: toastPositionPref,
        label: "Position",
        description: "Where short info messages appear.",
        options: { cursor: "Above the cursor", corner: "Top right corner" },
      },
    ],
  },
];

const themeById = (id) => THEMES.find((theme) => theme.id === id);

/** "Theme default (Inline)" -- names what 'auto' currently resolves to. */
function autoLabel(axis) {
  const value = getPreset(axis.pref.key) ?? axis.autoDefault;
  return value && axis.options[value] ? `Theme default (${axis.options[value]})` : "Theme default";
}

/** Value -> label for one axis, 'auto' first where the axis offers it. */
function optionsOf(axis) {
  return axis.pref.values.map((value) => ({
    value,
    label: value === "auto" ? autoLabel(axis) : axis.options[value] ?? value,
  }));
}

const CustomizationDialog = ({ isOpen, onClose }) => {
  const snapshotRef = useRef(null);
  const [statusMessage, setStatusMessage] = useState("");
  // Preferences live outside React; bumped after every change to re-read them
  const [, setRevision] = useState(0);
  const refresh = () => setRevision((revision) => revision + 1);

  const announceStatus = (message) => {
    setStatusMessage(message);
    setTimeout(() => setStatusMessage(""), 3000);
  };

  useEffect(() => {
    if (!isOpen) return;
    snapshotRef.current = getPreferenceSnapshot();
    refresh();
    // The screen reader announces the dialog itself through the focus
    announceStatus(`Current color palette: ${themeById(getTheme())?.shortLabel}.`);
  }, [isOpen]);

  const handlePalette = (themeId) => {
    setTheme(themeId);
    refresh();
    announceStatus(`Color palette: ${themeById(themeId)?.shortLabel}`);
  };

  const handleAxis = (axis, value, label) => {
    axis.pref.set(value);
    refresh();
    announceStatus(`${axis.label}: ${label}`);
  };

  const handleSave = () => {
    snapshotRef.current = null;
    onClose();
  };

  const handleCancel = () => {
    if (snapshotRef.current) {
      restorePreferenceSnapshot(snapshotRef.current);
      snapshotRef.current = null;
    }
    onClose();
  };

  const palette = getTheme();

  return (
    <Dialog
      open={isOpen}
      onClose={handleCancel}
      className="relative"
      aria-modal="true"
      role="dialog"
      aria-labelledby="customization-title"
      aria-describedby="customization-description"
    >
      <div className="fixed inset-0 bg-overlay" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6">
        <DialogPanel className="w-full max-w-lg max-h-[90vh] bg-background rounded-lg shadow-lg flex flex-col">
          <div className="p-6 pb-4">
            {/* Initial focus sits on the title, not on a control: arrow keys on a
                radio would switch the palette right away (WAI-ARIA dialog pattern). */}
            <DialogTitle
              id="customization-title"
              className="text-lg font-bold text-titles outline-none"
              tabIndex={-1}
              data-autofocus
            >
              Customize Appearance
            </DialogTitle>
            <Description id="customization-description" className="text-descriptions">
              Choose a color palette and adjust the display settings. Changes are shown immediately. Cancel restores the previous appearance.
            </Description>
          </div>

          {/* Live region for status announcements */}
          <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
            {statusMessage}
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-6">
            <section aria-labelledby="customize-colors-title" className="space-y-2">
              <h3 id="customize-colors-title" className="customize-section-title">Colors</h3>
              <fieldset aria-describedby="palette-hint">
                <legend className="customize-legend">Color palette</legend>
                <p className="customize-hint" id="palette-hint">
                  Colors of the interface and the graph. Settings on "Theme default" follow the palette.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {THEMES.map((theme) => (
                    <ThemeCard
                      key={theme.id}
                      name="appearance-palette"
                      theme={theme}
                      checked={palette === theme.id}
                      onChange={() => handlePalette(theme.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </section>

            {SECTIONS.map((section) => {
              const sectionId = `customize-${section.title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
              return (
                <section key={section.title} aria-labelledby={sectionId} className="space-y-4">
                  <h3 id={sectionId} className="customize-section-title">{section.title}</h3>
                  {section.axes.map((axis) => {
                    const Control = axis.control === "select" ? SelectSetting : OptionGroup;
                    return (
                      <Control
                        key={axis.pref.key}
                        axis={axis}
                        value={axis.pref.get()}
                        onChange={(value, label) => handleAxis(axis, value, label)}
                      />
                    );
                  })}
                </section>
              );
            })}
          </div>

          <div className="px-6 py-4" role="group" aria-label="Dialog actions">
            <div className="flex justify-end items-center gap-2">
              <button type="button" onClick={handleCancel} className="btn-secondary sm:w-auto">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="btn-primary sm:w-auto">
                Save
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
};

/**
 * A theme as a radio card with a small preview. The preview element carries
 * its own data-theme, so theme.css colors it with that theme's tokens.
 */
const ThemeCard = ({ name, theme, checked, onChange }) => {
  const Icon = theme.icon;
  return (
    <label className="option-card">
      <input
        type="radio"
        name={name}
        value={theme.id}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {theme.id === "system" ? (
        <span className="flex gap-1" aria-hidden="true">
          <ThemePreview themeId="light" />
          <ThemePreview themeId="dark" />
        </span>
      ) : (
        <ThemePreview themeId={theme.id} />
      )}
      <span className="flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{theme.shortLabel}</span>
        {checked && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
      </span>
    </label>
  );
};

const ThemePreview = ({ themeId }) => (
  <span className="theme-preview" data-theme={themeId} aria-hidden="true">
    <svg viewBox="0 0 80 32" preserveAspectRatio="xMidYMid slice">
      <path className="theme-preview-grid" d="M0 16 H80 M20 0 V32 M40 0 V32 M60 0 V32" />
      <path className="theme-preview-curve" d="M0 24 C 16 24, 24 6, 40 8 S 64 26, 80 10" />
      <circle className="theme-preview-cursor" cx="40" cy="8" r="3.5" />
    </svg>
  </span>
);

/** One axis as a group of segmented radio buttons. */
const OptionGroup = ({ axis, value, onChange }) => {
  const groupName = `appearance-${axis.pref.key}`;
  const hintId = `${groupName}-hint`;
  return (
    <fieldset aria-describedby={hintId}>
      <legend className="customize-legend">{axis.label}</legend>
      <p className="customize-hint" id={hintId}>{axis.description}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        {optionsOf(axis).map((option) => {
          const checked = value === option.value;
          return (
            <label key={option.value} className="option-segment">
              <input
                type="radio"
                name={groupName}
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
 * One axis as a native dropdown -- the most robust control for screen readers
 * and keyboards. Same markup as the dropdowns in the other dialogs.
 */
const SelectSetting = ({ axis, value, onChange }) => {
  const selectId = `appearance-${axis.pref.key}`;
  const hintId = `${selectId}-hint`;
  const options = optionsOf(axis);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex-1 min-w-48">
          <label htmlFor={selectId} className="customize-legend">{axis.label}</label>
          <p className="customize-hint" id={hintId}>{axis.description}</p>
        </div>
        <div className="text-input-outer pr-1.5 min-w-52">
          <select
            id={selectId}
            value={value}
            onChange={(e) => {
              const option = options.find((o) => o.value === e.target.value);
              onChange(option.value, option.label);
            }}
            className="grow text-input-inner"
            aria-describedby={hintId}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} className="bg-background text-txt">
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {axis.previewFont && (
        // Decorative: the dropdown already names the font
        <p className="font-sample" style={{ fontFamily: axis.previewFont(value) }} aria-hidden="true">
          f(x) = 2x² + 1 · 0O 1lI
        </p>
      )}
    </div>
  );
};

export default CustomizationDialog;
