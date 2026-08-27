/**
 * Every user-facing string of the palette. Pass a partial object as the `labels`
 * prop; it is shallow-merged over these defaults.
 *
 * Anything depending on a value or a count is a function, so plural rules stay with
 * the caller and `t()` from i18next or react-intl can be called inside.
 *
 * Pass a stable object (module constant or `useMemo`) — a fresh one per render
 * invalidates the memoisation downstream.
 *
 * Not included: `shortcutAria` produces `"Control+N"` for `aria-keyshortcuts`. Those
 * are specification tokens, not display text.
 */
export const defaultLabels = {
  // Dialog and input
  dialog: 'Command palette',
  placeholder: 'Search commands…',
  /** Name of the root level, shown in the breadcrumb and announcements. */
  root: 'All commands',
  searchAll: 'Search commands',
  searchIn: (level) => `Search in ${level}`,

  // Accessible name of the listbox
  commands: 'Commands',
  commandsIn: (level) => `Commands in ${level}`,
  searchResults: 'Search results',
  searchResultsIn: (level) => `Search results in ${level}`,

  empty: (query) => `No results for “${query}”`,

  /** Visible below the list and, on open, spoken last by screen reader. Keep it short enough to hear. */
  footerRoot:
    'Textsearch is everywhere available to search/filter all commands (including submenus). Use arrow keys to navigate the list, Enter runs commands or opens a submenu. Escape closes.',
  footerSubmenu:
    'Textsearch is everywhere available to search/filter this submenu. Use arrow keys to navigate the list, Enter runs commands. Use backspace to go back, Escape closes.',

  // Parts of an entry's accessible name. The separating ", " is added by the caller.
  inTrail: (trail) => `in ${trail.join(', ')}`,
  shortcut: (speech) => `keyboard shortcut ${speech}`,
  submenu: (count) => `submenu, ${count} ${count === 1 ? 'item' : 'items'}`,

  // Announcements
  itemCount: (count) => `${count} ${count === 1 ? 'item' : 'items'}`,
  resultCount: (count) => `${count} ${count === 1 ? 'result' : 'results'}`,
  levelEntered: (level, count) => `${level}, ${count}`,
  listUpdated: (count) => `List updated, ${count}`,
  submenuGone: (level, count) => `Submenu no longer available. ${level}, ${count}`,

  /**
   * Spoken names of shortcut tokens, merged over the table in shortcuts.js.
   * Example: `{ Mod: 'Strg', Shift: 'Umschalt' }`. Flat, so it cannot distinguish
   * platforms — branch when building the object if you need macOS wording too.
   */
  keys: {},
  /** Visible glyphs, same merge. Example: `{ Escape: 'Esc', Delete: 'Entf' }`. */
  keyGlyphs: {},
  /** Joins the tokens when spoken. */
  keyJoiner: ' plus ',
}
