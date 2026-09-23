import { useEffect, useMemo, useState } from 'react'
import { CommandPalette } from './CommandPalette'
import { ActionsContext, OpenContext } from './paletteContext'

/** Default opening shortcut: Ctrl+K, or ⌘K on macOS. */
function isModK(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
}

/**
 * Owns the open state, registers the global shortcut and renders the palette once at
 * the root. Components below open it through `useCommandPaletteActions()`.
 *
 * Optional — `CommandPalette` stays fully controlled and works without this.
 *
 * @param {object} props
 * @param {Array}  props.items  see the item model in `demo-commands.jsx`
 * @param {object} [props.labels]
 * @param {(event: KeyboardEvent) => boolean} [props.shortcut] which combination
 *   toggles the palette. Pass a stable function.
 */
export function CommandPaletteProvider({ items, labels, shortcut = isModK, children }) {
  const [open, setOpen] = useState(false)
  // Which submenu to start in, read once per opening.
  const [initialPath, setInitialPath] = useState([])

  // Stable identity — see paletteContext.
  const actions = useMemo(
    () => ({
      /** @param {string[]} [path] item ids to descend into, e.g. `['quick-options']`. */
      open: (path) => {
        // Tolerates `onClick={open}`, which would otherwise hand us a MouseEvent.
        setInitialPath(Array.isArray(path) ? path : [])
        setOpen(true)
      },
      close: () => setOpen(false),
      toggle: () => {
        setInitialPath([])
        setOpen((current) => !current)
      },
    }),
    [],
  )

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Respect a handler that already claimed this combination.
      if (event.defaultPrevented) return
      if (!shortcut(event)) return
      event.preventDefault()
      // Toggles, always at the root. The listener sits on `window`, so it also fires
      // while focus is inside the palette's input.
      setInitialPath([])
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcut])

  return (
    <ActionsContext.Provider value={actions}>
      <OpenContext.Provider value={open}>
        {children}
        <CommandPalette
          open={open}
          onClose={actions.close}
          items={items}
          labels={labels}
          initialPath={initialPath}
        />
      </OpenContext.Provider>
    </ActionsContext.Provider>
  )
}
