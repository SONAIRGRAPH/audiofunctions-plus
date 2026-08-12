/**
 * Themes.
 *
 * A theme consists of exactly two parts:
 *   1. a block in src/styles/theme.css
 *   2. an entry in THEMES below
 * The command palette additionally needs an icon in THEME_ICONS in
 * components/ui/usePaletteItems.jsx.
 *
 * The underlying mechanics (localStorage, attribute on <html>, validation)
 * live in prefs.js and are shared with the other display preferences.
 */

import { definePreference, applyStoredPreferences } from './prefs';

/**
 * Registry of every selectable theme.
 *
 * 'system' is not a CSS block but follows the operating system setting and
 * resolves to either 'light' or 'dark'.
 *
 * @type {{id: string, label: string, keywords: string, announcement: string}[]}
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
 * Sets the theme and remembers it.
 * @param {string} theme - an id from THEMES
 */
export function setTheme(theme) {
  themePref.set(theme);
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
      themePref.apply();
    }
  });
}
