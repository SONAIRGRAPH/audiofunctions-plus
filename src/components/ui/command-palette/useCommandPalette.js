import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filterItems } from './fuzzy'
import { defaultLabels } from './labels'
import { shortcutSpeech } from './shortcuts'
import { useAnnouncer } from './useAnnouncer'

const PAGE_SIZE = 10

const ANNOUNCE_DELAY = {
  query: 180, // typing: otherwise one announcement queues up per keystroke
  items: 500, // external changes: more generous, they arrive unrequested
}

// Long enough that the live region is registered before it is written to — a region
// written in the same beat as its insertion gets swallowed. Overshooting costs nothing:
// a polite region queues, so the help lands after the opening announcement either way.
const INTRO_DELAY = 600

export function hasChildren(item) {
  return Array.isArray(item?.children) && item.children.length > 0
}

export function childCount(item) {
  return Array.isArray(item?.children) ? item.children.length : 0
}

/**
 * Flattens the tree below `items`.
 *
 * `key` is the composed path, not the item id — the same command can live in
 * several submenus, and `aria-activedescendant` needs unique, stable keys.
 * Item ids must therefore not contain a `/`.
 *
 * @returns {Array<{key: string, item: object, path: string[], trail: string[], depth: number}>}
 */
function flatten(items, path = [], trail = [], depth = 0, out = []) {
  for (const item of items) {
    const itemPath = [...path, item.id]
    out.push({ key: itemPath.join('/'), item, path: itemPath, trail, depth })
    if (hasChildren(item)) {
      flatten(item.children, itemPath, [...trail, item.label], depth + 1, out)
    }
  }
  return out
}

/** Spoken text for an entry — same order as the DOM. */
function describeEntry(entry, labels) {
  if (!entry) return ''

  const { item, trail } = entry
  const parts = [item.label]
  if (trail.length > 0) parts.push(labels.inTrail(trail))
  if (item.shortcut) {
    parts.push(labels.shortcut(shortcutSpeech(item.shortcut, labels.keys, labels.keyJoiner)))
  }
  if (hasChildren(item)) parts.push(labels.submenu(childCount(item)))
  if (item.hint) parts.push(item.hint)

  return parts.join(', ')
}

/**
 * Walks a path of item ids from the root downwards.
 *
 * @returns {{items: Array, label: string}|null} `null` when the path no longer exists.
 */
function resolveLevel(rootItems, path, rootLabel) {
  let items = rootItems
  let label = rootLabel

  for (const id of path) {
    const parent = items.find((item) => item.id === id)
    if (!parent || !hasChildren(parent)) return null
    items = parent.children
    label = parent.label
  }

  return { items, label }
}

/**
 * Level stack, filtering, active entry and the screen reader announcements derived
 * from them. Usable headless, without the CommandPalette component.
 *
 * Invariants that must not be broken:
 *
 * - The active entry is tracked by path key, never by index. Filtering has to change
 *   the value of `aria-activedescendant`, otherwise no re-announcement happens.
 * - Every state change records its `cause`. `nav` and `pointer` stay silent because
 *   `aria-activedescendant` already announces them; a live region on top would
 *   double up.
 * - Levels hold only their path, so the whole palette follows a changing `items`
 *   prop with no stale snapshot.
 */
