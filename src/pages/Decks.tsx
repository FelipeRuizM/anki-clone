import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconPlay, IconPlus } from '../components/icons'
import { CountChips, Modal, Spinner, btnPrimary, inputCls } from '../components/ui'
import { useStore } from '../lib/store'
import { deckCounts, newIntroducedToday } from '../lib/queue'

export default function Decks() {
  const { decks, cardsByDeck, todayLogs, dataReady, createDeck } = useStore()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const navigate = useNavigate()

  const rows = useMemo(() => {
    const now = Date.now()
    return decks.map((deck) => {
      const counts = deckCounts(
        cardsByDeck.get(deck.id) ?? [],
        deck,
        newIntroducedToday(todayLogs, deck.id),
        now,
      )
      return { deck, counts, total: (cardsByDeck.get(deck.id) ?? []).length }
    })
  }, [decks, cardsByDeck, todayLogs])

  const waiting = rows.reduce(
    (n, r) => n + r.counts.newCount + r.counts.learnCount + r.counts.dueCount,
    0,
  )

  if (!dataReady) return <Spinner label="Loading your decks…" />

  const submitNew = async () => {
    if (!name.trim()) return
    const id = await createDeck(name, desc.trim())
    setShowNew(false)
    setName('')
    setDesc('')
    navigate(`/deck/${id}`)
  }

  return (
    <div className="fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decks</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {waiting > 0 ? (
              <>
                <span className="font-semibold text-accent-600 dark:text-accent-400">{waiting}</span>{' '}
                card{waiting === 1 ? '' : 's'} waiting for you today
              </>
            ) : (
              'All caught up — nothing due right now 🎉'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={btnPrimary} onClick={() => setShowNew(true)}>
            <IconPlus width={16} height={16} /> New deck
          </button>
          {waiting > 0 && decks.length > 1 && (
            <Link to="/study/all" className={btnPrimary}>
              <IconPlay width={14} height={14} /> Study all
            </Link>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
          <p className="text-lg font-semibold">No decks yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
            Create a deck here, use the Import page, or just ask Claude Code:{' '}
            <em>“make flashcards from my Chapter 5 notes”</em> — cards land here automatically.
          </p>
          <button className={`${btnPrimary} mt-5`} onClick={() => setShowNew(true)}>
            <IconPlus width={16} height={16} /> Create your first deck
          </button>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ deck, counts, total }) => (
            <li
              key={deck.id}
              className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-accent-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-accent-700"
            >
              <Link to={`/deck/${deck.id}`} className="min-w-0 flex-1">
                <p className="truncate font-semibold">{deck.name}</p>
                <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                  {deck.description || `${total} card${total === 1 ? '' : 's'}`}
                </p>
              </Link>
              <CountChips {...counts} size="md" />
              <Link
                to={`/study/${deck.id}`}
                className={`rounded-xl p-2.5 transition ${
                  counts.newCount + counts.learnCount + counts.dueCount > 0
                    ? 'bg-accent-600 text-white hover:bg-accent-500'
                    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800'
                }`}
                title="Study this deck"
              >
                <IconPlay width={16} height={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showNew && (
        <Modal title="New deck" onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <input
              className={inputCls}
              placeholder="Deck name (e.g. JPST 100 — Chapter 5)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNew()}
              autoFocus
            />
            <input
              className={inputCls}
              placeholder="Description (optional)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitNew()}
            />
            <div className="flex justify-end">
              <button className={btnPrimary} onClick={submitNew} disabled={!name.trim()}>
                Create
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
