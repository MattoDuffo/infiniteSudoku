/** Pure game model: all functions return new Game objects. */
import { bit, CELL_HOUSES, digitsOf, HOUSES, PEERS } from './engine/grid'
import { applyStep, findStep, initState, type Step } from './engine/techniques'

export type Difficulty = 1 | 2 | 3 | 4 | 5
export const DIFF_NAMES: Record<Difficulty, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Expert', 5: 'Extreme' }

export type Mode = 'pen' | 'notes' | 'corner' | 'colour'

export interface Snap { values: number[]; notes: number[]; corner: number[]; colours: number[] }

export interface Game extends Snap {
  id: string
  kind: 'random' | 'daily' | 'custom'
  date?: string
  difficulty: Difficulty
  puzzle: string
  solution: string
  elapsed: number
  mistakes: number
  hints: number
  created: number
  completed?: number
  history: Snap[]
  future: Snap[]
}

export interface InputOptions { autoRemoveNotes: boolean; countMistakes: boolean }

const HISTORY_CAP = 250

export function newGame(p: { puzzle: string; solution: string; difficulty: Difficulty; kind: Game['kind']; date?: string; id?: string }): Game {
  const values = [...p.puzzle].map(Number)
  return {
    id: p.id ?? `${p.kind}-${Date.now().toString(36)}`,
    kind: p.kind, date: p.date, difficulty: p.difficulty,
    puzzle: p.puzzle, solution: p.solution,
    values, notes: new Array(81).fill(0), corner: new Array(81).fill(0), colours: new Array(81).fill(0),
    elapsed: 0, mistakes: 0, hints: 0, created: Date.now(), history: [], future: [],
  }
}

export const isGiven = (g: Game, i: number) => g.puzzle[i] !== '0'
export const solutionAt = (g: Game, i: number) => g.solution.charCodeAt(i) - 48
export const isSolved = (g: Game) => g.values.every((v, i) => v === solutionAt(g, i))

const snap = (g: Game): Snap => ({ values: g.values, notes: g.notes, corner: g.corner, colours: g.colours })

function commit(g: Game, next: Partial<Snap> & Partial<Game>): Game {
  const history = [...g.history, snap(g)]
  if (history.length > HISTORY_CAP) history.shift()
  return { ...g, ...next, history, future: [] }
}

export function undo(g: Game): Game {
  if (!g.history.length) return g
  const prev = g.history[g.history.length - 1]
  return { ...g, ...prev, history: g.history.slice(0, -1), future: [snap(g), ...g.future] }
}

export function redo(g: Game): Game {
  if (!g.future.length) return g
  const [next, ...rest] = g.future
  return { ...g, ...next, history: [...g.history, snap(g)], future: rest }
}

export function input(g: Game, cells: number[], digit: number, mode: Mode, opt: InputOptions): Game {
  if (mode === 'colour') {
    const target = cells
    if (!target.length) return g
    const colours = g.colours.slice()
    const all = target.every((c) => colours[c] === digit)
    for (const c of target) colours[c] = all ? 0 : digit
    return commit(g, { colours })
  }
  const editable = cells.filter((c) => !isGiven(g, c))
  if (!editable.length) return g

  if (mode === 'pen') {
    const values = g.values.slice()
    const notes = g.notes.slice()
    const corner = g.corner.slice()
    const all = editable.every((c) => values[c] === digit)
    let mistakes = g.mistakes
    for (const c of editable) {
      if (all) { values[c] = 0; continue }
      if (values[c] === digit) continue
      values[c] = digit
      if (opt.countMistakes && digit !== solutionAt(g, c)) mistakes++
      if (opt.autoRemoveNotes) for (const p of PEERS[c]) { notes[p] &= ~bit(digit); corner[p] &= ~bit(digit) }
    }
    return commit(g, { values, notes, corner, mistakes })
  }

  const key = mode === 'notes' ? 'notes' : 'corner'
  const arr = g[key].slice()
  const empty = editable.filter((c) => !g.values[c])
  if (!empty.length) return g
  const b = bit(digit)
  const all = empty.every((c) => arr[c] & b)
  let changed = false
  for (const c of empty) {
    if (all) { arr[c] &= ~b; changed = true; continue }
    // Don't pencil a digit that's already placed in a peer: it's never useful.
    if (empty.length > 1 && PEERS[c].some((p) => g.values[p] === digit)) continue
    if (!(arr[c] & b)) { arr[c] |= b; changed = true }
  }
  return changed ? commit(g, { [key]: arr }) : g
}

