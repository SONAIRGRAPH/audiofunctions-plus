/**
 * Every keyboard assignment of the application, in one table.
 *
 * The keys are command ids; `useCommands` holds the matching action and
 * `usePaletteItems` the label, icon and place in the palette, under the same id:
 *
 *   hotkeys.js       'toggle-audio': { combos: [['P']], scope: 'global' }
 *   useCommands      'toggle-audio': () => setIsAudioEnabled((on) => !on)
 *   usePaletteItems  { id: 'toggle-audio', label: 'Enable Sound', … }
 *
 * `KeyboardHandler` binds these combinations, the palette displays `combos[0]`.
 *
 * Vocabulary (see command-palette/shortcuts.js):
 *   key name     'Mod', 'Shift', 'B', 'ArrowLeft', 'Space' — 'Mod' is ⌘ on macOS, Ctrl elsewhere
 *   combination  an array of key names, ['Mod', 'B']
 *   combos       the alternatives of one command; the first one is what the palette shows
 *
 * Fields:
 *   scope          'global' — everywhere except text fields, open dialogs and the open palette
 *                  'chart'  — only while the chart (role="application") has focus
 *   shiftModifies  the combination also matches with Shift held, because Shift changes
 *                  how the command runs (bigger pan step, smooth movement, ticks).
 *                  Not for commands whose Shift variant is a command of its own, such
 *                  as zoom in/out.
 *   hint           extra text shown in the palette next to the shortcut
 */

export const HOTKEYS = {
  // --- global ---------------------------------------------------------------
  'quick-options': { combos: [['Q']], scope: 'global' },
  'toggle-audio': { combos: [['P']], scope: 'global' },
  'play-function': { combos: [['B']], scope: 'global' },
  'next-function': { combos: [['N']], scope: 'global' },
  'prev-function': { combos: [['Shift', 'N']], scope: 'global' },
  'toggle-sonification-type': { combos: [['I']], scope: 'global' },
  'show-coordinates': { combos: [['C']], scope: 'global' },
  'show-view-bounds': { combos: [['V']], scope: 'global' },
  'reset-view': { combos: [['R']], scope: 'global' },
  'functions-menu': { combos: [['F']], scope: 'global' },
  'help': { combos: [['F1']], scope: 'global' },
  'add-landmark-quick': { combos: [['M']], scope: 'global' },
  'add-landmark': { combos: [['Mod', 'M']], scope: 'global' },
  'delete-landmark': { combos: [['Delete']], scope: 'global' },
  'center-at-cursor': { combos: [['Mod', 'Z']], scope: 'global' },

  // --- chart focus ----------------------------------------------------------
  // Plays with source "play_space", which GraphView renders differently from "play".
  'play-function-space': { combos: [['Space']], scope: 'chart', shiftModifies: true },

  'zoom-in': { combos: [['Z']], scope: 'chart', hint: 'may hold' },
  'zoom-out': { combos: [['Shift', 'Z']], scope: 'chart', hint: 'may hold' },

  'pan-left': { combos: [['A']], scope: 'chart', shiftModifies: true },
  'pan-right': { combos: [['D']], scope: 'chart', shiftModifies: true },
  'pan-up': { combos: [['W']], scope: 'chart', shiftModifies: true },
  'pan-down': { combos: [['S']], scope: 'chart', shiftModifies: true },

  'cursor-left': { combos: [['ArrowLeft'], ['J']], scope: 'chart', shiftModifies: true },
  'cursor-right': { combos: [['ArrowRight'], ['L']], scope: 'chart', shiftModifies: true },
  'cursor-start': { combos: [['Home']], scope: 'chart' },
  'cursor-end': { combos: [['End']], scope: 'chart' },

  'prev-landmark': { combos: [['Mod', 'ArrowLeft'], ['Mod', 'J']], scope: 'chart' },
  'next-landmark': { combos: [['Mod', 'ArrowRight'], ['Mod', 'L']], scope: 'chart' },
}

/**
 * Digit keys, whose target depends on the current graph rather than on a fixed id.
 * `digits` is what may be pressed, `combo` builds the combination for one of them.
 * Bound through the palette items, so a digit only fires where that entry exists.
 *
 * Both accept Shift, because on Czech layouts the digit row is shifted: the key is
 * `+ ě š …` unshifted and `1 2 3 …` with Shift, and either should work.
 */
export const NUMBERED_HOTKEYS = {
  // 1–9 select the n-th function; a 10th function is only reachable via the palette.
  'show-function': {
    digits: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    combo: (digit) => [digit],
    scope: 'global',
    shiftModifies: true,
  },
  // Mod+digit jumps to the landmark carrying that shortcut, 0 included.
  'jump-to-landmark': {
    digits: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    combo: (digit) => ['Mod', digit],
    scope: 'global',
    shiftModifies: true,
  },
}

/** The combination the palette shows for a command, or `undefined`. */
export function hotkeyFor(commandId) {
  return HOTKEYS[commandId]?.combos[0]
}

/**
 * The shortcut fields of a palette item for the n-th function (0-based), to spread into
 * it. Empty beyond the ninth function, which has no key.
 */
export function functionHotkey(index) {
  const { digits, combo, shiftModifies } = NUMBERED_HOTKEYS['show-function']
  if (index >= digits.length) return {}
  return { shortcut: combo(digits[index]), shiftModifies }
}

/** The same for a landmark carrying this shortcut digit. */
export function landmarkHotkey(digit) {
  const { digits, combo, shiftModifies } = NUMBERED_HOTKEYS['jump-to-landmark']
  if (!digits.includes(String(digit))) return {}
  return { shortcut: combo(String(digit)), shiftModifies }
}

/**
 * The combinations to test for a command — the declared ones plus, where Shift only
 * modifies the behaviour, the same combinations with Shift held.
 */
export function bindableCombos({ combos, shiftModifies }) {
  if (!shiftModifies) return combos
  return combos.flatMap((combo) => [combo, ['Shift', ...combo]])
}
