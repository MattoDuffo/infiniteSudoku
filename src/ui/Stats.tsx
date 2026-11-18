import { useState } from 'preact/hooks'
import { DIFF_NAMES, type Difficulty } from '../game'
import { formatTime, store } from '../store'
import { Page } from './Page'

export function StatsScreen({ onBack }: { onBack: () => void }) {
  const [d, setD] = useState<Difficulty>(1)
  const stats = store.stats()
  const s = stats[d]
  const history = store.history().filter((h) => h.difficulty === d).slice(0, 20)
  const avg = s.won ? s.total / s.won : 0
  const tabs: Difficulty[] = stats[5].played ? [1, 2, 3, 4, 5] : [1, 2, 3, 4]
  return (
    <Page title="Statistics" onBack={onBack}>
      <div class="seg">
        {tabs.map((x) => <button class={x === d ? 'on' : ''} onClick={() => setD(x)}>{DIFF_NAMES[x]}</button>)}
      </div>
      <div class="stat-grid">
        <div class="stat"><strong>{s.won}</strong><span>solved</span></div>
        <div class="stat"><strong>{s.played ? Math.round((s.won / s.played) * 100) : 0}%</strong><span>win rate</span></div>
        <div class="stat"><strong>{s.best !== undefined ? formatTime(s.best) : '–'}</strong><span>best time</span></div>
        <div class="stat"><strong>{s.won ? formatTime(avg) : '–'}</strong><span>average</span></div>
        <div class="stat"><strong>{s.streak}</strong><span>current streak</span></div>
        <div class="stat"><strong>{s.bestStreak}</strong><span>best streak</span></div>
        <div class="stat wide"><strong>{s.clean}</strong><span>solved with no hints or mistakes</span></div>
      </div>
      {history.length > 0 && (
        <>
          <h3 class="section-title">Recent</h3>
          <ul class="history">
            {history.map((h) => (
              <li>
                <span>{new Date(h.finished).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{h.kind === 'daily' ? ' · Daily' : h.kind === 'custom' ? ' · Entered' : ''}</span>
                <span class="muted">{h.hints ? `${h.hints} hint${h.hints > 1 ? 's' : ''}` : ''}</span>
                <strong>{formatTime(h.time)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  )
}
