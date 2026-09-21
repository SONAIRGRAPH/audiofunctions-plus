/**
 * Themes.
 *
 * A theme consists of exactly two parts:
 *   1. a block in src/styles/theme.css
 *   2. an entry in THEMES below
 * The command palette additionally needs an icon in THEME_ICONS in
 * components/ui/usePaletteItems.jsx.
 *
 * A theme is a color theme -- src/styles/theme.css holds nothing but colors and
 * dimensions. Anything else a theme wants goes into its `prefs` field, which
 * seeds the other display axes without taking them away from the user.
 *
 * The underlying mechanics (localStorage, attribute on <html>, validation)
 * live in prefs.js and are shared with the other display preferences.
 */

import { definePreference, applyStoredPreferences, setPresetSource } from './prefs';

/**
 * Registry of every selectable theme.
 *
 * 'system' is not a CSS block but follows the operating system setting and
 * resolves to either 'light' or 'dark'. It needs no `prefs` of its own -- the
 * preset is looked up on the resolved theme.
 *
 * `prefs` is what a theme suggests for the other display axes. It only takes
 * effect while that axis is set to 'auto'; a value the user picked deliberately
 * is never overwritten by a theme change.
 *
 * @type {{id: string, label: string, keywords: string, announcement: string,
 *         prefs?: Record<string, string>}[]}
 */
export const THEMES = [
  {
    id: 'system',
    label: 'Use System Theme',
    keywords: 'theme, system, automatic, os, operating, preference, default, follow',
    announcement: 'Theme set to system preference',
  },
  {
    id: 'light',
    label: 'Light Theme',
    keywords: 'theme, light, bright, white, day, normal, standard',
    announcement: 'Theme set to light mode',
  },
  {
    id: 'dark',
    label: 'Dark Theme',
    keywords: 'theme, dark, night, black, low, light, eyes',
    announcement: 'Theme set to dark mode',
  },
  {
    id: 'high-contrast',
    label: 'High Contrast Theme',
    keywords: 'theme, contrast, high, accessibility, vision, impaired, clear, sharp, bold',
    announcement: 'Theme set to high contrast mode',
    prefs: {
      // Screen magnification is common in this theme, and a key hint at the far
      // end of the row easily ends up outside the magnified viewport, cut off
      // from the command it belongs to.
      shortcutPosition: 'inline',
      // A ring instead of the solid accent fill: the row keeps its black
      // background and white text, and only the yellow ring marks it.
      highlightStyle: 'outline',
    },
  },
  {
    id: 'deuteranopia-protanopia-friendly',
    label: 'Deuteranopia/Protanopia Friendly Theme',
    keywords:
      'theme, deuteranopia, protanopia, colorblind, accessibility, vision, friendly, color, blind, impaired, green, red',
    announcement: 'Theme set to deuteranopia/protanopia friendly mode',
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

const systemDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export const themePref = definePreference({
  key: 'theme',
  attr: 'data-theme',
  values: THEME_IDS,
  fallback: 'system',
  resolve: (id) => (id === 'system' ? (systemDarkQuery().matches ? 'dark' : 'light') : id),
});

/**
 * Teaches prefs.js where the 'auto' value of an axis finds its theme preset.
 * Keyed on the resolved theme, so 'system' on a dark desktop gets the dark
 * theme's preset rather than none at all.
 */
setPresetSource((axisKey) => THEMES.find((theme) => theme.id === getResolvedTheme())?.prefs?.[axisKey]);

/**
 * Sets the theme and remembers it.
 * @param {string} theme - an id from THEMES
 */
export function setTheme(theme) {
  themePref.set(theme);
  // Axes on 'auto' resolve against the theme, so what they apply changes even
  // though nothing about them was stored.
  applyStoredPreferences();
}

/**
 * The selected preference -- may be 'system'.
 * @returns {string}
 */
export function getTheme() {
  return themePref.get();
}

/**
 * The theme actually in effect, with 'system' already resolved. Use this to
 * mark the active entry in the command palette.
 * @returns {string}
 */
export function getResolvedTheme() {
  return themePref.getResolved();
}

/**
 * Applies every display preference and keeps the theme following the OS
 * setting for as long as 'system' is selected.
 *
 * Called from main.jsx before the first render. The inline script in
 * index.html has usually set the attributes by then, so this call acts as a
 * safeguard and additionally installs the listener.
 */
export function initializeTheme() {
  applyStoredPreferences();

  systemDarkQuery().addEventListener('change', () => {
    if (getTheme() === 'system') {
      // Not just themePref: the OS switch changes the resolved theme, and with
      // it the preset every axis on 'auto' follows.
      applyStoredPreferences();
    }
  });
}
