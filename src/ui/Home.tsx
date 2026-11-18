import { DIFF_NAMES, progress, type Difficulty, type Game } from '../game'
import { dailyDifficulty, dailyStreak, dateKey, formatTime, store } from '../store'
import type { Screen } from './App'
import { IconBook, IconCalendar, IconChart, IconGear, IconImport } from './icons'

interface Props {
  games: Game[]
  onContinue: (g: Game) => void
  onNew: (d: Difficulty) => void
  onDaily: () => void
  onNavigate: (s: Screen) => void
}

export function Home({ games, onContinue, onNew, onDaily, onNavigate }: Props) {
  const today = dateKey()
  const log = store.daily()
  const doneToday = !!log[today]
  const streak = dailyStreak(log)
  const todayDiff = dailyDifficulty(today)

  return (
    <div class="screen home">
      <header class="home-head">
        <h1>Sudoku</h1>
        <p>Endless puzzles. No ads. No lives.</p>
      </header>

      {games.slice(0, 2).map((g) => (
        <button class="card continue" onClick={() => onContinue(g)}>
          <div>
            <span class="eyebrow">Continue</span>
            <strong>{g.kind === 'daily' ? 'Daily puzzle' : DIFF_NAMES[g.difficulty]}</strong>
            <span class="meta">{formatTime(g.elapsed)} · {Math.round(progress(g) * 100)}% done</span>
          </div>
          <div class="progress-ring" style={{ '--p': progress(g) }} />
        </button>
      ))}

      <button class={`card daily ${doneToday ? 'done' : ''}`} onClick={doneToday ? () => onNavigate('daily') : onDaily}>
        <div>
          <span class="eyebrow">Daily puzzle</span>
          <strong>{doneToday ? 'Done for today' : `Today · ${DIFF_NAMES[todayDiff]}`}</strong>
          <span class="meta">{streak ? `${streak}-day streak` : 'Start a streak'}</span>
        </div>
        <span class="daily-date">{new Date().getDate()}</span>
      </button>

      <section class="new-game">
        <h2>New game</h2>
        <div class="diff-grid">
          {([1, 2, 3, 4] as Difficulty[]).map((d) => (
            <button class={`diff diff-${d}`} onClick={() => onNew(d)}>
              <span class="dots">{'●'.repeat(d)}{'○'.repeat(4 - d)}</span>
              {DIFF_NAMES[d]}
            </button>
          ))}
        </div>
      </section>

      <nav class="home-nav">
        <button onClick={() => onNavigate('daily')}><IconCalendar /><span>Dailies</span></button>
        <button onClick={() => onNavigate('stats')}><IconChart /><span>Stats</span></button>
        <button onClick={() => onNavigate('learn')}><IconBook /><span>Learn</span></button>
        <button onClick={() => onNavigate('import')}><IconImport /><span>Enter</span></button>
        <button onClick={() => onNavigate('settings')}><IconGear /><span>Settings</span></button>
      </nav>
    </div>
  )
}
