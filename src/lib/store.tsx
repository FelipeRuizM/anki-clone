import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { emptySrs, schedule } from './fsrs'
import { dateKey, startOfToday } from './queue'
import type {
  CardDoc,
  DailyStats,
  Deck,
  DeckImport,
  NewCardInput,
  Rating,
  ReviewLogDoc,
  SrsData,
} from './types'

const RATING_KEY: Record<Rating, 'again' | 'hard' | 'good' | 'easy'> = {
  1: 'again',
  2: 'hard',
  3: 'good',
  4: 'easy',
}

interface UndoEntry {
  card: CardDoc
  logId: string
  dKey: string
  rating: Rating
  wasNew: boolean
  durationMs: number
}

export interface Store {
  user: User | null
  authLoading: boolean
  dataReady: boolean
  decks: Deck[]
  cards: CardDoc[]
  cardsByDeck: Map<string, CardDoc[]>
  todayLogs: ReviewLogDoc[]
  daily: DailyStats
  canUndo: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
  createDeck: (name: string, description?: string) => Promise<string>
  updateDeck: (id: string, patch: Partial<Omit<Deck, 'id'>>) => Promise<void>
  deleteDeck: (id: string) => Promise<void>
  addCard: (deckId: string, input: NewCardInput) => Promise<void>
  updateCard: (id: string, patch: Partial<Omit<CardDoc, 'id'>>) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  importDeck: (imp: DeckImport) => Promise<{ deckId: string; added: number; skipped: number }>
  reviewCard: (card: CardDoc, rating: Rating, durationMs: number) => SrsData
  undoLastReview: () => Promise<CardDoc | null>
}

const StoreContext = createContext<Store | null>(null)