export function useCommandPalette({ items, onClose, labels }) {
  const [stack, setStack] = useState([{ path: [], query: '', activeKey: null }])
  const [cause, setCause] = useState('level')
  const { messages, announce, cancel: cancelAnnouncement } = useAnnouncer()

  // Defensive merge so the hook also works standalone with a partial object.
  const l = useMemo(() => ({ ...defaultLabels, ...labels }), [labels])

  // Refs, not state, so StrictMode double-mounts don't reset them.
  const interactedRef = useRef(false)
  const prevItemsRef = useRef(items)
  const signatureRef = useRef(null)

  const levels = useMemo(() => {
    const resolved = []
    for (const entry of stack) {
      const level = resolveLevel(items, entry.path, l.root)
      if (!level) break
      resolved.push({ ...entry, ...level })
    }
    return resolved
  }, [items, stack, l])

  const level = levels[levels.length - 1]
  const canGoBack = levels.length > 1

  // Submenu vanished from the data while the user was standing in it. During render
  // rather than in an effect, so no frame with an invalid stack is committed.
  // Converges because the condition is false afterwards.
  if (levels.length < stack.length) {
    setStack((prev) => prev.slice(0, levels.length))
    setCause('pruned')
  }

  // Without a search only the current level, otherwise the hierarchy would be gone
  // the moment the palette opens.
  const browseEntries = useMemo(
    () => level.items.map((item) => ({ key: item.id, item, path: [item.id], trail: [], depth: 0 })),
    [level.items],
  )

  // With a search, the whole subtree from here down.
  const searchEntries = useMemo(() => flatten(level.items), [level.items])

  const searching = level.query.trim() !== ''
  const results = useMemo(
    () => filterItems(searching ? searchEntries : browseEntries, level.query),
    [searching, searchEntries, browseEntries, level.query],
  )

  // Falls back to the first match when `activeKey` is empty or filtered out, which
  // is why `setQuery` clears it: typing jumps to the best match.
  const activeIndex = useMemo(() => {
    if (results.length === 0) return -1
    const found = results.findIndex((result) => result.entry.key === level.activeKey)
    return found >= 0 ? found : 0
  }, [results, level.activeKey])

  const activeEntry = activeIndex >= 0 ? results[activeIndex].entry : null

  const patchLevel = useCallback((patch) => {
    setStack((prev) => {
      const next = prev.slice()
      next[next.length - 1] = { ...next[next.length - 1], ...patch }
      return next
    })
  }, [])

  const setQuery = useCallback(
    (query) => {
      interactedRef.current = true
      setCause('query')
      patchLevel({ query, activeKey: null })
    },
    [patchLevel],
  )

  /** @param {number|'first'|'last'} target step width or jump target. */
  const move = useCallback(
    (target) => {
      if (results.length === 0) return

      let next
      if (target === 'first') {
        next = 0
      } else if (target === 'last') {
        next = results.length - 1
      } else if (Math.abs(target) === 1) {
        // Single steps wrap around at the ends.
        next = (activeIndex + target + results.length) % results.length
      } else {
        next = Math.min(results.length - 1, Math.max(0, activeIndex + target))
      }

      interactedRef.current = true
      setCause('nav')
      patchLevel({ activeKey: results[next].entry.key })
    },
    [results, activeIndex, patchLevel],
  )

  // `entry.path` is relative to the current level, so a search match from deeper down
  // descends several levels at once.
  const openSubmenu = useCallback((entry) => {
    interactedRef.current = true
    setCause('level')
    setStack((prev) => [
      ...prev,
      {
        path: [...prev[prev.length - 1].path, ...entry.path],
        query: '',
        activeKey: null,
      },
    ])
  }, [])

  // Query and active entry live per level, so going back restores both.
  const back = useCallback(() => {
    interactedRef.current = true
    setCause('level')
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const select = useCallback(
    (entry) => {
      if (!entry || entry.item.disabled) return
      if (hasChildren(entry.item)) {
        openSubmenu(entry)
        return
      }
      // Without an action, do nothing — a submenu that has become empty must not
      // silently close the palette on Enter.
      if (!entry.item.perform) return

      onClose()
      // Close first: `dialog.close()` returns focus to the opener and would otherwise
      // take away a focus the action had just set.
      setTimeout(() => entry.item.perform(entry.item), 0)
    },
    [onClose, openSubmenu],
  )

  const setActiveByPointer = useCallback(
    (key) => {
      if (key === activeEntry?.key) return
      setCause('pointer')
      patchLevel({ activeKey: key })
    },
    [activeEntry, patchLevel],
  )

  useEffect(() => {
    if (prevItemsRef.current === items) return
    prevItemsRef.current = items
    setCause('items')
  }, [items])

  const announcement = useMemo(() => {
    // Already carried by `aria-activedescendant`.
    if (cause === 'nav' || cause === 'pointer') return null
    // Carried by the empty-state option.
    if (results.length === 0) return null

    const count = l.itemCount(results.length)
    let head
    if (cause === 'pruned') head = l.submenuGone(level.label, count)
    else if (cause === 'items') head = l.listUpdated(count)
    else if (cause === 'level') head = l.levelEntered(level.label, count)
    else head = l.resultCount(results.length)

    return `${head}. ${describeEntry(activeEntry, l)}`
  }, [cause, results.length, activeEntry, level.label, l])

  // What the user currently perceives: match count, and what Enter would run.
  const signature = `${results.length}|${activeEntry?.key ?? ''}`

  useEffect(() => {
    const remember = () => {
      signatureRef.current = signature
    }

    if (!announcement) {
      // Drop a pending typing announcement so it doesn't arrive late and out of date.
      cancelAnnouncement()
      remember()
      return
    }

    // Silent on open — the dialog announces itself.
    if (!interactedRef.current && cause !== 'items' && cause !== 'pruned') {
      remember()
      return
    }

    // External changes only when something actually changed, otherwise a list
    // refreshing every second talks non-stop.
    if (cause === 'items' && signature === signatureRef.current) return

    remember()
    announce(announcement, { delay: ANNOUNCE_DELAY[cause] ?? 0 })
  }, [announcement, cause, signature, announce, cancelAnnouncement])

  // Always the root text — the stack starts empty on every mount. A string, so an
  // unstable `labels` object cannot retrigger the effect below.
  const introduction = l.footerRoot

  // The keyboard help, spoken once per session after the dialog has announced itself.
  // Must stay below the effect above: on open that one runs first and may cancel a
  // pending announcement, which would swallow this one.
  //
  // Any real interaction inside the delay wins, because every announcement shares one
  // timer — arrowing or typing right after opening discards the help instead of talking
  // over the user.
  useEffect(() => {
    announce(introduction, { delay: INTRO_DELAY })
  }, [announce, introduction])

  return {
    level,
    results,
    activeEntry,
    activeIndex,
    cause,
    canGoBack,
    searching,
    query: level.query,
    breadcrumb: levels.map((entry) => entry.label),
    messages,
    pageSize: PAGE_SIZE,
    setQuery,
    move,
    select,
    back,
    setActiveByPointer,
  }
}
