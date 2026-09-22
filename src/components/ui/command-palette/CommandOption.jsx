import { Fragment } from 'react'
import { shortcutAria, shortcutGlyphs, shortcutSpeech } from './shortcuts'
import { childCount, hasChildren } from './useCommandPalette'

/**
 * Highlights the fuzzy matches.
 *
 * `<span>` rather than `<mark>`: VoiceOver announces highlights with "highlight
 * start/end", which is unusable on every other letter of a match.
 */
function Highlighted({ text, ranges }) {
  if (ranges.length === 0) return text

  const parts = []
  let cursor = 0

  ranges.forEach(([start, end], index) => {
    if (start > cursor) {
      parts.push(<Fragment key={`gap-${index}`}>{text.slice(cursor, start)}</Fragment>)
    }
    parts.push(
      <span className="cp-match" key={`hit-${index}`}>
        {text.slice(start, end)}
      </span>,
    )
    cursor = end
  })

  if (cursor < text.length) parts.push(<Fragment key="tail">{text.slice(cursor)}</Fragment>)
  return parts
}

/**
 * A single option in the list.
 *
 * The accessible name of a `role="option"` is computed from its content, so DOM
 * order is speaking order. Label, trail, shortcut and submenu hint appear in the
 * order they should be read; the visual arrangement is left to CSS.
 */
export function CommandOption({
  entry,
  ranges,
  isActive,
  id,
  labels,
  reserveIcon,
  animateIn,
  enterIndex,
  onActivate,
  onPointerMove,
  registerRef,
}) {
  const { item, trail } = entry
  const submenu = hasChildren(item)
  const count = childCount(item)

  return (
    <div
      ref={(node) => {
        registerRef(entry.key, node)
      }}
      id={id}
      role="option"
      aria-selected={isActive}
      aria-disabled={item.disabled || undefined}
      // Supplementary — support is patchy, the sr-only text below carries it.
      aria-keyshortcuts={item.shortcut ? shortcutAria(item.shortcut) : undefined}
      className={`cp-option${isActive ? ' cp-option--active' : ''}${item.disabled ? ' cp-option--disabled' : ''}${animateIn ? ' cp-option--enter' : ''}`}
      // Capped at 8 rows, beyond that the cascade outlasts the animation itself.
      style={animateIn ? { animationDelay: `${Math.min(enterIndex, 8) * 10}ms` } : undefined}
      // `pointermove` rather than `mouseenter`, so a re-render under a stationary
      // pointer does not hijack the selection.
      onPointerMove={() => onPointerMove(entry.key)}
      onClick={() => onActivate(entry)}
    >
      {/* Always `aria-hidden` — the label carries the meaning. The empty span keeps
          labels aligned when only some entries have an icon. */}
      {(item.icon || reserveIcon) && (
        <span className="cp-option__icon" aria-hidden="true">
          {item.icon}
        </span>
      )}

      <span className="cp-option__text">
        <span className="cp-option__label">
          <Highlighted text={item.label} ranges={ranges} />
        </span>

        {/* Origin of a cross-level match, without which two identically labelled
            commands from different submenus are indistinguishable. */}
        {trail.length > 0 && (
          <>
            <span className="cp-sr-only">, {labels.inTrail(trail)}</span>
            <span className="cp-trail" aria-hidden="true">
              {trail.join(' › ')}
            </span>
          </>
        )}

        {item.shortcut && (
          <span className="cp-sr-only">
            , {labels.shortcut(shortcutSpeech(item.shortcut, labels.keys, labels.keyJoiner))}
          </span>
        )}

        {submenu && <span className="cp-sr-only">, {labels.submenu(count)}</span>}

        {item.hint && <span className="cp-option__hint">{item.hint}</span>}
      </span>

      {item.shortcut && (
        <kbd className="cp-kbd" aria-hidden="true">
          {shortcutGlyphs(item.shortcut, labels.keyGlyphs)}
        </kbd>
      )}

      {submenu && (
        <span className="cp-chevron" aria-hidden="true">
          ›
        </span>
      )}
    </div>
  )
}
