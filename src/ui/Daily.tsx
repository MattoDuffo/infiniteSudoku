import { useState } from 'preact/hooks'
import { DIFF_NAMES } from '../game'
import { dailyDifficulty, dailyStreak, dateKey, formatTime, store } from '../store'
import { Page } from './Page'

export function DailyScreen({ onBack, onPlay }: { onBack: () => void; onPlay: (date: string) => void }) {
  const now = new Date()
  const [month, setMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const log = store.daily()
  const games = store.games()
  const today = dateKey(now)
  const first = (month.getDay() + 6) % 7 // Monday-first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first; i++) cells.push(<span />)
  for (let d = 1; d <= days; d++) {
    const k = dateKey(new Date(month.getFullYear(), month.getMonth(), d))
    const done = log[k]
    const started = games[`daily-${k}`]
    const future = k > today
    cells.push(
      <button class={`day ${done ? 'done' : ''} ${started ? 'started' : ''} ${k === today ? 'today' : ''}`} disabled={future || !!done}
        onClick={() => onPlay(k)} title={done ? formatTime(done.time) : DIFF_NAMES[dailyDifficulty(k)]}>
        <span>{d}</span>
        {!future && <i class={`dd d${dailyDifficulty(k)}`} />}
      </button>,
    )
  }
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const isCurrent = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth()
  const completedThisMonth = Object.keys(log).filter((k) => k.startsWith(dateKey(month).slice(0, 7))).length
  return (
    <Page title="Daily puzzles" onBack={onBack}>
      <div class="stat-row">
        <div class="stat"><strong>{dailyStreak(log)}</strong><span>day streak</span></div>
        <div class="stat"><strong>{completedThisMonth}</strong><span>this month</span></div>
        <div class="stat"><strong>{Object.keys(log).length}</strong><span>all time</span></div>
      </div>
      <div class="cal-head">
        <button class="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button class="icon-btn" onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month">›</button>
      </div>
      <div class="cal">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => <span class="dow">{d}</span>)}
        {cells}
      </div>
      <p class="note">Monday is Easy, Tuesday and Wednesday are Medium, Thursday and Friday are Hard, and the weekend is Expert. Every past day can still be played.</p>
    </Page>
  )
}
