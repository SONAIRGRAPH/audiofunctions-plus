import { createContext, useContext } from 'react'

// Split in two: `ActionsContext` never changes value, so components that only open
// the palette do not re-render when it opens or closes. Only subscribers of
// `OpenContext` pay for that.
export const ActionsContext = createContext(null)
export const OpenContext = createContext(false)

/** `{ open, close, toggle }` — stable across renders, safe in dependency arrays. */
export function useCommandPaletteActions() {
  const actions = useContext(ActionsContext)
  if (!actions) {
    throw new Error('useCommandPaletteActions must be used inside <CommandPaletteProvider>')
  }
  return actions
}

/** Whether the palette is currently open. Re-renders the caller on every change. */
export function useCommandPaletteOpen() {
  return useContext(OpenContext)
}
