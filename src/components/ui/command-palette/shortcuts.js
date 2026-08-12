/**
 * Shortcuts are token arrays (`['Mod', 'K']`) rendered three ways:
 *
 *  - `shortcutGlyphs`  visible and symbolic (`⌘K`), always `aria-hidden`
 *  - `shortcutSpeech`  spelled out ("Control plus K"), this is what gets announced
 *  - `shortcutAria`    ARIA tokens ("Control+K") for `aria-keyshortcuts`
 *
 * `Mod` is the platform's command key: ⌘ on macOS, Ctrl elsewhere.
 */

function detectMac() {
  if (typeof navigator === 'undefined') return false
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

const IS_MAC = detectMac()

const GLYPHS = {
  Mod: IS_MAC ? '⌘' : 'Ctrl',
  Meta: IS_MAC ? '⌘' : 'Win',
  Ctrl: IS_MAC ? '⌃' : 'Ctrl',
  Alt: IS_MAC ? '⌥' : 'Alt',
  Shift: '⇧',
  Enter: '↵',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: 'Del',
  Tab: '⇥',
  Space: 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

const SPEECH = {
  Mod: IS_MAC ? 'Command' : 'Control',
  Meta: IS_MAC ? 'Command' : 'Windows key',
  Ctrl: 'Control',
  Alt: IS_MAC ? 'Option' : 'Alt',
  Shift: 'Shift',
  Enter: 'Enter',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  Space: 'Spacebar',
  ArrowUp: 'Up arrow',
  ArrowDown: 'Down arrow',
  ArrowLeft: 'Left arrow',
  ArrowRight: 'Right arrow',
}

// Modifier tokens permitted by the ARIA specification.
const ARIA_TOKENS = {
  Mod: IS_MAC ? 'Meta' : 'Control',
  Meta: 'Meta',
  Ctrl: 'Control',
  Alt: 'Alt',
  Shift: 'Shift',
  Space: 'Space',
}

/**
 * @param {string[]} tokens
 * @param {Record<string, string>} [overrides] from `labels.keyGlyphs`
 * @returns {string} e.g. `⌘K` or `Ctrl+K`
 */
export function shortcutGlyphs(tokens, overrides = {}) {
  return tokens.map((token) => overrides[token] ?? GLYPHS[token] ?? token).join(IS_MAC ? '' : '+')
}

/**
 * @param {string[]} tokens
 * @param {Record<string, string>} [overrides] from `labels.keys`
 * @param {string} [joiner] from `labels.keyJoiner`
 * @returns {string} e.g. `Control plus K`
 */
export function shortcutSpeech(tokens, overrides = {}, joiner = ' plus ') {
  return tokens.map((token) => overrides[token] ?? SPEECH[token] ?? token).join(joiner)
}

/**
 * Never localized — ARIA specification tokens, not display text.
 *
 * @returns {string} e.g. `Control+K` for `aria-keyshortcuts`
 */
export function shortcutAria(tokens) {
  return tokens.map((token) => ARIA_TOKENS[token] ?? token).join('+')
}
