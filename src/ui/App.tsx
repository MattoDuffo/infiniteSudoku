import { useEffect, useRef, useState } from 'preact/hooks'
import { countSolutions, solve } from '../engine/solver'
import { parseGrid, gridToString, isConsistent } from '../engine/grid'
import { rate } from '../engine/techniques'
import { fillPool, generateIn, takePuzzle } from '../generator-client'
import { newGame, type Difficulty, type Game } from '../game'
import { setHaptics } from '../haptics'
import { dailyDifficulty, dailySeed, dateKey, store, type Settings } from '../store'
import { DailyScreen } from './Daily'
import { GameScreen } from './GameScreen'
import { Home } from './Home'
import { ImportScreen } from './Import'
import { Learn } from './Learn'
import { SettingsScreen } from './SettingsScreen'
import { StatsScreen } from './Stats'

export type Screen = 'home' | 'game' | 'stats' | 'settings' | 'learn' | 'daily' | 'import'

function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141517' : '#f5f3ee')
}

/** Validates a user-supplied puzzle and turns it into a game, or returns an error message. */
export function customGame(text: string): Game | string {
  const g = parseGrid(text)
  if (!g) return 'A puzzle needs exactly 81 digits (use 0 or . for blanks).'
  if (!isConsistent(g)) return 'That puzzle repeats a digit in a row, column or box.'
  const n = countSolutions(g, 2)
  if (n === 0) return 'That puzzle has no solution.'
  if (n > 1) return 'That puzzle has more than one solution, so it can’t be solved by logic alone.'
  const r = rate(g)
  const difficulty = (r.solved ? r.level : 5) as Difficulty
  return newGame({ puzzle: gridToString(g), solution: gridToString(solve(g)!), difficulty, kind: 'custom' })
}

export function App() {
  const [settings, setSettings] = useState<Settings>(store.settings)
  const [screen, setScreen] = useState<Screen>('home')
  const [game, setGame] = useState<Game | null>(() => {
    const id = store.currentId()
    return id ? store.games()[id] ?? null : null
  })
  const [loading, setLoading] = useState<string | null>(null)
  const [, force] = useState(0)
  const saveTimer = useRef<number>(0)
  const latest = useRef<Game | null>(game)

  useEffect(() => {
    applyTheme(settings.theme)
    setHaptics(settings.haptics)
    store.saveSettings(settings)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const h = () => applyTheme(settings.theme)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [settings])

  useEffect(() => {
    setTimeout(fillPool, 1200)
    // Shared puzzle link: #p=<81 digits>
    const m = location.hash.match(/p=([0-9.]{81})/)
    if (m) {
      history.replaceState(null, '', location.pathname)
      const g = customGame(m[1])
      if (typeof g !== 'string') startGame(g)
    }
    const flush = () => { if (document.hidden && latest.current && !latest.current.completed) store.saveGame(latest.current) }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush) }
  }, [])

  const updateGame = (g: Game) => {
    latest.current = g
    setGame(g)
    if (g.completed) return
    clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => store.saveGame(g), 400)
  }

  const startGame = (g: Game) => {
    store.saveGame(g)
    store.setCurrent(g.id)
    latest.current = g
    setGame(g)
    setScreen('game')
  }

  const unfinished = (): Game[] => Object.values(store.games()).filter((g) => !g.completed).sort((a, b) => b.created - a.created)

  const newRandom = async (d: Difficulty) => {
    const level = (d === 5 ? 4 : d) as 1 | 2 | 3 | 4
    const prev = unfinished().find((g) => g.kind === 'random')
    if (prev) {
      if (!confirm('You have a game in progress. Abandon it and start a new one?')) return
      store.recordAbandon(prev)
    }
    setLoading('Creating puzzle…')
    const p = await takePuzzle(level)
    setLoading(null)
    if (!p) return alert('Something went wrong creating a puzzle. Please try again.')
    startGame(newGame({ ...p, difficulty: level, kind: 'random' }))
  }

  const openDaily = async (date: string) => {
    const id = `daily-${date}`
    const existing = store.games()[id]
    if (existing) return startGame(existing)
    if (store.daily()[date]) return
    setLoading('Preparing daily puzzle…')
    const d = dailyDifficulty(date)
    const p = await generateIn(d, dailySeed(date))
    setLoading(null)
    if (!p) return alert('Something went wrong. Please try again.')
    startGame(newGame({ ...p, difficulty: d, kind: 'daily', date, id }))
  }

  const onWin = (g: Game) => {
    clearTimeout(saveTimer.current)
    const res = store.recordWin(g)
    store.setCurrent(null)
    return res
  }

  const goHome = () => {
    if (latest.current && !latest.current.completed) store.saveGame(latest.current)
    if (game?.completed) setGame(null)
    setScreen('home')
    force((x) => x + 1)
  }

  let body
  if (screen === 'game' && game) {
    body = <GameScreen key={game.id} game={game} settings={settings} onChange={updateGame} onWin={onWin} onHome={goHome} onNewGame={newRandom} />
  } else if (screen === 'stats') body = <StatsScreen onBack={goHome} />
  else if (screen === 'settings') body = <SettingsScreen settings={settings} onChange={setSettings} onBack={goHome} />
  else if (screen === 'learn') body = <Learn onBack={goHome} />
  else if (screen === 'daily') body = <DailyScreen onBack={goHome} onPlay={openDaily} />
  else if (screen === 'import') body = <ImportScreen onBack={goHome} onStart={startGame} />
  else {
    body = <Home games={unfinished()} onContinue={startGame} onNew={newRandom} onDaily={() => openDaily(dateKey())}
      onNavigate={setScreen} />
  }

  return (
    <>
      {body}
      {loading && <div class="loading"><div class="spinner" /><span>{loading}</span></div>}
    </>
  )
}
