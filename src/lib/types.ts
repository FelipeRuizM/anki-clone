/** Card lifecycle state, matching ts-fsrs State enum values. */
export type CardState = 0 | 1 | 2 | 3 // New, Learning, Review, Relearning

export type Rating = 1 | 2 | 3 | 4 // Again, Hard, Good, Easy

export interface Deck {
  id: string
  name: string
  description: string
  /** How many brand-new cards to introduce per day. */
  newPerDay: number
  createdAt: number
  updatedAt: number
}

/** FSRS scheduling fields stored on each card (times are epoch millis). */
export interface SrsData {
  due: number
  stability: number
  difficulty: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: CardState
  last_review: number | null
}

export interface CardDoc extends SrsData {
  id: string
  deckId: string
  front: string
  back: string
  notes: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

export type NewCardInput = {
  front: string
  back: string
  notes?: string
  tags?: string[]
}

export interface ReviewLogDoc {
  id: string
  cardId: string
  deckId: string
  rating: Rating
  stateBefore: CardState
  reviewedAt: number
  durationMs: number
}

export interface DailyAgg {
  total?: number
  again?: number
  hard?: number
  good?: number
  easy?: number
  newCards?: number
  timeMs?: number
}

export type DailyStats = Record<string, DailyAgg>

export interface DeckImport {
  deck: string
  description?: string
  cards: NewCardInput[]
}
