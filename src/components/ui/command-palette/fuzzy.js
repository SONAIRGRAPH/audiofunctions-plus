/**
 * Fuzzy matching for the CommandPalette.
 *
 * Scored with a dynamic-programming alignment rather than a greedy scan:
 * dp[i][j] = best score when query[i] lands on text[j]. O(query * text).
 */

const BASE = 16 // per matched character
const BONUS_BOUNDARY = 8 // match at the start of a word
const BONUS_CAMEL = 6 // match on a camelCase hump
const BONUS_CONSECUTIVE = 8 // match directly after the previous one
const GAP_START = 3 // penalty for opening a gap
const GAP_EXTEND = 1 // penalty per further skipped character
const KEYWORD_PENALTY = 12 // alias matches count for less than label matches
const MAX_LEADING_PENALTY = 6 // capped, so long labels don't lose on length alone

const NEG = -Infinity
const SEPARATORS = ' \t-_/.:\\()[]'

function boundaryBonus(text, j) {
  if (j === 0) return BONUS_BOUNDARY
  const prev = text[j - 1]
  if (SEPARATORS.includes(prev)) return BONUS_BOUNDARY

  const cur = text[j]
  const prevIsLower = prev !== prev.toUpperCase() && prev === prev.toLowerCase()
  const curIsUpper = cur !== cur.toLowerCase() && cur === cur.toUpperCase()
  if (prevIsLower && curIsUpper) return BONUS_CAMEL

  return 0
}

/** Collapse adjacent match positions into `[start, end)` ranges. */
function toRanges(positions) {
  const ranges = []
  for (const pos of positions) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === pos) last[1] = pos + 1
    else ranges.push([pos, pos + 1])
  }
  return ranges
}

/**
 * @returns {{score: number, ranges: Array<[number, number]>}|null} `null` when the
 *   query is not a subsequence of `text`.
 */
export function fuzzyScore(text, query) {
  if (!query) return { score: 0, ranges: [] }

  const n = text.length
  const m = query.length
  if (m > n) return null

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Fast reject: without the subsequence property there is no alignment.
  let probe = 0
  for (let j = 0; j < n && probe < m; j++) {
    if (lowerText[j] === lowerQuery[probe]) probe++
  }
  if (probe < m) return null

  const bonus = new Array(n)
  for (let j = 0; j < n; j++) bonus[j] = boundaryBonus(text, j)

  const dp = []
  const from = [] // backtracking: where did query[i-1] match?
  for (let i = 0; i < m; i++) {
    dp.push(new Float64Array(n).fill(NEG))
    from.push(new Int32Array(n).fill(-1))
  }

  for (let j = 0; j <= n - m; j++) {
    if (lowerText[j] === lowerQuery[0]) {
      dp[0][j] = BASE + bonus[j] - Math.min(j, MAX_LEADING_PENALTY) * GAP_EXTEND
    }
  }

  for (let i = 1; i < m; i++) {
    // gapMax = max over k <= j-2 of (dp[i-1][k] - gap cost up to j), decayed by
    // GAP_EXTEND per step instead of re-checking every k.
    let gapMax = NEG
    let gapIdx = -1

    for (let j = i; j < n; j++) {
      if (lowerText[j] === lowerQuery[i]) {
        let best = NEG
        let bestFrom = -1

        const consecutive = dp[i - 1][j - 1]
        if (consecutive !== NEG) {
          best = consecutive + BONUS_CONSECUTIVE
          bestFrom = j - 1
        }
        if (gapMax !== NEG && gapMax - GAP_START > best) {
          best = gapMax - GAP_START
          bestFrom = gapIdx
        }

        if (best !== NEG) {
          dp[i][j] = best + BASE + bonus[j]
          from[i][j] = bestFrom
        }
      }

      const candidate = dp[i - 1][j - 1]
      if (gapMax === NEG) {
        if (candidate !== NEG) {
          gapMax = candidate
          gapIdx = j - 1
        }
      } else {
        gapMax -= GAP_EXTEND
        if (candidate !== NEG && candidate > gapMax) {
          gapMax = candidate
          gapIdx = j - 1
        }
      }
    }
  }

  let bestEnd = -1
  let bestScore = NEG
  for (let j = m - 1; j < n; j++) {
    if (dp[m - 1][j] > bestScore) {
      bestScore = dp[m - 1][j]
      bestEnd = j
    }
  }
  if (bestEnd < 0) return null

  const positions = []
  for (let i = m - 1, j = bestEnd; i >= 0 && j >= 0; j = from[i][j], i--) {
    positions.push(j)
  }
  positions.reverse()

  return { score: bestScore, ranges: toRanges(positions) }
}

/**
 * Filters and sorts entries. An empty query keeps the original order.
 *
 * @param {Array<{item: object, depth: number}>} entries flat list, see `flatten` in
 *   useCommandPalette.
 * @returns {Array<{entry: object, score: number, ranges: Array<[number, number]>, index: number}>}
 */
export function filterItems(entries, query) {
  const trimmed = query.trim()
  if (!trimmed) {
    return entries.map((entry, index) => ({ entry, score: 0, ranges: [], index }))
  }

  const matches = []
  entries.forEach((entry, index) => {
    const { item } = entry
    const labelMatch = fuzzyScore(item.label, trimmed)
    let score = labelMatch ? labelMatch.score : null

    // Alias matches make an item findable but never highlight anything in the label.
    for (const keyword of item.keywords ?? []) {
      const keywordMatch = fuzzyScore(keyword, trimmed)
      if (!keywordMatch) continue
      const keywordScore = keywordMatch.score - KEYWORD_PENALTY
      if (score === null || keywordScore > score) score = keywordScore
    }

    if (score !== null) {
      matches.push({ entry, score, ranges: labelMatch ? labelMatch.ranges : [], index })
    }
  })

  // Stable secondary criteria, otherwise the list jumps around while typing.
  matches.sort(
    (a, b) => b.score - a.score || a.entry.depth - b.entry.depth || a.index - b.index,
  )
  return matches
}
