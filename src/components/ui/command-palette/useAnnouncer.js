import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Drives two alternately written `aria-live` regions.
 *
 * Two, because writing identical text into the same node is not detected as a change
 * and screen readers stay silent. Both nodes must sit in the DOM empty from the
 * start — a live region mounted together with its content gets swallowed.
 */
export function useAnnouncer() {
  const [messages, setMessages] = useState(['', ''])
  const slotRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  /**
   * @param {string} text
   * @param {{delay?: number}} [options] `delay` debounces rapid calls, otherwise
   *   typing queues one announcement per keystroke.
   */
  const announce = useCallback((text, { delay = 0 } = {}) => {
    clearTimeout(timerRef.current)
    if (!text) return

    const write = () => {
      const slot = slotRef.current
      slotRef.current = slot === 0 ? 1 : 0
      // Clearing the other node does not itself trigger an announcement.
      setMessages(slot === 0 ? [text, ''] : ['', text])
    }

    if (delay > 0) timerRef.current = setTimeout(write, delay)
    else write()
  }, [])

  /** Discards a debounced announcement that has not been spoken yet. */
  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
  }, [])

  return { messages, announce, cancel }
}
