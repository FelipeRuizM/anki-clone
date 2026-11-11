import type { CardDoc, Deck, ReviewLogDoc } from './types'

export const DAY_MS = 86_400_000

/** Local-time date key like 2026-11-10. */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfToday(now = new Date()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfToday(now = new Date()): number {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** Count of brand-new cards first seen today, per deck (or all decks). */
export function newIntroducedToday(todayLogs: ReviewLogDoc[], deckId?: string): number {
  let n = 0
  for (const log of todayLogs) {
    if (log.stateBefore === 0 && (!deckId || log.deckId === deckId)) n++
  }
  return n
}

export interface DeckCounts {
  newCount: number
  learnCount: number
  dueCount: number
}

export function deckCounts(
  deckCards: CardDoc[],
  deck: Deck,
  newToday: number,
  now = Date.now(),
): DeckCounts {
  const eod = endOfToday(new Date(now))
  let newTotal = 0
  let learnCount = 0
  let dueCount = 0
  for (const c of deckCards) {
    if (c.state === 0) newTotal++
    else if ((c.state === 1 || c.state === 3) && c.due <= eod) learnCount++
    else if (c.state === 2 && c.due <= eod) dueCount++
  }
  const allowance = Math.max(0, deck.newPerDay - newToday)
  return { newCount: Math.min(allowance, newTotal), learnCount, dueCount }
}

/**
 * Build a study queue for one deck: learning cards due now first, then
 * due reviews with today's allowance of new cards interleaved.
 */
export function buildDeckQueue(
  deckCards: CardDoc[],
  deck: Deck,
  newToday: number,
  now = Date.now(),
): CardDoc[] {
  const eod = endOfToday(new Date(now))
  const learn = deckCards
    .filter((c) => (c.state === 1 || c.state === 3) && c.due <= now)
    .sort((a, b) => a.due - b.due)
  const review = deckCards
    .filter((c) => c.state === 2 && c.due <= eod)
    .sort((a, b) => a.due - b.due)
  const allowance = Math.max(0, deck.newPerDay - newToday)
  const fresh = deckCards
    .filter((c) => c.state === 0)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, allowance)
  return [...learn, ...interleave(review, fresh)]
}

/** Spread items of `b` evenly through `a`. */
function interleave<T>(a: T[], b: T[]): T[] {
  if (b.length === 0) return a
  if (a.length === 0) return b
  const out: T[] = []
  const step = (a.length + 1) / (b.length + 1)
  let bi = 0
  for (let ai = 0; ai < a.length; ai++) {
    while (bi < b.length && ai >= Math.round(step * (bi + 1))) out.push(b[bi++])
    out.push(a[ai])
  }
  while (bi < b.length) out.push(b[bi++])
  return out
}

/** Where to reinsert a just-rated card that is due again soon, or -1 to drop it. */
export function requeuePosition(due: number, queueLength: number, now = Date.now()): number {
  if (due > now + 20 * 60_000) return -1
  return Math.min(4, queueLength)
}