/** Local date key that rolls over at midnight. */
function useDayKey(): string {
  const [key, setKey] = useState(() => dateKey())
  useEffect(() => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(24, 0, 1, 0)
    const t = setTimeout(() => setKey(dateKey()), next.getTime() - now.getTime())
    return () => clearTimeout(t)
  }, [key])
  return key
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [decks, setDecks] = useState<Deck[]>([])
  const [cards, setCards] = useState<CardDoc[]>([])
  const [todayLogs, setTodayLogs] = useState<ReviewLogDoc[]>([])
  const [daily, setDaily] = useState<DailyStats>({})
  const [decksReady, setDecksReady] = useState(false)
  const [cardsReady, setCardsReady] = useState(false)
  const [undoTick, setUndoTick] = useState(0)
  const dayKey = useDayKey()
  const undoRef = useRef<UndoEntry | null>(null)

  const decksRef = useRef(decks)
  decksRef.current = decks
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
  }, [])

  const uid = user?.uid

  useEffect(() => {
    if (!uid) {
      setDecks([])
      setCards([])
      setDaily({})
      setDecksReady(false)
      setCardsReady(false)
      undoRef.current = null
      return
    }
    const unsubs = [
      onSnapshot(
        collection(db, `users/${uid}/decks`),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Deck)
          list.sort((a, b) => a.createdAt - b.createdAt)
          setDecks(list)
          setDecksReady(true)
        },
        (err) => console.error('decks listener', err),
      ),
      onSnapshot(
        collection(db, `users/${uid}/cards`),
        (snap) => {
          setCards(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CardDoc))
          setCardsReady(true)
        },
        (err) => console.error('cards listener', err),
      ),
      onSnapshot(
        doc(db, `users/${uid}/stats/daily`),
        (snap) => setDaily((snap.data() as DailyStats | undefined) ?? {}),
        (err) => console.error('daily listener', err),
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [uid])

  // Today's review logs (for new-card allowances); resubscribes at midnight.
  useEffect(() => {
    if (!uid) {
      setTodayLogs([])
      return
    }
    const q = query(
      collection(db, `users/${uid}/reviews`),
      where('reviewedAt', '>=', startOfToday()),
    )
    return onSnapshot(
      q,
      (snap) => setTodayLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReviewLogDoc)),
      (err) => console.error('todayLogs listener', err),
    )
  }, [uid, dayKey])

  const signInWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider)
      } else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        throw e
      }
    }
  }, [])

  const signOutUser = useCallback(() => signOut(auth), [])

  const createDeck = useCallback(
    async (name: string, description = '') => {
      if (!uid) throw new Error('not signed in')
      const now = Date.now()
      const ref = await addDoc(collection(db, `users/${uid}/decks`), {
        name: name.trim(),
        description,
        newPerDay: 20,
        createdAt: now,
        updatedAt: now,
      })
      return ref.id
    },
    [uid],
  )

  const updateDeck = useCallback(
    async (id: string, patch: Partial<Omit<Deck, 'id'>>) => {
      if (!uid) throw new Error('not signed in')
      await updateDoc(doc(db, `users/${uid}/decks/${id}`), { ...patch, updatedAt: Date.now() })
    },
    [uid],
  )

  const deleteDeck = useCallback(
    async (id: string) => {
      if (!uid) throw new Error('not signed in')
      const mine = cardsRef.current.filter((c) => c.deckId === id)
      for (let i = 0; i < mine.length; i += 400) {
        const batch = writeBatch(db)
        for (const c of mine.slice(i, i + 400)) {
          batch.delete(doc(db, `users/${uid}/cards/${c.id}`))
        }
        await batch.commit()
      }
      await deleteDoc(doc(db, `users/${uid}/decks/${id}`))
      undoRef.current = null
      setUndoTick((t) => t + 1)
    },
    [uid],
  )

  const addCard = useCallback(
    async (deckId: string, input: NewCardInput) => {
      if (!uid) throw new Error('not signed in')
      const now = Date.now()
      await addDoc(collection(db, `users/${uid}/cards`), {
        deckId,
        front: input.front.trim(),
        back: input.back.trim(),
        notes: input.notes ?? '',
        tags: input.tags ?? [],
        createdAt: now,
        updatedAt: now,
        ...emptySrs(now),
      })
    },
    [uid],
  )

  const updateCard = useCallback(
    async (id: string, patch: Partial<Omit<CardDoc, 'id'>>) => {
      if (!uid) throw new Error('not signed in')
      await updateDoc(doc(db, `users/${uid}/cards/${id}`), { ...patch, updatedAt: Date.now() })
    },
    [uid],
  )

  const deleteCard = useCallback(
    async (id: string) => {
      if (!uid) throw new Error('not signed in')
      await deleteDoc(doc(db, `users/${uid}/cards/${id}`))
      if (undoRef.current?.card.id === id) {
        undoRef.current = null
        setUndoTick((t) => t + 1)
      }
    },
    [uid],
  )

  const importDeck = useCallback(
    async (imp: DeckImport) => {
      if (!uid) throw new Error('not signed in')
      const name = imp.deck.trim()
      let deck = decksRef.current.find((d) => d.name.toLowerCase() === name.toLowerCase())
      let deckId = deck?.id
      if (!deckId) {
        deckId = await createDeck(name, imp.description ?? '')
      } else if (imp.description && !deck?.description) {
        await updateDeck(deckId, { description: imp.description })
      }
      const existingFronts = new Set(
        cardsRef.current
          .filter((c) => c.deckId === deckId)
          .map((c) => c.front.trim().toLowerCase()),
      )
      const fresh: NewCardInput[] = []
      let skipped = 0
      for (const card of imp.cards) {
        const front = (card.front ?? '').trim()
        const back = (card.back ?? '').trim()
        if (!front || !back) {
          skipped++
          continue
        }
        if (existingFronts.has(front.toLowerCase())) {
          skipped++
          continue
        }
        existingFronts.add(front.toLowerCase())
        fresh.push({ front, back, notes: card.notes ?? '', tags: card.tags ?? [] })
      }
      let base = Date.now()
      for (let i = 0; i < fresh.length; i += 400) {
        const batch = writeBatch(db)
        for (const card of fresh.slice(i, i + 400)) {
          const now = base++ // preserve insertion order for new-card ordering
          batch.set(doc(collection(db, `users/${uid}/cards`)), {
            deckId,
            front: card.front,
            back: card.back,
            notes: card.notes ?? '',
            tags: card.tags ?? [],
            createdAt: now,
            updatedAt: now,
            ...emptySrs(now),
          })
        }
        await batch.commit()
      }
      return { deckId, added: fresh.length, skipped }
    },
    [uid, createDeck, updateDeck],
  )

  const reviewCard = useCallback(
    (card: CardDoc, rating: Rating, durationMs: number): SrsData => {
      if (!uid) throw new Error('not signed in')
      const srs = schedule(card, rating)
      const now = Date.now()
      const dKey = dateKey()
      const logRef = doc(collection(db, `users/${uid}/reviews`))
      const batch = writeBatch(db)
      batch.update(doc(db, `users/${uid}/cards/${card.id}`), { ...srs, updatedAt: now })
      batch.set(logRef, {
        cardId: card.id,
        deckId: card.deckId,
        rating,
        stateBefore: card.state,
        reviewedAt: now,
        durationMs,
      })
      batch.set(
        doc(db, `users/${uid}/stats/daily`),
        {
          [dKey]: {
            total: increment(1),
            [RATING_KEY[rating]]: increment(1),
            newCards: increment(card.state === 0 ? 1 : 0),
            timeMs: increment(durationMs),
          },
        },
        { merge: true },
      )
      batch.commit().catch((e) => console.error('review write failed', e))
      undoRef.current = {
        card: { ...card },
        logId: logRef.id,
        dKey,
        rating,
        wasNew: card.state === 0,
        durationMs,
      }
      setUndoTick((t) => t + 1)
      return srs
    },
    [uid],
  )

  const undoLastReview = useCallback(async (): Promise<CardDoc | null> => {
    if (!uid) throw new Error('not signed in')
    const entry = undoRef.current
    if (!entry) return null
    const { card, logId, dKey, rating, wasNew, durationMs } = entry
    const batch = writeBatch(db)
    const { id, ...fields } = card
    batch.set(doc(db, `users/${uid}/cards/${id}`), fields)
    batch.delete(doc(db, `users/${uid}/reviews/${logId}`))
    batch.set(
      doc(db, `users/${uid}/stats/daily`),
      {
        [dKey]: {
          total: increment(-1),
          [RATING_KEY[rating]]: increment(-1),
          newCards: increment(wasNew ? -1 : 0),
          timeMs: increment(-durationMs),
        },
      },
      { merge: true },
    )
    batch.commit().catch((e) => console.error('undo write failed', e))
    undoRef.current = null
    setUndoTick((t) => t + 1)
    return card
  }, [uid])

  const cardsByDeck = useMemo(() => {
    const map = new Map<string, CardDoc[]>()
    for (const c of cards) {
      const list = map.get(c.deckId)
      if (list) list.push(c)
      else map.set(c.deckId, [c])
    }
    return map
  }, [cards])

  const value = useMemo<Store>(
    () => ({
      user,
      authLoading,
      dataReady: decksReady && cardsReady,
      decks,
      cards,
      cardsByDeck,
      todayLogs,
      daily,
      canUndo: undoTick >= 0 && undoRef.current !== null,
      signInWithGoogle,
      signOutUser,
      createDeck,
      updateDeck,
      deleteDeck,
      addCard,
      updateCard,
      deleteCard,
      importDeck,
      reviewCard,
      undoLastReview,
    }),
    [
      user,
      authLoading,
      decksReady,
      cardsReady,
      decks,
      cards,
      cardsByDeck,
      todayLogs,
      daily,
      undoTick,
      signInWithGoogle,
      signOutUser,
      createDeck,
      updateDeck,
      deleteDeck,
      addCard,
      updateCard,
      deleteCard,
      importDeck,
      reviewCard,
      undoLastReview,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
