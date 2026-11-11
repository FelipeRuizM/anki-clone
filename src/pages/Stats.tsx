import { useEffect, useMemo, useRef, useState } from 'react'
import { Spinner } from '../components/ui'
import { dateKey } from '../lib/queue'
import { useStore } from '../lib/store'
import type { DailyAgg } from '../lib/types'

/* Palettes validated with the dataviz six-check validator (light + dark). */
const RATING_COLORS = {
  light: { again: '#f43f5e', hard: '#f59e0b', good: '#10b981', easy: '#0ea5e9' },
  dark: { again: '#e11d48', hard: '#d97706', good: '#059669', easy: '#0284c7' },
}
const STATE_COLORS = {
  light: { newC: '#0ea5e9', learning: '#f59e0b', young: '#10b981', mature: '#6366f1' },
  dark: { newC: '#0284c7', learning: '#d97706', young: '#059669', mature: '#6366f1' },
}
const HEAT = {
  light: ['#e0e7ff', '#a5b4fc', '#6366f1', '#4338ca'],
  dark: ['#312e81', '#4338ca', '#6366f1', '#a5b4fc'],
}

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const fmtDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function Stats() {
  const { daily, cards, decks, dataReady } = useStore()
  const dark = useIsDark()
  const rc = RATING_COLORS[dark ? 'dark' : 'light']
  const sc = STATE_COLORS[dark ? 'dark' : 'light']
  const heat = HEAT[dark ? 'dark' : 'light']

  const today = dateKey()

  const { streak, reviewsToday, minutesToday, retention30 } = useMemo(() => {
    const t = new Date()
    let s = 0
    let cursor = (daily[dateKey(t)]?.total ?? 0) > 0 ? t : addDays(t, -1)
    while ((daily[dateKey(cursor)]?.total ?? 0) > 0) {
      s++
      cursor = addDays(cursor, -1)
    }
    const todayAgg = daily[today] ?? {}
    let total30 = 0
    let again30 = 0
    for (let i = 0; i < 30; i++) {
      const agg = daily[dateKey(addDays(t, -i))]
      if (agg) {
        total30 += agg.total ?? 0
        again30 += agg.again ?? 0
      }
    }
    return {
      streak: s,
      reviewsToday: todayAgg.total ?? 0,
      minutesToday: Math.round((todayAgg.timeMs ?? 0) / 60000),
      retention30: total30 > 0 ? Math.round(((total30 - again30) / total30) * 100) : null,
    }
  }, [daily, today])

  // Heatmap: last 52 weeks in week columns, Monday first.
  const heatmap = useMemo(() => {
    const end = new Date()
    const endDow = (end.getDay() + 6) % 7 // Mon=0
    const weeks: { key: string; count: number; date: Date }[][] = []
    let day = addDays(end, -(51 * 7 + endDow)) // Monday 51 weeks ago
    for (let w = 0; w < 52; w++) {
      const col: { key: string; count: number; date: Date }[] = []
      for (let i = 0; i < 7; i++) {
        if (day > end) break
        const key = dateKey(day)
        col.push({ key, count: daily[key]?.total ?? 0, date: new Date(day) })
        day = addDays(day, 1)
      }
      weeks.push(col)
    }
    const max = Math.max(1, ...weeks.flat().map((c) => c.count))
    return { weeks, max }
  }, [daily])

  // Answer mix, last 30 days.
  const mix = useMemo(() => {
    const t = new Date()
    const days: { key: string; date: Date; agg: DailyAgg }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = addDays(t, -i)
      days.push({ key: dateKey(d), date: d, agg: daily[dateKey(d)] ?? {} })
    }
    const max = Math.max(1, ...days.map((d) => d.agg.total ?? 0))
    const totals = { again: 0, hard: 0, good: 0, easy: 0 }
    for (const d of days) {
      totals.again += d.agg.again ?? 0
      totals.hard += d.agg.hard ?? 0
      totals.good += d.agg.good ?? 0
      totals.easy += d.agg.easy ?? 0
    }
    return { days, max, totals }
  }, [daily])

  // Due forecast, next 30 days (overdue counts as today).
  const forecast = useMemo(() => {
    const t = new Date()
    const counts = new Map<string, number>()
    for (let i = 0; i < 30; i++) counts.set(dateKey(addDays(t, i)), 0)
    for (const c of cards) {
      if (c.state === 0) continue
      const dueDate = c.due <= Date.now() ? t : new Date(c.due)
      const key = dateKey(dueDate)
      if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const days = [...counts.entries()].map(([key, count], i) => ({
      key,
      count,
      date: addDays(t, i),
    }))
    const max = Math.max(1, ...days.map((d) => d.count))
    return { days, max }
  }, [cards])

  const states = useMemo(() => {
    let newC = 0
    let learning = 0
    let young = 0
    let mature = 0
    for (const c of cards) {
      if (c.state === 0) newC++
      else if (c.state === 1 || c.state === 3) learning++
      else if (c.scheduled_days >= 21) mature++
      else young++
    }
    return { newC, learning, young, mature, total: cards.length }
  }, [cards])

  const allTime = useMemo(() => {
    let reviews = 0
    let ms = 0
    for (const agg of Object.values(daily)) {
      reviews += agg.total ?? 0
      ms += agg.timeMs ?? 0
    }
    return { reviews, hours: ms / 3600000 }
  }, [daily])

  const heatRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (heatRef.current) heatRef.current.scrollLeft = heatRef.current.scrollWidth
  }, [dataReady])

  if (!dataReady) return <Spinner label="Crunching your numbers…" />

  const heatColor = (count: number) => {
    if (count === 0) return dark ? '#27272a' : '#f1f1f0'
    const q = count / heatmap.max
    return heat[q <= 0.25 ? 0 : q <= 0.5 ? 1 : q <= 0.75 ? 2 : 3]
  }

  const card = 'rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900'

  return (
    <div className="fade-up space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Stats</h1>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Reviews today" value={String(reviewsToday)} sub={minutesToday > 0 ? `${minutesToday} min` : undefined} />
        <StatTile label="Day streak" value={String(streak)} sub={streak > 0 ? 'keep it alive 🔥' : 'study to start one'} />
        <StatTile label="Retention (30d)" value={retention30 != null ? `${retention30}%` : '—'} sub="answers you remembered" />
        <StatTile label="All-time reviews" value={allTime.reviews.toLocaleString()} sub={allTime.hours >= 1 ? `${allTime.hours.toFixed(1)} h total` : undefined} />
      </div>

      {/* Heatmap */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Review activity — last 12 months</h2>
        <div ref={heatRef} className="overflow-x-auto pb-1">
          <div className="flex gap-[3px]" style={{ width: 'max-content' }}>
            {heatmap.weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((cell) => (
                  <div
                    key={cell.key}
                    className="h-[11px] w-[11px] rounded-[3px]"
                    style={{ background: heatColor(cell.count) }}
                    title={`${fmtDay(cell.date)}: ${cell.count} review${cell.count === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-zinc-400">
          less
          {[dark ? '#27272a' : '#f1f1f0', ...heat].map((c) => (
            <span key={c} className="h-[10px] w-[10px] rounded-[3px]" style={{ background: c }} />
          ))}
          more
        </div>
      </section>

      {/* Answer mix */}
      <section className={card}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Answers — last 30 days</h2>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
          {(['again', 'hard', 'good', 'easy'] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: rc[k] }} />
              {k[0].toUpperCase() + k.slice(1)}
              <span className="text-zinc-400 tabular-nums">{mix.totals[k].toLocaleString()}</span>
            </span>
          ))}
        </div>
        <div className="flex h-28 items-end gap-[2px]">
          {mix.days.map((d) => {
            const total = d.agg.total ?? 0
            const h = (v: number) => (total === 0 ? 0 : Math.round((v / mix.max) * 104))
            return (
              <div
                key={d.key}
                className="flex min-w-[4px] flex-1 flex-col-reverse overflow-hidden rounded-t-[4px]"
                title={`${fmtDay(d.date)}: ${total} answers`}
              >
                {(['again', 'hard', 'good', 'easy'] as const).map((k) => {
                  const v = d.agg[k === 'again' ? 'again' : k] ?? 0
                  return v > 0 ? (
                    <div key={k} style={{ height: h(v), background: rc[k], marginTop: 1 }} />
                  ) : null
                })}
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
          <span>{fmtDay(mix.days[0].date)}</span>
          <span>today</span>
        </div>
      </section>

      {/* Forecast */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Due forecast — next 30 days
        </h2>
        <div className="flex h-24 items-end gap-[2px]">
          {forecast.days.map((d) => (
            <div
              key={d.key}
              className="relative flex min-w-[4px] flex-1 flex-col justify-end"
              title={`${fmtDay(d.date)}: ${d.count} due`}
            >
              {d.count === forecast.max && d.count > 0 && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-zinc-500 tabular-nums">
                  {d.count}
                </span>
              )}
              <div
                className="rounded-t-[4px]"
                style={{
                  height: Math.round((d.count / forecast.max) * 88),
                  background: dark ? '#818cf8' : '#6366f1',
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
          <span>today</span>
          <span>{fmtDay(forecast.days[29].date)}</span>
        </div>
      </section>

      {/* Collection */}
      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
          Collection — {states.total.toLocaleString()} cards in {decks.length} deck{decks.length === 1 ? '' : 's'}
        </h2>
        {states.total > 0 && (
          <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
            {(
              [
                ['newC', states.newC],
                ['learning', states.learning],
                ['young', states.young],
                ['mature', states.mature],
              ] as const
            ).map(([k, v]) =>
              v > 0 ? (
                <div
                  key={k}
                  style={{ width: `${(v / states.total) * 100}%`, background: sc[k] }}
                  title={`${v} cards`}
                />
              ) : null,
            )}
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
          {(
            [
              ['newC', 'New', states.newC],
              ['learning', 'Learning', states.learning],
              ['young', 'Young', states.young],
              ['mature', 'Mature (21d+)', states.mature],
            ] as const
          ).map(([k, label, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: sc[k] }} />
              {label} <span className="text-zinc-400 tabular-nums">{v.toLocaleString()}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  )
}
