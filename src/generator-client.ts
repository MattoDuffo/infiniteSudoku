/** Talks to the generator worker and keeps a small pool of ready puzzles per difficulty. */
import type { GenOptions, Puzzle } from './engine/generator'
import { levelSeed, levelSpec } from './progression'
import { store } from './store'

type D = 1 | 2 | 3 | 4
const POOL_SIZE = 3

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (p: Puzzle | null) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const { id, ok, puzzle } = e.data
      pending.get(id)?.(ok ? puzzle : null)
      pending.delete(id)
    }
  }
  return worker
}

export function generateIn(difficulty: D, seed = (Math.random() * 2 ** 32) >>> 0, opts?: GenOptions): Promise<Puzzle | null> {
  return new Promise((resolve) => {
    const id = nextId++
    pending.set(id, resolve)
    getWorker().postMessage({ id, difficulty, seed, opts })
  })
}

let filling = false
export async function fillPool() {
  if (filling) return
  filling = true
  try {
    for (let round = 0; round < POOL_SIZE; round++) {
      for (const d of [1, 2, 3, 4] as D[]) {
        const pool = store.pool()
        if ((pool[d]?.length ?? 0) > round) continue
        const p = await generateIn(d)
        if (!p) continue
        const latest = store.pool()
        latest[d] = [...(latest[d] ?? []), p].slice(0, POOL_SIZE)
        store.savePool(latest)
      }
    }
  } finally { filling = false }
}

/** Returns a puzzle instantly from the pool when possible. */
export async function takePuzzle(d: D): Promise<Puzzle | null> {
  const pool = store.pool()
  const list = pool[d] ?? []
  if (list.length) {
    const [p, ...rest] = list
    pool[d] = rest
    store.savePool(pool)
    setTimeout(fillPool, 500)
    return p
  }
  const p = await generateIn(d)
  setTimeout(fillPool, 500)
  return p
}

/** Puzzle for a progressive level: from the prefetch cache when available. */
export async function levelPuzzle(level: number): Promise<Puzzle | null> {
  const cached = store.levelCache()
  if (cached?.level === level) return cached.puzzle
  const { difficulty, opts } = levelSpec(level)
  return generateIn(difficulty, levelSeed(level), opts)
}

/** Generates the next level in the background so it's ready the moment you win. */
export async function prefetchLevel(level: number) {
  if (store.levelCache()?.level === level) return
  const { difficulty, opts } = levelSpec(level)
  const p = await generateIn(difficulty, levelSeed(level), opts)
  if (p) store.saveLevelCache({ level, puzzle: p })
}
