/**
 * Progressive mode: an endless ladder of levels that ramps smoothly from very gentle Easy
 * puzzles up to dense Expert ones. Each level maps to a difficulty tier plus finer
 * generator constraints (clue count for Easy, number of tier-level steps for the rest).
 */
import type { GenOptions } from './engine/generator'
import { hashString } from './engine/rng'

export interface LevelSpec { difficulty: 1 | 2 | 3 | 4; opts: GenOptions }

/** Level number where each tier begins. */
export const TIER_START = { 1: 1, 2: 7, 3: 15, 4: 23 } as const

export function levelSpec(n: number): LevelSpec {
  if (n < TIER_START[2]) return { difficulty: 1, opts: { minClues: 44 - 2 * n } } // 42 → 32 clues
  if (n < TIER_START[3]) {
    const k = n - TIER_START[2] // 0..7
    return { difficulty: 2, opts: { minTierSteps: 1 + Math.floor(k / 2), minClues: 30 - Math.floor(k / 2) } }
  }
  if (n < TIER_START[4]) {
    // Hard puzzles rarely need more than one hard step, so ramp by clue count instead.
    const k = n - TIER_START[3] // 0..7
    return { difficulty: 3, opts: { maxClues: [34, 32, 31, 30, 29, 28, 27, 27][k] } }
  }
  const k = n - TIER_START[4]
  return { difficulty: 4, opts: { minTierSteps: Math.min(1 + Math.floor(k / 3), 4) } }
}

/** Seed per level so a level is the same puzzle until it's solved (replays stay stable). */
export const levelSeed = (n: number, attempt = 0) => hashString(`infinite-sudoku-level:${n}:${attempt}`)

export function starsFor(hints: number, mistakes: number): 1 | 2 | 3 {
  if (!hints && !mistakes) return 3
  if (hints + mistakes <= 2) return 2
  return 1
}

/** 0..1 position of a level within its tier, for progress bars. */
export function tierProgress(n: number): number {
  const { difficulty } = levelSpec(n)
  if (difficulty === 4) return 1
  const start = TIER_START[difficulty]
  const end = TIER_START[(difficulty + 1) as 2 | 3 | 4]
  return (n - start) / (end - start)
}
