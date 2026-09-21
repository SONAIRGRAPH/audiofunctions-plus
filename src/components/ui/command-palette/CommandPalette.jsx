import { useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { CommandOption } from './CommandOption'
import { defaultLabels } from './labels'
import { useCommandPalette } from './useCommandPalette'
import './command-palette.css'

/**
 * Accessible command palette.
 *
 * ARIA combobox + listbox: focus stays in the input at all times and
 * `aria-activedescendant` points at the active option.
 *
 * @param {object}   props
 * @param {boolean}  props.open
 * @param {() => void} props.onClose
 * @param {Array}    props.items  see the item model in `demo-commands.jsx`
 * @param {object}   [props.labels]  partial override, see `labels.js`. Pass a stable
 *   object — a fresh one per render churns the memoisation.
 */
export function CommandPalette({ open, onClose, items, labels }) {
  const dialogRef = useRef(null)
  const openerRef = useRef(null)
  // Lives here rather than in PaletteBody so focus can be set after showModal().
  // React runs effects child-first, and focusing inside a `display: none` subtree
  // does nothing.
  const inputRef = useRef(null)

  const l = useMemo(() => ({ ...defaultLabels, ...labels }), [labels])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // The `dialog.open` check keeps this idempotent under StrictMode — a second
    // showModal() would throw.
    if (open && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
      inputRef.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
      openerRef.current?.focus?.()
      openerRef.current = null
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // Escape fires `cancel` and would close the dialog behind React's back. Route it
    // through onClose so cleanup and focus restoration run exactly once.
    const handleCancel = (event) => {
      event.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  return (
    // Native <dialog> + showModal() provides the top layer, focus trap and inert
    // background.
    <dialog
      ref={dialogRef}
      className="cp-dialog"
      aria-label={l.dialog}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      {/* Mounted only while open, so every session starts with fresh state. */}
      {open && (
        <PaletteBody items={items} onClose={onClose} labels={l} inputRef={inputRef} />
      )}
    </dialog>
  )
}

function PaletteBody({ items, onClose, labels, inputRef }) {
  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const emptyOptionId = `${baseId}-empty`
  // Ids from the stable path key, never from the index — see useCommandPalette.
  const optionId = (key) => `${baseId}-opt-${key}`

  const optionNodes = useRef(new Map())

  const {
    level,
    results,
    activeEntry,
    cause,
    canGoBack,
    searching,
    query,
    breadcrumb,
    messages,
    pageSize,
    setQuery,
    move,
    select,
    back,
    setActiveByPointer,
  } = useCommandPalette({ items, onClose, labels })

  const registerRef = useCallback((key, node) => {
    if (node) optionNodes.current.set(key, node)
    else optionNodes.current.delete(key)
  }, [])

  useEffect(() => {
    // Not on pointer-driven changes, otherwise the list jitters under the cursor.
    if (cause === 'pointer' || !activeEntry) return
    optionNodes.current.get(activeEntry.key)?.scrollIntoView({ block: 'nearest' })
  }, [activeEntry, cause])

  // Reserved for the whole list as soon as one entry has an icon, so the labels of
  // the others stay aligned.
  const reserveIcon = results.some(({ entry }) => entry.item.icon)

  let listLabel = labels.commands
  if (searching) {
    listLabel = canGoBack ? labels.searchResultsIn(level.label) : labels.searchResults
  } else if (canGoBack) {
    listLabel = labels.commandsIn(level.label)
  }

  function handleKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'PageDown':
        event.preventDefault()
        move(pageSize)
        break
      case 'PageUp':
        event.preventDefault()
        move(-pageSize)
        break
      case 'Home':
      case 'End':
        // With text typed these belong to the caret — screen reader users review
        // their input with them.
        if (query === '') {
          event.preventDefault()
          move(event.key === 'Home' ? 'first' : 'last')
        }
        break
      case 'Enter':
        // During an IME composition Enter belongs to the input method.
        if (event.nativeEvent.isComposing) return
        event.preventDefault()
        select(activeEntry)
        break
      case 'Backspace':
        // Only navigates while the field is empty, otherwise normal deletion.
        if (query === '' && canGoBack) {
          event.preventDefault()
          back()
        }
        break
      case 'Escape':
        event.preventDefault()
        onClose()
        break
      default:
        break
    }
  }

  return (
    <div className="cp-panel">
      {canGoBack && <p className="cp-breadcrumb">{breadcrumb.join(' › ')}</p>}

      <input
        ref={inputRef}
        type="text"
        className="cp-input"
        role="combobox"
        aria-expanded="true"
        aria-controls={listboxId}
        // Always points at something — at the empty-state option when there are no
        // matches. Removing the attribute makes screen readers re-read the whole
        // combobox instead.
        aria-activedescendant={activeEntry ? optionId(activeEntry.key) : emptyOptionId}
        aria-autocomplete="list"
        aria-label={canGoBack ? labels.searchIn(level.label) : labels.searchAll}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        placeholder={labels.placeholder}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <div id={listboxId} role="listbox" className="cp-list" aria-label={listLabel}>
        {results.map(({ entry, ranges }, index) => (
          <CommandOption
            key={entry.key}
            id={optionId(entry.key)}
            entry={entry}
            ranges={ranges}
            isActive={activeEntry?.key === entry.key}
            labels={labels}
            reserveIcon={reserveIcon}
            animateIn={cause === 'level'}
            enterIndex={index}
            registerRef={registerRef}
            onActivate={select}
            onPointerMove={setActiveByPointer}
          />
        ))}

        {/* Disabled option so `aria-activedescendant` keeps a target. The reference
            carries the announcement here, not the live region. */}
        {results.length === 0 && (
          <div
            id={emptyOptionId}
            role="option"
            aria-disabled="true"
            aria-selected="false"
            className="cp-empty"
          >
            {labels.empty(query)}
          </div>
        )}
      </div>

      <p className="cp-footer">{canGoBack ? labels.footerSubmenu : labels.footerRoot}</p>

      {/* Two alternately written regions — see useAnnouncer. Both sit in the DOM
          empty from the start. */}
      <div className="cp-sr-only" aria-live="polite" aria-atomic="true">
        {messages[0]}
      </div>
      <div className="cp-sr-only" aria-live="polite" aria-atomic="true">
        {messages[1]}
      </div>
    </div>
  )
}
