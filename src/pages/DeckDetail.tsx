import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CardEditor from '../components/CardEditor'
import Rich from '../components/Rich'
import { IconBack, IconDownload, IconGear, IconPencil, IconPlay, IconPlus, IconTrash } from '../components/icons'
import { CountChips, Modal, Spinner, StateChip, btnOutline, btnPrimary, inputCls } from '../components/ui'
import { humanizeDue } from '../lib/fsrs'
import { deckCounts, newIntroducedToday } from '../lib/queue'
import { useStore } from '../lib/store'
import type { CardDoc } from '../lib/types'

export default function DeckDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { decks, cardsByDeck, todayLogs, dataReady, addCard, updateCard, deleteCard, updateDeck, deleteDeck } =
    useStore()
  const deck = decks.find((d) => d.id === id)
  const deckCards = useMemo(() => cardsByDeck.get(id) ?? [], [cardsByDeck, id])

  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CardDoc | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const counts = useMemo(
    () => (deck ? deckCounts(deckCards, deck, newIntroducedToday(todayLogs, deck.id)) : null),
    [deck, deckCards, todayLogs],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? deckCards.filter(
          (c) =>
            c.front.toLowerCase().includes(q) ||
            c.back.toLowerCase().includes(q) ||
            c.tags.some((t) => t.toLowerCase().includes(q)),
        )
      : deckCards
    return [...list].sort((a, b) => b.createdAt - a.createdAt)
  }, [deckCards, search])

  if (!dataReady) return <Spinner label="Loading deck…" />
  if (!deck)
    return (
      <div className="py-20 text-center text-zinc-500">
        Deck not found. <Link className="text-accent-600 underline" to="/">Back to decks</Link>
      </div>
    )

  const quickAdd = async () => {
    if (!front.trim() || !back.trim()) return
    setAdding(true)
    try {
      await addCard(deck.id, { front, back })
      setFront('')
      setBack('')
    } finally {
      setAdding(false)
    }
  }

  const exportJson = () => {
    const data = {
      deck: deck.name,
      description: deck.description,
      cards: deckCards
        .slice()
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((c) => ({ front: c.front, back: c.back, notes: c.notes || undefined, tags: c.tags.length ? c.tags : undefined })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.name.replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, '-') || 'deck'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fade-up">
      <div className="mb-5">
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <IconBack width={15} height={15} /> Decks
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold tracking-tight">{deck.name}</h1>
            {deck.description && (
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{deck.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {counts && <CountChips {...counts} size="md" />}
            <button className={btnOutline} onClick={() => setShowSettings(true)} title="Deck settings">
              <IconGear width={16} height={16} />
            </button>
            <Link to={`/study/${deck.id}`} className={btnPrimary}>
              <IconPlay width={14} height={14} /> Study
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {!showAdd ? (
          <button
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent-600 hover:text-accent-500 dark:text-accent-400"
            onClick={() => setShowAdd(true)}
          >
            <IconPlus width={16} height={16} /> Add a card
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <textarea
                className={`${inputCls} min-h-16 resize-y`}
                placeholder="Front — e.g. 先生[せんせい]"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                autoFocus
              />
              <textarea
                className={`${inputCls} min-h-16 resize-y`}
                placeholder="Back — e.g. teacher"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) quickAdd()
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-400">Ctrl+Enter to add · supports **bold** and 漢字[ふりがな]</p>
              <div className="flex gap-2">
                <button className="text-sm text-zinc-500 hover:underline" onClick={() => setShowAdd(false)}>
                  Close
                </button>
                <button className={btnPrimary} onClick={quickAdd} disabled={adding || !front.trim() || !back.trim()}>
                  Add card
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <input
          className={inputCls}
          placeholder={`Search ${deckCards.length} card${deckCards.length === 1 ? '' : 's'}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          {deckCards.length === 0 ? 'No cards yet — add one above or import a deck.' : 'No cards match your search.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="min-w-0 flex-1">
                <Rich text={c.front} className="font-medium" />
                <Rich text={c.back} className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400" />
                {c.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <StateChip state={c.state} />
                  <span className="text-xs text-zinc-400 tabular-nums">{c.state === 0 ? '' : humanizeDue(c.due)}</span>
                </div>
                <div className="flex gap-1 opacity-60 transition group-hover:opacity-100">
                  <button
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={() => setEditing(c)}
                    title="Edit"
                  >
                    <IconPencil width={15} height={15} />
                  </button>
                  <button
                    className={`rounded-lg p-1.5 ${
                      confirmDelete === c.id
                        ? 'bg-rose-600 text-white'
                        : 'text-zinc-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10'
                    }`}
                    onClick={() => {
                      if (confirmDelete === c.id) {
                        deleteCard(c.id)
                        setConfirmDelete(null)
                      } else {
                        setConfirmDelete(c.id)
                        setTimeout(() => setConfirmDelete((v) => (v === c.id ? null : v)), 2500)
                      }
                    }}
                    title={confirmDelete === c.id ? 'Click again to delete' : 'Delete'}
                  >
                    <IconTrash width={15} height={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <CardEditor
          card={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            await updateCard(editing.id, data)
          }}
        />
      )}

      {showSettings && (
        <DeckSettings
          deckId={deck.id}
          name={deck.name}
          description={deck.description}
          newPerDay={deck.newPerDay}
          onExport={exportJson}
          onClose={() => setShowSettings(false)}
          onSave={async (patch) => {
            await updateDeck(deck.id, patch)
          }}
          onDelete={async () => {
            await deleteDeck(deck.id)
            navigate('/')
          }}
        />
      )}
    </div>
  )
}

function DeckSettings({
  name,
  description,
  newPerDay,
  onClose,
  onSave,
  onDelete,
  onExport,
}: {
  deckId: string
  name: string
  description: string
  newPerDay: number
  onClose: () => void
  onSave: (patch: { name: string; description: string; newPerDay: number }) => Promise<void>
  onDelete: () => Promise<void>
  onExport: () => void
}) {
  const [n, setN] = useState(name)
  const [d, setD] = useState(description)
  const [npd, setNpd] = useState(String(newPerDay))
  const [armDelete, setArmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <Modal title="Deck settings" onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">Name</span>
          <input className={inputCls} value={n} onChange={(e) => setN(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">Description</span>
          <input className={inputCls} value={d} onChange={(e) => setD(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">New cards per day</span>
          <input
            className={inputCls}
            type="number"
            min={0}
            max={500}
            value={npd}
            onChange={(e) => setNpd(e.target.value)}
          />
        </label>
        <div className="flex items-center justify-between pt-2">
          <button className={btnOutline} onClick={onExport}>
            <IconDownload width={15} height={15} /> Export JSON
          </button>
          <button
            className={btnPrimary}
            disabled={busy || !n.trim()}
            onClick={async () => {
              setBusy(true)
              try {
                await onSave({
                  name: n.trim(),
                  description: d.trim(),
                  newPerDay: Math.max(0, Math.min(500, parseInt(npd, 10) || 0)),
                })
                onClose()
              } finally {
                setBusy(false)
              }
            }}
          >
            Save
          </button>
        </div>
        <div className="mt-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <button
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              armDelete ? 'bg-rose-600 text-white' : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10'
            }`}
            onClick={async () => {
              if (!armDelete) {
                setArmDelete(true)
                setTimeout(() => setArmDelete(false), 3000)
                return
              }
              setBusy(true)
              await onDelete()
            }}
            disabled={busy}
          >
            <IconTrash width={15} height={15} />
            {armDelete ? 'Click again to delete deck + cards' : 'Delete deck'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
