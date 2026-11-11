import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CardEditor from '../components/CardEditor'
import Rich from '../components/Rich'
import { IconPencil, IconUndo, IconX } from '../components/icons'
import { Spinner, btnOutline, btnPrimary } from '../components/ui'
import { previewIntervals } from '../lib/fsrs'
import { buildDeckQueue, newIntroducedToday, requeuePosition } from '../lib/queue'
import { useStore } from '../lib/store'
import type { CardDoc, Rating } from '../lib/types'

const RATING_BTN: { rating: Rating; label: string; cls: string }[] = [
  { rating: 1, label: 'Again', cls: 'bg-rose-600 hover:bg-rose-500' },
  { rating: 2, label: 'Hard', cls: 'bg-amber-500 hover:bg-amber-400' },
  { rating: 3, label: 'Good', cls: 'bg-emerald-600 hover:bg-emerald-500' },
  { rating: 4, label: 'Easy', cls: 'bg-sky-600 hover:bg-sky-500' },
]

export default function Study() {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const { decks, cardsByDeck, todayLogs, dataReady, reviewCard, undoLastReview, updateCard, canUndo } = useStore()

  const [queue, setQueue] = useState<CardDoc[] | null>(null)
  const [initialTotal, setInitialTotal] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState(0)
  const [ratings, setRatings] = useState<Record<Rating, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 })
  const [editing, setEditing] = useState(false)
  const shownAt = useRef(Date.now())
  const sessionStart = useRef(Date.now())
  const lastRating = useRef<Rating | null>(null)

  const deck = deckId === 'all' ? null : decks.find((d) => d.id === deckId)
  const title = deckId === 'all' ? 'All decks' : (deck?.name ?? 'Study')

  // Build the queue once when data is ready.
  useEffect(() => {
    if (!dataReady || queue !== null) return
    let built: CardDoc[] = []
    if (deckId === 'all') {
      const learn: CardDoc[] = []
      const rest: CardDoc[] = []
      for (const d of decks) {
        const q = buildDeckQueue(cardsByDeck.get(d.id) ?? [], d, newIntroducedToday(todayLogs, d.id))
        for (const c of q) {
          if ((c.state === 1 || c.state === 3) && c.due <= Date.now()) learn.push(c)
          else rest.push(c)
        }
      }
      learn.sort((a, b) => a.due - b.due)
      built = [...learn, ...rest]
    } else if (deck) {
      built = buildDeckQueue(cardsByDeck.get(deck.id) ?? [], deck, newIntroducedToday(todayLogs, deck.id))
    }
    setQueue(built)
    setInitialTotal(built.length)
    sessionStart.current = Date.now()
    shownAt.current = Date.now()
  }, [dataReady, queue, deckId, deck, decks, cardsByDeck, todayLogs])

  const current = queue?.[0] ?? null

  useEffect(() => {
    shownAt.current = Date.now()
  }, [current?.id])

  const previews = useMemo(() => (current ? previewIntervals(current) : null), [current])

  const remaining = useMemo(() => {
    const r = { newC: 0, learn: 0, review: 0 }
    for (const c of queue ?? []) {
      if (c.state === 0) r.newC++
      else if (c.state === 2) r.review++
      else r.learn++
    }
    return r
  }, [queue])

  const rate = useCallback(
    (rating: Rating) => {
      if (!current || !queue) return
      const duration = Math.min(Date.now() - shownAt.current, 60_000)
      const srs = reviewCard(current, rating, duration)
      lastRating.current = rating
      setAnswers((a) => a + 1)
      setRatings((r) => ({ ...r, [rating]: r[rating] + 1 }))
      const rest = queue.slice(1)
      const pos = requeuePosition(srs.due, rest.length)
      if (pos >= 0) rest.splice(pos, 0, { ...current, ...srs })
      setQueue(rest)
      setRevealed(false)
    },
    [current, queue, reviewCard],
  )

  const undo = useCallback(async () => {
    const prev = await undoLastReview()
    if (!prev) return
    setQueue((q) => [prev, ...(q ?? []).filter((c) => c.id !== prev.id)])
    setRevealed(false)
    setAnswers((a) => Math.max(0, a - 1))
    const lr = lastRating.current
    if (lr) setRatings((r) => ({ ...r, [lr]: Math.max(0, r[lr] - 1) }))
    lastRating.current = null
  }, [undoLastReview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return
      const t = e.target as HTMLElement
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!current) return
        if (!revealed) setRevealed(true)
        else rate(3)
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        rate(Number(e.key) as Rating)
      } else if ((e.key === 'z' || e.key === 'u') && canUndo) {
        undo()
      } else if (e.key === 'e' && current) {
        setEditing(true)
      } else if (e.key === 'Escape') {
        navigate(deck ? `/deck/${deck.id}` : '/')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, revealed, rate, undo, canUndo, editing, navigate, deck])

  if (!dataReady || queue === null) return <Spinner label="Preparing your session…" />

  const completed = initialTotal - queue.length
  const progress = initialTotal > 0 ? completed / initialTotal : 1

  // ----- Finished (or empty) state -----
  if (!current) {
    const minutes = Math.max(1, Math.round((Date.now() - sessionStart.current) / 60000))
    return (
      <div className="fade-up mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
        {initialTotal === 0 ? (
          <>
            <p className="text-5xl">🌤️</p>
            <h1 className="mt-4 text-2xl font-bold">Nothing due right now</h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Come back later, or add new cards to this deck.
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl">🎉</p>
            <h1 className="mt-4 text-2xl font-bold">Session complete</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {answers} answer{answers === 1 ? '' : 's'} · about {minutes} min
            </p>
            <div className="mt-6 grid w-full grid-cols-4 gap-2">
              {RATING_BTN.map(({ rating, label, cls }) => (
                <div key={rating} className={`rounded-xl ${cls.split(' ')[0]} px-2 py-3 text-white`}>
                  <p className="text-xl font-bold tabular-nums">{ratings[rating]}</p>
                  <p className="text-xs opacity-90">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-8 flex gap-3">
          <Link to={deck ? `/deck/${deck.id}` : '/'} className={btnOutline}>
            {deck ? 'Back to deck' : 'Back to decks'}
          </Link>
          <Link to="/" className={btnPrimary}>
            Decks
          </Link>
        </div>
      </div>
    )
  }

  // ----- Active review -----
  return (
    <div className="fade-up fixed inset-0 z-40 flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2">
          <button
            onClick={() => navigate(deck ? `/deck/${deck.id}` : '/')}
            className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="End session (Esc)"
          >
            <IconX width={18} height={18} />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{title}</p>
          <div className="flex items-center gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
              title="Undo last answer (Z)"
            >
              <IconUndo width={17} height={17} />
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Edit card (E)"
            >
              <IconPencil width={17} height={17} />
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-accent-500 transition-all duration-300"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex shrink-0 items-center justify-center gap-3 text-xs font-medium tabular-nums">
          <span className="text-sky-600 dark:text-sky-400" title="New">{remaining.newC}</span>
          <span className="text-amber-600 dark:text-amber-400" title="Learning">{remaining.learn}</span>
          <span className="text-emerald-600 dark:text-emerald-400" title="To review">{remaining.review}</span>
        </div>

        {/* Card */}
        <div
          className="my-4 flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center overflow-y-auto rounded-3xl border border-zinc-200 bg-white px-6 py-8 text-center shadow-sm select-none dark:border-zinc-800 dark:bg-zinc-900"
          onClick={() => !revealed && setRevealed(true)}
        >
          <Rich text={current.front} className="text-3xl leading-snug font-semibold text-balance sm:text-4xl" />
          {revealed && (
            <>
              <div className="my-6 h-px w-24 shrink-0 bg-zinc-200 dark:bg-zinc-700" />
              <Rich text={current.back} className="fade-up text-2xl leading-snug text-balance sm:text-3xl" />
              {current.notes && (
                <Rich
                  text={current.notes}
                  className="fade-up mt-5 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
                />
              )}
            </>
          )}
          {!revealed && <p className="mt-8 text-xs text-zinc-400">tap or press space to reveal</p>}
        </div>

        {/* Controls */}
        <div className="shrink-0 pb-4">
          {!revealed ? (
            <button className={`${btnPrimary} h-14 w-full text-base`} onClick={() => setRevealed(true)}>
              Show answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {RATING_BTN.map(({ rating, label, cls }) => (
                <button
                  key={rating}
                  onClick={() => rate(rating)}
                  className={`flex h-14 flex-col items-center justify-center rounded-xl text-white shadow-sm transition active:scale-[0.97] ${cls}`}
                >
                  <span className="text-sm font-bold">{label}</span>
                  <span className="text-[11px] opacity-85 tabular-nums">{previews?.[rating]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <CardEditor
          card={current}
          onClose={() => setEditing(false)}
          onSave={async (data) => {
            await updateCard(current.id, data)
            setQueue((q) => (q && q[0]?.id === current.id ? [{ ...q[0], ...data }, ...q.slice(1)] : q))
          }}
        />
      )}
    </div>
  )
}
