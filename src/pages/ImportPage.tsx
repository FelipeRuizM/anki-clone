import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Rich from '../components/Rich'
import { IconUpload } from '../components/icons'
import { btnOutline, btnPrimary, inputCls } from '../components/ui'
import { useStore } from '../lib/store'
import type { NewCardInput } from '../lib/types'

interface Parsed {
  deckName?: string
  description?: string
  cards: NewCardInput[]
  error?: string
}

function parseInput(raw: string): Parsed {
  const text = raw.trim()
  if (!text) return { cards: [] }
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const data = JSON.parse(text)
      const obj = Array.isArray(data) ? { cards: data } : data
      const cards = (obj.cards ?? []) as NewCardInput[]
      const valid = cards.filter(
        (c) => c && typeof c.front === 'string' && typeof c.back === 'string',
      )
      if (valid.length === 0) return { cards: [], error: 'JSON parsed, but no {front, back} cards found.' }
      return { deckName: obj.deck, description: obj.description, cards: valid }
    } catch (e) {
      return { cards: [], error: `Invalid JSON: ${(e as Error).message}` }
    }
  }
  const cards: NewCardInput[] = []
  for (const line of text.split('\n')) {
    const l = line.trim()
    if (!l) continue
    let front = ''
    let back = ''
    if (l.includes('\t')) {
      const [f, ...rest] = l.split('\t')
      front = f
      back = rest.join(' ').trim()
    } else if (l.includes(' :: ')) {
      const i = l.indexOf(' :: ')
      front = l.slice(0, i)
      back = l.slice(i + 4)
    } else if (l.includes(',')) {
      const i = l.indexOf(',')
      front = l.slice(0, i)
      back = l.slice(i + 1)
    }
    if (front.trim() && back.trim()) cards.push({ front: front.trim(), back: back.trim() })
  }
  if (cards.length === 0)
    return { cards: [], error: 'No cards recognized. Use JSON, or one card per line: front ⇥ back, "front :: back", or "front, back".' }
  return { cards }
}

export default function ImportPage() {
  const { decks, importDeck } = useStore()
  const [text, setText] = useState('')
  const [target, setTarget] = useState<'new' | string>('new')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ deckId: string; added: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => parseInput(text), [text])
  const deckName =
    target === 'new' ? (newName.trim() || parsed.deckName || '').trim() : decks.find((d) => d.id === target)?.name ?? ''
  const canImport = parsed.cards.length > 0 && !!deckName && !busy

  const run = async () => {
    if (!canImport) return
    setBusy(true)
    setResult(null)
    try {
      const res = await importDeck({ deck: deckName, description: parsed.description, cards: parsed.cards })
      setResult(res)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setText(await f.text())
  }

  return (
    <div className="fade-up mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight">Import cards</h1>
      <p className="mt-1 mb-5 text-sm text-zinc-500 dark:text-zinc-400">
        Paste deck JSON (the format Claude generates), or simple lines like{' '}
        <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">front :: back</code>. Duplicate fronts are skipped,
        so re-importing is safe.
      </p>

      <textarea
        className={`${inputCls} min-h-48 font-mono text-xs`}
        placeholder={`{\n  "deck": "JPST 100 — Chapter 4 Vocab",\n  "cards": [\n    { "front": "先生[せんせい]", "back": "teacher" },\n    { "front": "学生[がくせい]", "back": "student" }\n  ]\n}\n\n— or —\n\n先生[せんせい] :: teacher\n学生[がくせい] :: student`}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setResult(null)
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <button className={btnOutline} onClick={() => fileRef.current?.click()}>
          <IconUpload width={15} height={15} /> Load .json file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,.csv,.tsv,application/json,text/plain"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        {parsed.error && text.trim() && <p className="text-xs text-rose-500">{parsed.error}</p>}
        {parsed.cards.length > 0 && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {parsed.cards.length} card{parsed.cards.length === 1 ? '' : 's'} ready
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">Into deck</span>
          <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="new">New deck…</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {target === 'new' && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">New deck name</span>
            <input
              className={inputCls}
              placeholder={parsed.deckName ?? 'Deck name'}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
        )}
      </div>

      {parsed.cards.length > 0 && (
        <div className="mt-4 space-y-1.5 rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          {parsed.cards.slice(0, 3).map((c, i) => (
            <div key={i} className="flex items-baseline gap-2">
              <Rich text={c.front} className="font-medium" />
              <span className="text-zinc-400">→</span>
              <Rich text={c.back} className="text-zinc-500 dark:text-zinc-400" />
            </div>
          ))}
          {parsed.cards.length > 3 && (
            <p className="text-xs text-zinc-400">…and {parsed.cards.length - 3} more</p>
          )}
        </div>
      )}

      <div className="mt-5">
        <button className={`${btnPrimary} w-full`} onClick={run} disabled={!canImport}>
          {busy ? 'Importing…' : deckName ? `Import into “${deckName}”` : 'Import'}
        </button>
      </div>

      {result && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          Added {result.added} card{result.added === 1 ? '' : 's'}
          {result.skipped > 0 && <> · {result.skipped} skipped (duplicates/empty)</>} —{' '}
          <Link to={`/deck/${result.deckId}`} className="underline">
            open deck
          </Link>
        </p>
      )}
    </div>
  )
}
