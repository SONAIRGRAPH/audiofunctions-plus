/**
 * Matches a KeyboardEvent against a shortcut combination.
 *
 * Combinations are written the way `command-palette/shortcuts.js` renders them -- an
 * array of key names, `['Mod', 'B']` -- so `hotkeys.js` declares a key once and the
 * palette hint and the binding stay the same thing.
 *
 * Lives outside `command-palette/` on purpose: that folder is a copy of the
 * react-accessible-command-palette package and is replaced wholesale on updates.
 */

function detectMac() {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const IS_MAC = detectMac()

/** Key names that stand for a modifier rather than a key to press. */
const MODIFIERS = new Set(['Mod', 'Meta', 'Ctrl', 'Alt', 'Shift'])

/**
 * Matches the non-modifier key.
 *
 * Digits go through `event.code`, so they are independent of the keyboard layout --
 * on a Czech layout the `1` key produces `+`, but still reports `Digit1`. Letters go
 * through `event.key`, because there the label is what the user aims for: `Z` is the
 * key printed `Z`, which on QWERTZ sits where QWERTY has `Y`.
 */
function matchesKey(event, key) {
  if (/^[0-9]$/.test(key)) return event.code === `Digit${key}` || event.code === `Numpad${key}`
  if (key === 'Space') return event.key === ' ' || event.code === 'Space'
  if (key.length === 1) return event.key.toLowerCase() === key.toLowerCase()
  return event.key === key
}

/**
 * Whether a KeyboardEvent is exactly this combination.
 *
 * Exact: a modifier not named in the combination must be up, so `Shift+Z` never fires
 * on plain `Z`. Where Shift only varies the behaviour, `hotkeys.js` marks the command
 * `shiftModifies` instead.
 *
 * @param {KeyboardEvent} event
 * @param {string[]} combo key names, e.g. `['Mod', 'B']`. `Mod` is ⌘ on macOS, Ctrl
 *   elsewhere -- the same meaning the palette gives it.
 */
export function matchesShortcut(event, combo) {
  if (!Array.isArray(combo) || combo.length === 0) return false

  const wanted = { ctrl: false, meta: false, alt: false, shift: false }
  let key = null

  for (const name of combo) {
    if (!MODIFIERS.has(name)) {
      // A combination carries exactly one key besides its modifiers.
      if (key !== null) return false
      key = name
      continue
    }
    if (name === 'Mod') wanted[IS_MAC ? 'meta' : 'ctrl'] = true
    else if (name === 'Meta') wanted.meta = true
    else if (name === 'Ctrl') wanted.ctrl = true
    else if (name === 'Alt') wanted.alt = true
    else wanted.shift = true
  }

  if (key === null) return false
  if (event.ctrlKey !== wanted.ctrl) return false
  if (event.metaKey !== wanted.meta) return false
  if (event.altKey !== wanted.alt) return false
  if (event.shiftKey !== wanted.shift) return false

  return matchesKey(event, key)
}
