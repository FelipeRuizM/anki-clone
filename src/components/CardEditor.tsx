import { useState } from 'react'
import type { CardDoc, NewCardInput } from '../lib/types'
import { Modal, btnPrimary, inputCls } from './ui'

export default function CardEditor({
  card,
  onSave,
  onClose,
  title = 'Edit card',
}: {
  card: Pick<CardDoc, 'front' | 'back' | 'notes' | 'tags'>
  onSave: (data: Required<NewCardInput>) => Promise<void> | void
  onClose: () => void
  title?: string
}) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [notes, setNotes] = useState(card.notes ?? '')
  const [tags, setTags] = useState((card.tags ?? []).join(', '))
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!front.trim() || !back.trim()) return
    setSaving(true)
    try {
      await onSave({
        front: front.trim(),
        back: back.trim(),
        notes: notes.trim(),
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">Front</span>
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={front}
            onChange={(e) => setFront(e.target.value)}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">Back</span>
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={back}
            onChange={(e) => setBack(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">
            Notes <span className="font-normal normal-case">(shown under the answer)</span>
          </span>
          <textarea
            className={`${inputCls} min-h-14 resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-zinc-500 uppercase">
            Tags <span className="font-normal normal-case">(comma-separated)</span>
          </span>
          <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <p className="text-xs text-zinc-500">
          Formatting: **bold**, *italic*, `code`, and furigana like 日本語[にほんご]
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnPrimary} onClick={save} disabled={saving || !front.trim() || !back.trim()}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
