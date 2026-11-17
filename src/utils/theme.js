/**
 * Themes.
 *
 * A theme consists of exactly two parts:
 *   1. a block in src/styles/theme.css
 *   2. an entry in THEMES below, including its icon
 *
 * A theme is a color theme -- src/styles/theme.css holds nothing but colors and
 * dimensions. Anything else a theme wants goes into its `prefs` field, which
 * seeds the other display axes without taking them away from the user.
 *
 * The underlying mechanics (localStorage, attribute on <html>, validation)
 * live in prefs.js and are shared with the other display preferences.
 */

import { SunMoon, Sun, Moon, Contrast, Blend, Highlighter, BookOpen, SunDim, Eclipse, MoonStar } from 'lucide-react';
import { definePreference, applyStoredPreferences, setPresetSource } from './prefs';

/**
 * What the high contrast themes suggest for the other display axes.
 *
 * lineWidth and textSize are applied by the cascade (--af-stroke-scale and
 * --af-text-scale in the high contrast block of theme.css); listing them here
 * as well lets the appearance dialog name them as "Theme default (…)". Keep
 * both places in sync.
 */
const HIGH_CONTRAST_PREFS = Object.freeze({
  // Screen magnification is common in these themes, and a key hint at the far
  // end of the row easily ends up outside the magnified viewport, cut off
  // from the command it belongs to.
  shortcutPosition: 'inline',
  // A ring instead of the solid accent fill: the row keeps its background and
  // text color, and only the accent ring marks it.
  highlightStyle: 'outline',
  // Larger type and heavier strokes belong to the purpose of these themes
  lineWidth: 'thick',
  textSize: 'lg',
});

/**
 * What the monochrome themes suggest: the same as the high contrast ones, but
 * without highlightStyle -- the active command keeps the filled row (auto ->
 * 'fill') rather than the ring. lineWidth and textSize are applied by the
 * cascade in the monochrome blocks of theme.css; keep both places in sync.
 */
const MONOCHROME_PREFS = Object.freeze({
  shortcutPosition: 'inline',
  lineWidth: 'thick',
  textSize: 'lg',
});

/**
 * Registry of every selectable theme.
 *
 * A theme with `follows` is not a CSS block: it follows the operating system's
 * light/dark setting and resolves to `follows.light` or `follows.dark` ('system'
 * resolves to 'light' or 'dark', the high contrast and red-green ones to their
 * own light and dark variants). It needs no `prefs` of its own -- the preset is
 * looked up on the resolved theme. The inline script in index.html resolves the
 * same pairs before the first paint and has to match.
 *
 * `prefs` is what a theme suggests for the other display axes. It only takes
 * effect while that axis is set to 'auto'; a value the user picked deliberately
 * is never overwritten by a theme change.
 *
 * `shortLabel` names the theme without the word "Theme", for the appearance
 * dialog's cards. `icon` is a lucide component, shown in the command palette
 * and the appearance dialog.
 *
 * @type {{id: string, label: string, shortLabel: string, icon: import('react').ComponentType,
 *         keywords: string, announcement: string, prefs?: Record<string, string>,
 *         follows?: {light: string, dark: string}}[]}
 */
