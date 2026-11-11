import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  type Card as FsrsCard,
  type Grade,
  type State,
} from 'ts-fsrs'
import type { CardDoc, CardState, Rating, SrsData } from './types'

const f = fsrs(generatorParameters({ enable_fuzz: true, enable_short_term: true }))

export function fromFsrs(c: FsrsCard): SrsData {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps ?? 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as unknown as CardState,
    last_review: c.last_review ? c.last_review.getTime() : null,
  }
}

export function toFsrsCard(c: SrsData): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps ?? 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state as unknown as State,
    last_review: c.last_review != null ? new Date(c.last_review) : undefined,
  }
}

/** Fresh SRS fields for a brand-new card. */
export function emptySrs(now = Date.now()): SrsData {
  return fromFsrs(createEmptyCard(new Date(now)))
}

/** Apply a rating to a card and get its next SRS state. */
export function schedule(card: CardDoc, rating: Rating, now = new Date()): SrsData {
  const res = f.next(toFsrsCard(card), now, rating as Grade)
  return fromFsrs(res.card)
}

/** Human-readable interval previews for each rating button. */
export function previewIntervals(card: CardDoc, now = new Date()): Record<Rating, string> {
  const fc = toFsrsCard(card)
  const out = {} as Record<Rating, string>
  for (const g of [1, 2, 3, 4] as Rating[]) {
    const due = f.next(fc, now, g as Grade).card.due.getTime()
    out[g] = humanizeInterval(due - now.getTime())
  }
  return out
}

export function humanizeInterval(ms: number): string {
  const min = ms / 60000
  if (min < 1) return '<1m'
  if (min < 90) return `${Math.round(min)}m`
  const hours = min / 60
  if (hours < 36) return `${Math.round(hours)}h`
  const days = hours / 24
  if (days < 31) return `${Math.round(days)}d`
  const months = days / 30.44
  if (months < 18) return `${months.toFixed(1).replace(/\.0$/, '')}mo`
  const years = days / 365.25
  return `${years.toFixed(1).replace(/\.0$/, '')}y`
}

/** When a card is due, phrased for humans ("now", "in 3d", "2d ago"). */
export function humanizeDue(due: number, now = Date.now()): string {
  const diff = due - now
  if (diff <= 0) {
    if (diff > -60000) return 'now'
    return `${humanizeInterval(-diff)} ago`
  }
  return `in ${humanizeInterval(diff)}`
}
