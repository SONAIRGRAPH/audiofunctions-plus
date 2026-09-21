/**
 * Generic mechanism for display preferences.
 *
 * Each preference is its own axis on the <html> element:
 *
 *   <html data-theme="high-contrast" data-line-width="thick" data-text-size="lg">
 *
 * The axes are independent of one another -- the line width applies in every
 * theme, and so does the text size. The matching CSS lives in
 * src/styles/theme.css.
 *
 * Persistence, validation and setting the attribute are handled here once,
 * rather than being repeated per preference.
 */

/** Every defined preference, in definition order. */
const registry = [];

/**
 * Where an 'auto' preference looks up the value its theme suggests.
 *
 * Injected by theme.js at module scope rather than imported: the presets belong
 * with the themes, and importing them here would close the import cycle, since
 * theme.js already depends on this file.
 *
 * The lookup reads the stored theme, not the attribute on <html>, so it does not
 * care whether the theme has been applied yet -- applyStoredPreferences() runs
 * the axes in definition order, and the theme is defined last.
 *
 * @type {(axisKey: string) => string|undefined}
 */
let readPreset = () => undefined;

/** @param {(axisKey: string) => string|undefined} lookup */
export function setPresetSource(lookup) {
  readPreset = typeof lookup === 'function' ? lookup : () => undefined;
}

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage unavailable, not reading "${key}":`, error);
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`localStorage unavailable, not saving "${key}":`, error);
  }
}

/**
 * Defines a preference axis and registers it for applyStoredPreferences().
 *
 * @param {object}   config
 * @param {string}   config.key       localStorage key
 * @param {string}   config.attr      attribute name on <html>, e.g. 'data-theme'
 * @param {string[]} config.values    allowed values
 * @param {string}   config.fallback  value used when nothing is stored or the
 *                                    stored value is invalid
 * @param {(value: string) => string} [config.resolve]
 *        Translates an abstract value into the one actually applied. Needed for
 *        'system', which means 'light' or 'dark' depending on the OS setting,
 *        and for 'auto', which means whatever the active theme suggests.
 *        Without resolve the value is the attribute value.
 * @returns {{key: string, attr: string, values: string[], fallback: string,
 *            get: () => string, getResolved: () => string,
 *            apply: () => void, set: (value: string) => boolean}}
 */
export function definePreference({ key, attr, values, fallback, resolve }) {
  const isValid = (value) => typeof value === 'string' && values.includes(value);

  /** The stored preference -- may be an abstract value such as 'system'. */
  function get() {
    const stored = readStored(key);
    return isValid(stored) ? stored : fallback;
  }

  /** The value that actually ends up on <html>. */
  function getResolved() {
    const value = get();
    return resolve ? resolve(value) : value;
  }

  function apply() {
    document.documentElement.setAttribute(attr, getResolved());
  }

  function set(value) {
    if (!isValid(value)) {
      console.warn(`Unknown value for "${key}":`, value);
      return false;
    }
    writeStored(key, value);
    apply();
    return true;
  }

  const preference = { key, attr, values, fallback, get, getResolved, apply, set };
  registry.push(preference);
  return preference;
}

/**
 * Applies every stored preference. Called on startup so the state is defined
 * even if the inline script in index.html did not run.
 */
export function applyStoredPreferences() {
  registry.forEach((preference) => preference.apply());
}

/* ---------------------------------------------------------------------------
   The theme independent axes.

   Both are wired end to end: values are persisted, the attribute is set and
   theme.css reacts to it. No UI exposes them yet, so they are set from the
   console:

     document.documentElement.dataset.lineWidth = 'x-thick'
     document.documentElement.dataset.textSize  = 'xl'

   'auto' means "whatever the theme suggests" and carries no resolve(): both are
   visible at the first paint, so the cascade resolves them, not this file (see
   section 3 of theme.css). The literal 'auto' matches none of the axis rules,
   which lets the theme's value stand -- and keeps the inline script in
   index.html free of any knowledge about themes. shortcutPosition below is the
   other case: invisible at first paint, therefore resolved here in JS.
   --------------------------------------------------------------------------- */

export const LINE_WIDTHS = ['auto', 'thin', 'normal', 'thick', 'x-thick'];

export const lineWidthPref = definePreference({
  key: 'lineWidth',
  attr: 'data-line-width',
  values: LINE_WIDTHS,
  fallback: 'auto',
});

export const TEXT_SIZES = ['auto', 'sm', 'normal', 'lg', 'xl'];

export const textSizePref = definePreference({
  key: 'textSize',
  attr: 'data-text-size',
  values: TEXT_SIZES,
  fallback: 'auto',
});

/* ---------------------------------------------------------------------------
   Shortcut position in the command palette

   The matching CSS lives in src/styles/command-palette.css.

   The first axis with a theme preset: 'auto' takes its value from the active
   theme (the prefs field in THEMES), anything else is a deliberate choice by the
   user and survives a theme change untouched.

   Like the two axes above it has no UI yet -- the settings menu that will own
   all three is still to come, and until then picking a theme is the only thing
   that moves it. Labels and screen reader announcements are that menu's job and
   get written there, for every axis at once and in one vocabulary.

   Deliberately absent from the inline script in index.html: that script guards
   the first paint, and the palette is closed at that point.
   applyStoredPreferences() sets the attribute long before it can open. That is
   also why this axis may resolve its preset here in JS, while the two above have
   to leave it to the cascade.
   --------------------------------------------------------------------------- */

/** Where a command's key hint is drawn: at the end of the row, or right after
    the command name. */
export const SHORTCUT_POSITIONS = ['auto', 'end', 'inline'];

export const shortcutPositionPref = definePreference({
  key: 'shortcutPosition',
  attr: 'data-shortcut-position',
  values: SHORTCUT_POSITIONS,
  fallback: 'auto',
  resolve: (value) => (value === 'auto' ? readPreset('shortcutPosition') ?? 'end' : value),
});

/* ---------------------------------------------------------------------------
   Highlight style

   How the active entry of a list is marked: a filled row, or a ring around it.
   Only the command palette reads it today (src/styles/command-palette.css), but
   the name is kept generic on purpose -- any other list with an active entry
   can follow the same attribute.

   Same kind of axis as shortcutPosition: invisible at first paint, so it
   resolves its theme preset here in JS and stays out of index.html.
   --------------------------------------------------------------------------- */

export const HIGHLIGHT_STYLES = ['auto', 'fill', 'outline'];

export const highlightStylePref = definePreference({
  key: 'highlightStyle',
  attr: 'data-highlight-style',
  values: HIGHLIGHT_STYLES,
  fallback: 'auto',
  resolve: (value) => (value === 'auto' ? readPreset('highlightStyle') ?? 'fill' : value),
});


/**
 * Numeric factor of the current line width.
 *
 * CSS covers SVG on its own, since the stroke-width tokens already scale.
 * JSXGraph however takes point sizes as plain numbers
 * (board.create(..., {size: 4})), which CSS cannot reach -- that is what this
 * factor is for. Read by useLineWidthScale() in components/graph/GraphView.jsx,
 * which also keeps it current when the theme or the line width changes.
 *
 * @returns {number}
 */
export function getLineWidthScale() {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--af-stroke-scale')
    .trim();
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
