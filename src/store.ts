/** Local persistence. Everything lives on the device; nothing is sent anywhere. */
import type { Puzzle } from './engine/generator'
import { hashString } from './engine/rng'
import type { Difficulty, Game } from './game'

export interface Settings {
  theme: 'system' | 'light' | 'dark'
  inputOrder: 'cell' | 'digit'
  mistakes: 'off' | 'conflicts' | 'instant'
  autoRemoveNotes: boolean
  highlightPeers: boolean
  highlightSame: boolean
  showRemaining: boolean
  showTimer: boolean
  haptics: boolean
  colourMode: boolean
  cornerMode: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system', inputOrder: 'cell', mistakes: 'conflicts', autoRemoveNotes: true,
  highlightPeers: true, highlightSame: true, showRemaining: true, showTimer: true,
  haptics: true, colourMode: true, cornerMode: false,
}

export interface DiffStats { played: number; won: number; best?: number; total: number; streak: number; bestStreak: number; clean: number }
export type Stats = Record<Difficulty, DiffStats>
export interface HistoryEntry { id: string; difficulty: Difficulty; kind: Game['kind']; date?: string; time: number; hints: number; mistakes: number; finished: number }
/** Daily results, keyed by YYYY-MM-DD. */
export type DailyLog = Record<string, { time: number; hints: number }>

const K = { settings: 'is:settings', games: 'is:games', current: 'is:current', stats: 'is:stats', history: 'is:history', pool: 'is:pool', daily: 'is:daily' }

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full or unavailable */ }
}

const emptyDiff = (): DiffStats => ({ played: 0, won: 0, total: 0, streak: 0, bestStreak: 0, clean: 0 })
const emptyStats = (): Stats => ({ 1: emptyDiff(), 2: emptyDiff(), 3: emptyDiff(), 4: emptyDiff(), 5: emptyDiff() })

export const store = {
  settings: (): Settings => ({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(K.settings, {}) }),
  saveSettings: (s: Settings) => save(K.settings, s),

  games: (): Record<string, Game> => load(K.games, {}),
  saveGame(g: Game) {
    const all = this.games()
    all[g.id] = g
    save(K.games, all)
  },
  deleteGame(id: string) {
    const all = this.games()
    delete all[id]
    save(K.games, all)
  },
  currentId: (): string | null => load(K.current, null),
  setCurrent: (id: string | null) => save(K.current, id),

  stats: (): Stats => ({ ...emptyStats(), ...load<Partial<Stats>>(K.stats, {}) }),
  history: (): HistoryEntry[] => load(K.history, []),
  daily: (): DailyLog => load(K.daily, {}),

  recordWin(g: Game) {
    const stats = this.stats()
    const s = stats[g.difficulty]
    s.played++; s.won++; s.total += g.elapsed
    s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak)
    if (!g.hints && !g.mistakes) s.clean++
    const isBest = s.best !== undefined && g.elapsed < s.best
    if (s.best === undefined || isBest) s.best = g.elapsed
    save(K.stats, stats)
    const hist = this.history()
    hist.unshift({ id: g.id, difficulty: g.difficulty, kind: g.kind, date: g.date, time: g.elapsed, hints: g.hints, mistakes: g.mistakes, finished: Date.now() })
    save(K.history, hist.slice(0, 300))
    if (g.kind === 'daily' && g.date) {
      const d = this.daily()
      d[g.date] = { time: g.elapsed, hints: g.hints }
      save(K.daily, d)
    }
    this.deleteGame(g.id)
    return { isBest, stats: s }
  },
  recordAbandon(g: Game) {
    const stats = this.stats()
    stats[g.difficulty].played++
    stats[g.difficulty].streak = 0
    save(K.stats, stats)
    this.deleteGame(g.id)
  },
  resetStats() { save(K.stats, emptyStats()); save(K.history, []) },

  pool: (): Record<number, Puzzle[]> => load(K.pool, {}),
  savePool: (p: Record<number, Puzzle[]>) => save(K.pool, p),

  exportAll(): string {
    const out: Record<string, unknown> = {}
    for (const [name, key] of Object.entries(K)) out[name] = load(key, null)
    return JSON.stringify({ app: 'infinite-sudoku', version: 1, data: out })
  },
  importAll(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      if (parsed.app !== 'infinite-sudoku') return false
      for (const [name, key] of Object.entries(K)) if (parsed.data[name] != null) save(key, parsed.data[name])
      return true
    } catch { return false }
  },
}

// ---------- dates ----------

export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function parseDateKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Mon Easy, Tue/Wed Medium, Thu/Fri Hard, Sat/Sun Expert. */
export function dailyDifficulty(k: string): 1 | 2 | 3 | 4 {
  return ([4, 1, 2, 2, 3, 3, 4] as const)[parseDateKey(k).getDay()]
}
export const dailySeed = (k: string) => hashString(`infinite-sudoku-daily:${k}`)

export function dailyStreak(log: DailyLog): number {
  const d = new Date()
  if (!log[dateKey(d)]) d.setDate(d.getDate() - 1)
  let n = 0
  while (log[dateKey(d)]) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`
}
