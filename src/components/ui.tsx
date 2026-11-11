import { useEffect, type ReactNode } from 'react'
import { IconX } from './icons'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-zinc-500">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-accent-500 dark:border-zinc-700 dark:border-t-accent-400" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`fade-up max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-zinc-900 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <IconX width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CountChips({
  newCount,
  learnCount,
  dueCount,
  size = 'sm',
}: {
  newCount: number
  learnCount: number
  dueCount: number
  size?: 'sm' | 'md'
}) {
  const cls = size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-sm'
  return (
    <div className="flex items-center gap-1.5 font-semibold tabular-nums">
      <span className={`${cls} rounded-md bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300`} title="New cards today">
        {newCount}
      </span>
      <span className={`${cls} rounded-md bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`} title="Learning">
        {learnCount}
      </span>
      <span className={`${cls} rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`} title="Due reviews">
        {dueCount}
      </span>
    </div>
  )
}

export const STATE_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: 'New', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  1: { label: 'Learning', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  2: { label: 'Review', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  3: { label: 'Relearning', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
}

export function StateChip({ state }: { state: number }) {
  const s = STATE_LABEL[state] ?? STATE_LABEL[0]
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
}

export const inputCls =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-accent-400'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-500 active:scale-[0.98] disabled:opacity-50'

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'

export const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800'
