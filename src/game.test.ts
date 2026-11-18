import { describe, expect, it } from 'vitest'
import { generate } from './engine/generator'
import { mulberry32 } from './engine/rng'
import { applyHint, erase, fillNotes, getHint, input, isSolved, newGame, redo, undo } from './game'

const opt = { autoRemoveNotes: true, countMistakes: true }

describe('game', () => {
  it('can be solved entirely by following hints, with and without notes', () => {
    for (const [k, withNotes] of [[1, false], [2, true], [3, true], [4, false]] as const) {
      const p = generate(k as 1 | 2 | 3 | 4, mulberry32(99 + k))
      let g = newGame({ ...p, difficulty: k as 1, kind: 'random' })
      if (withNotes) g = fillNotes(g)
      for (let n = 0; n < 400 && !isSolved(g); n++) {
        const h = getHint(g)
        expect(h.kind).toBe('step')
        g = applyHint(g, h, opt)
      }
      expect(isSolved(g)).toBe(true)
    }
  })

  it('reports mistakes before anything else and undo/redo round-trips', () => {
    const p = generate(1, mulberry32(5))
    let g = newGame({ ...p, difficulty: 1, kind: 'random' })
    const cell = g.values.findIndex((v) => !v)
    const wrong = (Number(p.solution[cell]) % 9) + 1
    g = input(g, [cell], wrong, 'pen', opt)
    expect(g.mistakes).toBe(1)
    expect(getHint(g)).toEqual({ kind: 'mistake', cells: [cell] })
    const u = undo(g)
    expect(u.values[cell]).toBe(0)
    expect(redo(u).values[cell]).toBe(wrong)
    expect(erase(g, [cell]).values[cell]).toBe(0)
  })

  it('notes toggle and are cleared from peers when placing', () => {
    const p = generate(1, mulberry32(6))
    let g = newGame({ ...p, difficulty: 1, kind: 'random' })
    const empties = g.values.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
    const [a] = empties
    const b = empties.find((i) => i !== a && Math.floor(i / 9) === Math.floor(a / 9))!
    const d = Number(p.solution[a])
    g = input(g, [b], d, 'notes', opt)
    expect(g.notes[b] & (1 << (d - 1))).toBeTruthy()
    g = input(g, [a], d, 'pen', opt)
    expect(g.notes[b] & (1 << (d - 1))).toBe(0)
  })
})
