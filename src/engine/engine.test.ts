import { describe, expect, it } from 'vitest'
import { generate, type Difficulty } from './generator'
import { isConsistent, parseGrid } from './grid'
import { mulberry32 } from './rng'
import { countSolutions, solve } from './solver'
import { applyStep, findStep, initState, rate } from './techniques'

const EASY = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'

describe('solver', () => {
  it('solves and counts', () => {
    const g = parseGrid(EASY)!
    const s = solve(g)!
    expect(s.every(Boolean)).toBe(true)
    expect(isConsistent(s)).toBe(true)
    expect(countSolutions(g)).toBe(1)
    expect(countSolutions(new Array(81).fill(0), 2)).toBe(2)
  })
})

describe('human solver', () => {
  it('rates a classic easy puzzle as level 1', () => {
    expect(rate(parseGrid(EASY)!)).toMatchObject({ solved: true, level: 1 })
  })
  it('every step is consistent with the true solution', () => {
    for (const d of [2, 3, 4] as Difficulty[]) {
      for (let k = 0; k < 4; k++) {
        const p = generate(d, mulberry32(1000 * d + k))
        const sol = [...p.solution].map(Number)
        const s = initState([...p.puzzle].map(Number))
        for (;;) {
          const step = findStep(s)
          if (!step) break
          if (step.place) expect(sol[step.place.cell]).toBe(step.place.digit)
          for (const e of step.elims ?? []) expect(sol[e.cell], `${step.tech}`).not.toBe(e.digit)
          applyStep(s, step)
        }
        expect(s.values.join('')).toBe(p.solution)
      }
    }
  })
})

describe('generator', () => {
  for (const d of [1, 2, 3, 4] as Difficulty[]) {
    it(`generates unique, correctly rated level ${d}`, () => {
      const t = performance.now()
      const p = generate(d, mulberry32(42 + d))
      const g = [...p.puzzle].map(Number)
      expect(countSolutions(g)).toBe(1)
      expect(rate(g).level).toBe(d)
      console.log(`level ${d}: ${p.clues} clues, ${(performance.now() - t).toFixed(0)}ms`)
    })
  }
  it('is deterministic for a seed', () => {
    expect(generate(2, mulberry32(7)).puzzle).toBe(generate(2, mulberry32(7)).puzzle)
  })
})
