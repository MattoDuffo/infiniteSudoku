import { gridToString } from './grid'
import { mulberry32, shuffle, type Rng } from './rng'
import { countSolutions, randomSolution } from './solver'
import { rate } from './techniques'

export type Difficulty = 1 | 2 | 3 | 4

export interface Puzzle {
  puzzle: string
  solution: string
  difficulty: Difficulty
  clues: number
  score: number
}

const MIN_CLUES: Record<Difficulty, number> = { 1: 36, 2: 27, 3: 22, 4: 17 }

/**
 * Generates a puzzle with a unique solution whose hardest required technique matches `target`.
 * Clues are removed in rotationally symmetric pairs.
 */
export function generate(target: Difficulty, rng: Rng = mulberry32((Math.random() * 2 ** 32) >>> 0), maxAttempts = 20000): Puzzle {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = randomSolution(rng)
    const g = solution.slice()
    const pairs = shuffle(Array.from({ length: 41 }, (_, i) => i), rng)
    let clues = 81
    for (const i of pairs) {
      if (clues <= MIN_CLUES[target]) break
      const j = 80 - i
      const a = g[i], b = g[j]
      g[i] = 0; g[j] = 0
      const removed = i === j ? 1 : 2
      let ok = countSolutions(g, 2) === 1
      if (ok && target === 1) ok = rate(g, 1).solved
      if (ok) clues -= removed
      else { g[i] = a; g[j] = b }
    }
    let r = rate(g)
    // Too hard (or beyond our techniques)? Add symmetric clues back until it fits.
    if (!r.solved || r.level > target) {
      const empty = shuffle(Array.from({ length: 41 }, (_, i) => i).filter((i) => !g[i]), rng)
      for (const i of empty) {
        g[i] = solution[i]; g[80 - i] = solution[80 - i]
        clues = g.filter(Boolean).length
        r = rate(g)
        if (r.solved && r.level <= target) break
      }
    }
    if (r.solved && r.level === target) {
      return { puzzle: gridToString(g), solution: gridToString(solution), difficulty: target, clues: g.filter(Boolean).length, score: r.score }
    }
  }
  throw new Error('Could not generate puzzle')
}
