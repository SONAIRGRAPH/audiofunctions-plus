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
 *        'system', which means 'light' or 'dark' depending on the OS setting.
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
   theme.css reacts to it. The command palette does not expose them, so they
   are set from the console:

     document.documentElement.dataset.lineWidth = 'x-thick'
     document.documentElement.dataset.textSize  = 'xl'
   --------------------------------------------------------------------------- */

export const LINE_WIDTHS = ['thin', 'normal', 'thick', 'x-thick'];

export const lineWidthPref = definePreference({
  key: 'lineWidth',
  attr: 'data-line-width',
  values: LINE_WIDTHS,
  fallback: 'normal',
});

export const TEXT_SIZES = ['sm', 'normal', 'lg', 'xl'];

export const textSizePref = definePreference({
  key: 'textSize',
  attr: 'data-text-size',
  values: TEXT_SIZES,
  fallback: 'normal',
});

/**
 * Numeric factor of the current line width.
 *
 * CSS covers SVG on its own, since the stroke-width tokens already scale.
 * JSXGraph however takes point sizes as plain numbers
 * (board.create(..., {size: 4})), which CSS cannot reach -- that is what this
 * factor is for.
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
