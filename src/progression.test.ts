import { expect, it } from 'vitest'
import { generate } from './engine/generator'
import { mulberry32 } from './engine/rng'
import { countSolutions } from './engine/solver'
import { rate } from './engine/techniques'
import { levelSpec, levelSeed, starsFor } from './progression'

it('every level from 1 to 30 generates a unique puzzle of the right tier', () => {
  let prevTier = 1
  for (let n = 1; n <= 30; n++) {
    const { difficulty, opts } = levelSpec(n)
    expect(difficulty).toBeGreaterThanOrEqual(prevTier)
    prevTier = difficulty
    const p = generate(difficulty, mulberry32(levelSeed(n)), opts)
    const g = [...p.puzzle].map(Number)
    expect(countSolutions(g)).toBe(1)
    expect(rate(g).level).toBe(difficulty)
    if (opts.maxClues) expect(p.clues).toBeLessThanOrEqual(opts.maxClues)
    if (opts.minTierSteps) expect(p.tierSteps).toBeGreaterThanOrEqual(opts.minTierSteps)
  }
}, 120000)

it('easy levels shed clues as they progress', () => {
  const clues = [1, 3, 6].map((n) => generate(1, mulberry32(levelSeed(n)), levelSpec(n).opts).clues)
  expect(clues[0]).toBeGreaterThan(clues[1])
  expect(clues[1]).toBeGreaterThan(clues[2])
})

it('stars', () => {
  expect(starsFor(0, 0)).toBe(3)
  expect(starsFor(1, 1)).toBe(2)
  expect(starsFor(3, 0)).toBe(1)
})