export function erase(g: Game, cells: number[]): Game {
  const values = g.values.slice(), notes = g.notes.slice(), corner = g.corner.slice(), colours = g.colours.slice()
  let changed = false
  for (const c of cells) {
    if (!isGiven(g, c) && values[c]) { values[c] = 0; changed = true }
    else if (!isGiven(g, c) && (notes[c] || corner[c])) { notes[c] = 0; corner[c] = 0; changed = true }
    else if (colours[c]) { colours[c] = 0; changed = true }
  }
  return changed ? commit(g, { values, notes, corner, colours }) : g
}

export function candidatesFor(values: number[]): number[] {
  return initState(values).cands
}

export function fillNotes(g: Game): Game {
  const cands = candidatesFor(g.values)
  const notes = g.notes.map((n, i) => (g.values[i] ? n : cands[i]))
  return commit(g, { notes })
}

export function wrongCells(g: Game): number[] {
  const out: number[] = []
  for (let i = 0; i < 81; i++) if (g.values[i] && g.values[i] !== solutionAt(g, i)) out.push(i)
  return out
}

export function conflictCells(values: number[]): Set<number> {
  const out = new Set<number>()
  for (const h of HOUSES) {
    const seen = new Map<number, number>()
    for (const i of h) {
      const v = values[i]
      if (!v) continue
      if (seen.has(v)) { out.add(i); out.add(seen.get(v)!) } else seen.set(v, i)
    }
  }
  return out
}

/** Houses (indices) containing cell `i` that are now completely and correctly filled. */
export function completedHouses(g: Game, i: number): number[] {
  return CELL_HOUSES[i].filter((h) => HOUSES[h].every((c) => g.values[c] === solutionAt(g, c)))
}

export function remaining(values: number[]): number[] {
  const r = new Array(10).fill(9)
  for (const v of values) if (v) r[v]--
  return r
}

export function progress(g: Game): number {
  const givens = [...g.puzzle].filter((c) => c !== '0').length
  const filled = g.values.filter((v, i) => v && v === solutionAt(g, i)).length
  return (filled - givens) / (81 - givens)
}

// ---------- hints ----------

export type Hint =
  | { kind: 'mistake'; cells: number[] }
  | { kind: 'badNote'; cells: number[] }
  | { kind: 'step'; step: Step }
  | { kind: 'reveal'; cell: number; digit: number }

export function getHint(g: Game): Hint {
  const wrong = wrongCells(g)
  if (wrong.length) return { kind: 'mistake', cells: wrong }
  const bad: number[] = []
  for (let i = 0; i < 81; i++) {
    if (!g.values[i] && g.notes[i] && !(g.notes[i] & bit(solutionAt(g, i)))) bad.push(i)
  }
  if (bad.length) return { kind: 'badNote', cells: bad }
  // Reason only from placed digits (player notes may be partial), but skip
  // eliminations the player has already made in their notes.
  const s = initState(g.values)
  for (let guard = 0; guard < 500; guard++) {
    const step = findStep(s)
    if (!step) break
    const alreadyDone = !step.place && (step.elims ?? []).every((e) => g.notes[e.cell] && !(g.notes[e.cell] & bit(e.digit)))
    if (!alreadyDone) return { kind: 'step', step }
    applyStep(s, step)
  }
  const cell = g.values.findIndex((v) => !v)
  return { kind: 'reveal', cell, digit: solutionAt(g, cell) }
}

/** Applies a hint's move to the player's grid. */
export function applyHint(g: Game, h: Hint, opt: InputOptions): Game {
  if (h.kind === 'mistake') {
    const values = g.values.slice()
    for (const c of h.cells) values[c] = 0
    return commit(g, { values })
  }
  if (h.kind === 'badNote') {
    const notes = g.notes.slice()
    for (const c of h.cells) notes[c] |= bit(solutionAt(g, c))
    return commit(g, { notes })
  }
  if (h.kind === 'reveal') return input(g, [h.cell], h.digit, 'pen', { ...opt, countMistakes: false })
  const { step } = h
  if (step.place) return input(g, [step.place.cell], step.place.digit, 'pen', { ...opt, countMistakes: false })
  const notes = g.notes.slice()
  const cands = candidatesFor(g.values)
  for (const e of step.elims ?? []) {
    if (!notes[e.cell]) notes[e.cell] = cands[e.cell]
    notes[e.cell] &= ~bit(e.digit)
  }
  return commit(g, { notes })
}

export { digitsOf }