export const THEMES = [
  // -- Standard --
  {
    id: 'system',
    label: 'Standard Theme, Following System',
    shortLabel: 'Standard',
    icon: SunMoon,
    keywords: 'theme, standard, default, normal, system, automatic, os, follow, light, dark',
    announcement: 'Theme set to standard, following the system light or dark setting',
    follows: { light: 'light', dark: 'dark' },
  },
  {
    id: 'light',
    label: 'Standard Light Theme',
    shortLabel: 'Standard Light',
    icon: Sun,
    keywords: 'theme, standard, default, normal, light, bright, white, day',
    announcement: 'Theme set to standard light',
  },
  {
    id: 'dark',
    label: 'Standard Dark Theme',
    shortLabel: 'Standard Dark',
    icon: Moon,
    keywords: 'theme, standard, default, normal, dark, night, black',
    announcement: 'Theme set to standard dark',
  },

  // -- High contrast --
  {
    id: 'high-contrast-system',
    label: 'High Contrast Theme, Following System',
    shortLabel: 'High Contrast',
    icon: Contrast,
    keywords: 'theme, high contrast, contrast, low vision, vision, impaired, system, automatic, follow, light, dark',
    announcement: 'Theme set to high contrast, following the system light or dark setting',
    follows: { light: 'high-contrast-light', dark: 'high-contrast' },
  },
  {
    id: 'high-contrast-light',
    label: 'High Contrast Light Theme',
    shortLabel: 'High Contrast Light',
    icon: Contrast,
    keywords: 'theme, high contrast, contrast, low vision, vision, impaired, light, white, black on white',
    announcement: 'Theme set to high contrast light',
    prefs: HIGH_CONTRAST_PREFS,
  },
  {
    // Id kept from when this was the only high contrast theme, so stored
    // preferences stay valid
    id: 'high-contrast',
    label: 'High Contrast Dark Theme',
    shortLabel: 'High Contrast Dark',
    icon: Contrast,
    keywords: 'theme, high contrast, contrast, low vision, vision, impaired, dark, black, white on black',
    announcement: 'Theme set to high contrast dark',
    prefs: HIGH_CONTRAST_PREFS,
  },

  // -- Color blind friendly (red-green) --
  {
    id: 'deuteranopia-protanopia-friendly-system',
    label: 'Color Blind Friendly Theme, Following System',
    shortLabel: 'Color Blind Friendly',
    icon: Blend,
    keywords:
      'theme, color blind, colorblind, color vision, red green, deuteranopia, protanopia, accessibility, system, automatic, follow, light, dark',
    announcement: 'Theme set to color blind friendly, following the system light or dark setting',
    follows: {
      light: 'deuteranopia-protanopia-friendly',
      dark: 'deuteranopia-protanopia-friendly-dark',
    },
  },
  {
    id: 'deuteranopia-protanopia-friendly',
    label: 'Color Blind Friendly Light Theme',
    shortLabel: 'Color Blind Friendly Light',
    icon: Blend,
    keywords:
      'theme, color blind, colorblind, color vision, red green, deuteranopia, protanopia, accessibility, light, white',
    announcement: 'Theme set to color blind friendly light',
  },
  {
    id: 'deuteranopia-protanopia-friendly-dark',
    label: 'Color Blind Friendly Dark Theme',
    shortLabel: 'Color Blind Friendly Dark',
    icon: Blend,
    keywords:
      'theme, color blind, colorblind, color vision, red green, deuteranopia, protanopia, accessibility, dark, black',
    announcement: 'Theme set to color blind friendly dark',
  },

  // -- Low glare --
  {
    id: 'low-glare-system',
    label: 'Low Glare Theme, Following System',
    shortLabel: 'Low Glare',
    icon: SunDim,
    keywords: 'theme, low glare, glare, dim, soft, muted, gray, light sensitivity, photophobia, cataract, astigmatism, halation, eye strain, system, automatic, follow, light, dark',
    announcement: 'Theme set to low glare, following the system light or dark setting',
    follows: { light: 'low-glare-light', dark: 'low-glare' },
  },
  {
    id: 'low-glare-light',
    label: 'Low Glare Light Theme',
    shortLabel: 'Low Glare Light',
    icon: SunDim,
    keywords: 'theme, low glare, glare, dim, soft, muted, gray, light sensitivity, photophobia, eye strain, light',
    announcement: 'Theme set to low glare light',
  },
  {
    id: 'low-glare',
    label: 'Low Glare Dark Theme',
    shortLabel: 'Low Glare Dark',
    icon: SunDim,
    keywords: 'theme, low glare, glare, dim, soft, muted, gray, light sensitivity, photophobia, cataract, astigmatism, halation, eye strain, dark',
    announcement: 'Theme set to low glare dark',
  },

  // -- Sepia --
  {
    id: 'sepia-system',
    label: 'Sepia Theme, Following System',
    shortLabel: 'Sepia',
    icon: BookOpen,
    keywords: 'theme, sepia, warm, cream, brown, paper, reading, glare, light sensitivity, visual stress, irlen, dyslexia, eye strain, system, automatic, follow, light, dark',
    announcement: 'Theme set to sepia, following the system light or dark setting',
    follows: { light: 'sepia', dark: 'sepia-dark' },
  },
  {
    id: 'sepia',
    label: 'Sepia Light Theme',
    shortLabel: 'Sepia Light',
    icon: BookOpen,
    keywords: 'theme, sepia, warm, cream, beige, paper, reading, glare, light sensitivity, visual stress, irlen, dyslexia, eye strain, light',
    announcement: 'Theme set to sepia light',
  },
  {
    id: 'sepia-dark',
    label: 'Sepia Dark Theme',
    shortLabel: 'Sepia Dark',
    icon: BookOpen,
    keywords: 'theme, sepia, warm, brown, night, reading, glare, light sensitivity, eye strain, dark',
    announcement: 'Theme set to sepia dark',
  },

  // -- Monochrome --
  {
    id: 'monochrome-system',
    label: 'Monochrome Theme, Following System',
    shortLabel: 'Monochrome',
    icon: Eclipse,
    keywords: 'theme, monochrome, grayscale, greyscale, black and white, no color, achromatopsia, print, projector, system, automatic, follow, light, dark',
    announcement: 'Theme set to monochrome, following the system light or dark setting',
    follows: { light: 'monochrome-light', dark: 'monochrome-dark' },
  },
  {
    id: 'monochrome-light',
    label: 'Monochrome Light Theme',
    shortLabel: 'Monochrome Light',
    icon: Eclipse,
    keywords: 'theme, monochrome, grayscale, greyscale, black and white, no color, print, projector, light, white',
    announcement: 'Theme set to monochrome light',
    prefs: MONOCHROME_PREFS,
  },
  {
    id: 'monochrome-dark',
    label: 'Monochrome Dark Theme',
    shortLabel: 'Monochrome Dark',
    icon: Eclipse,
    keywords: 'theme, monochrome, grayscale, greyscale, black and white, no color, achromatopsia, light sensitivity, dark, black',
    announcement: 'Theme set to monochrome dark',
    prefs: MONOCHROME_PREFS,
  },

  // -- Special: single schemes for specific visual needs --
  {
    // Id keeps the high-contrast prefix: it shares the high contrast block
    // and component rules (theme.css, components.css)
    id: 'high-contrast-yellow',
    label: 'Black on Yellow Theme',
    shortLabel: 'Black on Yellow',
    icon: Highlighter,
    keywords: 'theme, black on yellow, yellow, high contrast, contrast, low vision, glare, vision, impaired',
    announcement: 'Theme set to black on yellow',
    prefs: HIGH_CONTRAST_PREFS,
  },
  {
    // Id keeps the high-contrast prefix, like black on yellow
    id: 'high-contrast-navy',
    label: 'Yellow on Navy Theme',
    shortLabel: 'Yellow on Navy',
    icon: MoonStar,
    keywords: 'theme, yellow on navy, yellow on blue, navy, blue, yellow, high contrast, contrast, low vision, magnifier, vision, impaired',
    announcement: 'Theme set to yellow on navy',
    prefs: HIGH_CONTRAST_PREFS,
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

/** The light/dark choice of a theme family, in display order. */
export const THEME_MODES = Object.freeze(['system', 'light', 'dark']);

/**
 * Themes that come as a system / light / dark set, grouped for the appearance
 * dialog: it shows one card per family plus a system/light/dark switch, and
 * picks the theme id from `variants`. Themes in no family (black on yellow,
 * yellow on navy) are listed separately, see STANDALONE_THEMES.
 *
 * Only a view on THEMES -- the stored preference stays a plain theme id.
 */
export const THEME_FAMILIES = Object.freeze([
  {
    id: 'standard',
    label: 'Standard',
    icon: SunMoon,
    variants: { system: 'system', light: 'light', dark: 'dark' },
  },
  {
    // Red-green (deuteranopia, protanopia), the most common color blindness
    id: 'color-blind',
    label: 'Color Blind Friendly',
    icon: Blend,
    variants: {
      system: 'deuteranopia-protanopia-friendly-system',
      light: 'deuteranopia-protanopia-friendly',
      dark: 'deuteranopia-protanopia-friendly-dark',
    },
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    icon: Contrast,
    variants: { system: 'high-contrast-system', light: 'high-contrast-light', dark: 'high-contrast' },
  },
  {
    id: 'low-glare',
    label: 'Low Glare',
    icon: SunDim,
    variants: { system: 'low-glare-system', light: 'low-glare-light', dark: 'low-glare' },
  },
  {
    id: 'sepia',
    label: 'Sepia',
    icon: BookOpen,
    variants: { system: 'sepia-system', light: 'sepia', dark: 'sepia-dark' },
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    icon: Eclipse,
    variants: { system: 'monochrome-system', light: 'monochrome-light', dark: 'monochrome-dark' },
  },
]);

/**
 * Family and mode of a theme id, e.g. 'high-contrast' -> { family: <High
 * Contrast>, mode: 'dark' }. null for a theme outside every family.
 * @param {string} themeId
 */
export function themeFamilyOf(themeId) {
  for (const family of THEME_FAMILIES) {
    const mode = THEME_MODES.find((m) => family.variants[m] === themeId);
    if (mode) return { family, mode };
  }
  return null;
}

/** Themes without light/dark variants, shown apart from the families. */
export const STANDALONE_THEMES = THEMES.filter((theme) => !themeFamilyOf(theme.id));

const systemDarkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export const themePref = definePreference({
  key: 'theme',
  attr: 'data-theme',
  values: THEME_IDS,
  fallback: 'system',
  resolve: (id) => {
    const follows = THEMES.find((theme) => theme.id === id)?.follows;
    if (!follows) return id;
    return systemDarkQuery().matches ? follows.dark : follows.light;
  },
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
  const info = themeFamilyOf(theme);
  if (info) lastMode = info.mode;
}

/**
 * The last system/light/dark choice, kept while a standalone theme (no
 * variants) is active, so switching back to a family restores it. Not stored:
 * after a reload with a standalone theme it starts at 'system'.
 */
let lastMode = themeFamilyOf(themePref.get())?.mode ?? 'system';

/**
 * The system/light/dark choice to show: the active theme's, or the last one
 * while a standalone theme is active.
 * @returns {'system'|'light'|'dark'}
 */
export function getThemeMode() {
  return themeFamilyOf(getTheme())?.mode ?? lastMode;
}

/**
 * Switches to a theme family, keeping the system/light/dark choice.
 * @param {string} familyId - an id from THEME_FAMILIES
 * @returns {string|undefined} the theme id that was set
 */
export function selectThemeFamily(familyId) {
  const family = THEME_FAMILIES.find((f) => f.id === familyId);
  if (!family) return undefined;
  const themeId = family.variants[getThemeMode()];
  setTheme(themeId);
  return themeId;
}

/**
 * Switches the active family to system, light or dark. Does nothing while a
 * standalone theme is active -- it has no variants.
 * @param {'system'|'light'|'dark'} mode
 * @returns {boolean} whether the theme changed
 */
export function selectThemeMode(mode) {
  const current = themeFamilyOf(getTheme());
  if (!current || !current.family.variants[mode]) return false;
  setTheme(current.family.variants[mode]);
  return true;
}

/**
 * The selected preference -- may be a following theme such as 'system'.
 * @returns {string}
 */
export function getTheme() {
  return themePref.get();
}

/**
 * The theme actually in effect, with following themes ('system' etc.) already resolved. Use this to
 * mark the active entry in the command palette.
 * @returns {string}
 */
export function getResolvedTheme() {
  return themePref.getResolved();
}

/**
 * Applies every display preference and keeps the theme following the OS
 * setting for as long as a following theme ('system' etc.) is selected.
 *
 * Called from main.jsx before the first render. The inline script in
 * index.html has usually set the attributes by then, so this call acts as a
 * safeguard and additionally installs the listener.
 */
export function initializeTheme() {
  applyStoredPreferences();

  systemDarkQuery().addEventListener('change', () => {
    if (THEMES.find((theme) => theme.id === getTheme())?.follows) {
      // Not just themePref: the OS switch changes the resolved theme, and with
      // it the preset every axis on 'auto' follows.
      applyStoredPreferences();
    }
  });
}
