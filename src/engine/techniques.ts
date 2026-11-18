/**
 * Human-style logical solver. Each technique inspects a candidate state and returns
 * the first Step it can find (a placement or a set of eliminations) with an explanation.
 * Used for difficulty grading and for hints.
 */
import { ALL, bit, box, CELL_HOUSES, cellName, col, digitsOf, HOUSES, houseName, PEERS, POPCOUNT, row, sees } from './grid'

export type TechId =
  | 'fullHouse' | 'hiddenSingle' | 'nakedSingle'
  | 'pointing' | 'claiming' | 'nakedPair' | 'hiddenPair'
  | 'nakedTriple' | 'hiddenTriple' | 'xWing' | 'nakedQuad' | 'hiddenQuad'
  | 'skyscraper' | 'twoStringKite' | 'turbotFish' | 'xyWing' | 'xyzWing' | 'swordfish' | 'simpleColouring' | 'jellyfish'

export interface Elim { cell: number; digit: number }

export interface Step {
  tech: TechId
  place?: { cell: number; digit: number }
  elims?: Elim[]
  /** Cells forming the pattern (shown when revealing the hint). */
  cells: number[]
  /** Houses involved (used for "where to look"). */
  houses: number[]
  digits: number[]
  text: string
}

export interface TechInfo { name: string; level: 1 | 2 | 3 | 4; blurb: string }

export const TECH_INFO: Record<TechId, TechInfo> = {
  fullHouse: { name: 'Full House', level: 1, blurb: 'A row, column or box has just one empty cell left, so it takes the one missing digit.' },
  hiddenSingle: { name: 'Hidden Single', level: 1, blurb: 'Within a row, column or box, a digit has only one cell it can go in.' },
  nakedSingle: { name: 'Naked Single', level: 1, blurb: 'A cell sees eight different digits, so only one digit is left for it.' },
  pointing: { name: 'Pointing', level: 2, blurb: 'Inside a box, a digit is confined to one row or column, so it can be removed from the rest of that line.' },
  claiming: { name: 'Claiming', level: 2, blurb: 'Inside a row or column, a digit is confined to one box, so it can be removed from the rest of that box.' },
  nakedPair: { name: 'Naked Pair', level: 2, blurb: 'Two cells in a house share the same two candidates. Those digits must go there, so remove them from the rest of the house.' },
  hiddenPair: { name: 'Hidden Pair', level: 2, blurb: 'Two digits can only go in the same two cells of a house, so those cells cannot hold anything else.' },
  nakedTriple: { name: 'Naked Triple', level: 3, blurb: 'Three cells in a house hold only three digits between them; remove those digits from the rest of the house.' },
  hiddenTriple: { name: 'Hidden Triple', level: 3, blurb: 'Three digits are restricted to the same three cells of a house; those cells can hold nothing else.' },
  xWing: { name: 'X-Wing', level: 3, blurb: 'A digit appears exactly in the same two columns of two rows (or vice versa), forming a rectangle. It can be removed from the rest of those columns.' },
  nakedQuad: { name: 'Naked Quad', level: 3, blurb: 'Four cells in a house hold only four digits between them.' },
  hiddenQuad: { name: 'Hidden Quad', level: 3, blurb: 'Four digits are restricted to the same four cells of a house.' },
  skyscraper: { name: 'Skyscraper', level: 4, blurb: 'Two parallel lines each have a digit in exactly two places, with one end aligned. One of the two other ends must be the digit, so cells seeing both lose it.' },
  twoStringKite: { name: '2-String Kite', level: 4, blurb: 'A row and a column each have a digit in exactly two places, linked through a box. One of the free ends must hold the digit.' },
  turbotFish: { name: 'Turbot Fish', level: 4, blurb: 'Two strong links on one digit joined by a weak link. One of the outer ends must be the digit.' },
  xyWing: { name: 'XY-Wing', level: 4, blurb: 'A pivot cell XY sees two pincers XZ and YZ. Whatever the pivot is, one pincer is Z, so cells seeing both pincers cannot be Z.' },
  xyzWing: { name: 'XYZ-Wing', level: 4, blurb: 'A pivot XYZ sees pincers XZ and YZ. Cells seeing all three cannot be Z.' },
  swordfish: { name: 'Swordfish', level: 4, blurb: 'An X-Wing across three rows and three columns.' },
  simpleColouring: { name: 'Simple Colouring', level: 4, blurb: 'Follow a chain of cells where a digit has only two options, alternating two colours. One colour is all true, so contradictions or shared sightings remove candidates.' },
  jellyfish: { name: 'Jellyfish', level: 4, blurb: 'An X-Wing across four rows and four columns.' },
}

export const LEVEL_NAMES = ['', 'Easy', 'Medium', 'Hard', 'Expert'] as const

/** Mutable solving state. cands[i] is 0 for filled cells. */
export interface SolveState { values: number[]; cands: number[] }

export function initState(values: ArrayLike<number>): SolveState {
  const v = Array.from(values)
  const cands = new Array(81).fill(0)
  for (let i = 0; i < 81; i++) {
    if (v[i]) continue
    let m = ALL
    for (const p of PEERS[i]) if (v[p]) m &= ~bit(v[p])
    cands[i] = m
  }
  return { values: v, cands }
}

export function applyStep(s: SolveState, step: Step): void {
  if (step.place) {
    const { cell, digit } = step.place
    s.values[cell] = digit
    s.cands[cell] = 0
    for (const p of PEERS[cell]) s.cands[p] &= ~bit(digit)
  }
  if (step.elims) for (const e of step.elims) s.cands[e.cell] &= ~bit(e.digit)
}

// ---------- helpers ----------

const list = (cells: number[]) => cells.map(cellName).join(', ')
const dl = (ds: number[]) => ds.join('/')

function positions(s: SolveState, h: number, d: number): number[] {
  const out: number[] = []
  const b = bit(d)
  for (const i of HOUSES[h]) if (s.cands[i] & b) out.push(i)
  return out
}

function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = []
  const cur: T[] = []
  const rec = (start: number) => {
    if (cur.length === k) { out.push(cur.slice()); return }
    for (let i = start; i <= arr.length - (k - cur.length); i++) {
      cur.push(arr[i]); rec(i + 1); cur.pop()
    }
  }
  rec(0)
  return out
}

function dedupeElims(e: Elim[]): Elim[] {
  const seen = new Set<number>()
  return e.filter((x) => {
    const k = x.cell * 10 + x.digit
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---------- singles ----------

function fullHouse(s: SolveState): Step | null {
  for (let h = 0; h < 27; h++) {
    let empty = -1, count = 0, used = 0
    for (const i of HOUSES[h]) {
      if (s.values[i]) used |= bit(s.values[i])
      else { empty = i; count++ }
    }
    if (count === 1) {
      const d = digitsOf(ALL & ~used)[0]
      if (d && s.cands[empty] & bit(d)) {
        return { tech: 'fullHouse', place: { cell: empty, digit: d }, cells: [empty], houses: [h], digits: [d],
          text: `${cellName(empty)} is the last empty cell in ${houseName(h)}, so it must be ${d}.` }
      }
    }
  }
  return null
}

function hiddenSingle(s: SolveState): Step | null {
  // Boxes first: that's how people scan.
  const order = [...Array.from({ length: 9 }, (_, i) => 18 + i), ...Array.from({ length: 18 }, (_, i) => i)]
  for (const h of order) {
    for (let d = 1; d <= 9; d++) {
      const p = positions(s, h, d)
      if (p.length === 1) {
        return { tech: 'hiddenSingle', place: { cell: p[0], digit: d }, cells: p, houses: [h], digits: [d],
          text: `In ${houseName(h)}, ${d} can only go in ${cellName(p[0])}.` }
      }
    }
  }
  return null
}

function nakedSingle(s: SolveState): Step | null {
  for (let i = 0; i < 81; i++) {
    if (!s.values[i] && POPCOUNT[s.cands[i]] === 1) {
      const d = digitsOf(s.cands[i])[0]
      return { tech: 'nakedSingle', place: { cell: i, digit: d }, cells: [i], houses: CELL_HOUSES[i], digits: [d],
        text: `${cellName(i)} already sees every other digit in its row, column and box. Only ${d} is left.` }
    }
  }
  return null
}

// ---------- intersections ----------

function pointing(s: SolveState): Step | null {
  for (let b = 18; b < 27; b++) {
    for (let d = 1; d <= 9; d++) {
      const p = positions(s, b, d)
      if (p.length < 2) continue
      for (const [lineOf, base] of [[row, 0], [col, 9]] as const) {
        const l = lineOf(p[0])
        if (!p.every((c) => lineOf(c) === l)) continue
        const h = base + l
        const elims = HOUSES[h].filter((c) => box(c) !== b - 18 && s.cands[c] & bit(d)).map((cell) => ({ cell, digit: d }))
        if (elims.length) return { tech: 'pointing', elims, cells: p, houses: [b, h], digits: [d],
          text: `In ${houseName(b)}, ${d} can only be in ${houseName(h)}. So ${d} can be removed from the rest of ${houseName(h)}: ${list(elims.map((e) => e.cell))}.` }
      }
    }
  }
  return null
}

function claiming(s: SolveState): Step | null {
  for (let h = 0; h < 18; h++) {
    for (let d = 1; d <= 9; d++) {
      const p = positions(s, h, d)
      if (p.length < 2) continue
      const b = box(p[0])
      if (!p.every((c) => box(c) === b)) continue
      const elims = HOUSES[18 + b].filter((c) => !HOUSES[h].includes(c) && s.cands[c] & bit(d)).map((cell) => ({ cell, digit: d }))
      if (elims.length) return { tech: 'claiming', elims, cells: p, houses: [h, 18 + b], digits: [d],
        text: `In ${houseName(h)}, ${d} can only be inside ${houseName(18 + b)}. So ${d} can be removed from the rest of that box: ${list(elims.map((e) => e.cell))}.` }
    }
  }
  return null
}

// ---------- subsets ----------

const NAKED: Record<number, TechId> = { 2: 'nakedPair', 3: 'nakedTriple', 4: 'nakedQuad' }
const HIDDEN: Record<number, TechId> = { 2: 'hiddenPair', 3: 'hiddenTriple', 4: 'hiddenQuad' }

function nakedSubset(n: number) {
  return (s: SolveState): Step | null => {
    for (let h = 0; h < 27; h++) {
      const cells = HOUSES[h].filter((i) => !s.values[i] && POPCOUNT[s.cands[i]] >= 2 && POPCOUNT[s.cands[i]] <= n)
      if (cells.length < n) continue
      for (const combo of combos(cells, n)) {
        let u = 0
        for (const c of combo) u |= s.cands[c]
        if (POPCOUNT[u] !== n) continue
        const elims: Elim[] = []
        for (const c of HOUSES[h]) {
          if (combo.includes(c) || !(s.cands[c] & u)) continue
          for (const d of digitsOf(s.cands[c] & u)) elims.push({ cell: c, digit: d })
        }
        if (elims.length) {
          const ds = digitsOf(u)
          return { tech: NAKED[n], elims, cells: combo, houses: [h], digits: ds,
            text: `In ${houseName(h)}, the cells ${list(combo)} can only hold ${dl(ds)}. Those digits must go there, so remove them from the other cells of ${houseName(h)}.` }
        }
      }
    }
    return null
  }
}

function hiddenSubset(n: number) {
  return (s: SolveState): Step | null => {
    for (let h = 0; h < 27; h++) {
      const ds: number[] = []
      const posMask: number[] = []
      for (let d = 1; d <= 9; d++) {
        let m = 0
        HOUSES[h].forEach((c, k) => { if (s.cands[c] & bit(d)) m |= 1 << k })
        const pc = POPCOUNT[m]
        if (pc >= 2 && pc <= n) { ds.push(d); posMask[d] = m }
      }
      if (ds.length < n) continue
      for (const combo of combos(ds, n)) {
        let u = 0
        for (const d of combo) u |= posMask[d]
        if (POPCOUNT[u] !== n) continue
        const keep = combo.reduce((m, d) => m | bit(d), 0)
        const cells = HOUSES[h].filter((_, k) => u & (1 << k))
        const elims: Elim[] = []
        for (const c of cells) for (const d of digitsOf(s.cands[c] & ~keep)) elims.push({ cell: c, digit: d })
        if (elims.length) return { tech: HIDDEN[n], elims, cells, houses: [h], digits: combo,
          text: `In ${houseName(h)}, the digits ${dl(combo)} can only go in ${list(cells)}. So those cells can't hold any other digit.` }
      }
    }
    return null
  }
}

// ---------- fish ----------

const FISH: Record<number, TechId> = { 2: 'xWing', 3: 'swordfish', 4: 'jellyfish' }

function fish(n: number) {
  return (s: SolveState): Step | null => {
    for (let d = 1; d <= 9; d++) {
      for (const rowsBase of [true, false]) {
        const bases: { h: number; m: number }[] = []
        for (let k = 0; k < 9; k++) {
          const h = rowsBase ? k : 9 + k
          let m = 0
          for (const c of HOUSES[h]) if (s.cands[c] & bit(d)) m |= 1 << (rowsBase ? col(c) : row(c))
          const pc = POPCOUNT[m]
          if (pc >= 2 && pc <= n) bases.push({ h, m })
        }
        if (bases.length < n) continue
        for (const combo of combos(bases, n)) {
          let u = 0
          for (const b of combo) u |= b.m
          if (POPCOUNT[u] !== n) continue
          const baseSet = new Set(combo.map((b) => b.h))
          const covers: number[] = []
          for (let k = 0; k < 9; k++) if (u & (1 << k)) covers.push(rowsBase ? 9 + k : k)
          const elims: Elim[] = []
          for (const ch of covers) for (const c of HOUSES[ch]) {
            const bh = rowsBase ? row(c) : 9 + col(c)
            if (!baseSet.has(bh) && s.cands[c] & bit(d)) elims.push({ cell: c, digit: d })
          }
          if (elims.length) {
            const cells = combo.flatMap((b) => HOUSES[b.h].filter((c) => s.cands[c] & bit(d)))
            const bn = combo.map((b) => houseName(b.h)).join(', ')
            const cn = covers.map(houseName).join(', ')
            return { tech: FISH[n], elims, cells, houses: [...baseSet, ...covers], digits: [d],
              text: `In ${bn}, ${d} only appears in ${cn}. Every one of those ${rowsBase ? 'rows' : 'columns'} needs a ${d}, and they all have to fall in those ${n} ${rowsBase ? 'columns' : 'rows'}. So ${d} can be removed from the rest of ${cn}.` }
          }
        }
      }
    }
    return null
  }
}

// ---------- single-digit chains ----------

interface Link { a: number; b: number; h: number }

function strongLinks(s: SolveState, d: number): Link[] {
  const out: Link[] = []
  for (let h = 0; h < 27; h++) {
    const p = positions(s, h, d)
    if (p.length === 2) out.push({ a: p[0], b: p[1], h })
  }
  return out
}

function turbot(s: SolveState): Step | null {
  let best: Step | null = null
  const rank: Record<string, number> = { skyscraper: 0, twoStringKite: 1, turbotFish: 2 }
  for (let d = 1; d <= 9; d++) {
    const links = strongLinks(s, d)
    for (let x = 0; x < links.length; x++) for (let y = x + 1; y < links.length; y++) {
      const L1 = links[x], L2 = links[y]
      for (const [a1, a2] of [[L1.a, L1.b], [L1.b, L1.a]]) for (const [b1, b2] of [[L2.a, L2.b], [L2.b, L2.a]]) {
        const four = new Set([a1, a2, b1, b2])
        if (four.size !== 4) continue
        if (!sees(a1, b1)) continue
        const elims: Elim[] = []
        for (let c = 0; c < 81; c++) {
          if (four.has(c) || !(s.cands[c] & bit(d))) continue
          if (sees(c, a2) && sees(c, b2)) elims.push({ cell: c, digit: d })
        }
        if (!elims.length) continue
        const t1 = L1.h < 9 ? 'r' : L1.h < 18 ? 'c' : 'b'
        const t2 = L2.h < 9 ? 'r' : L2.h < 18 ? 'c' : 'b'
        let tech: TechId = 'turbotFish'
        if (t1 === t2 && t1 !== 'b') tech = 'skyscraper'
        else if (((t1 === 'r' && t2 === 'c') || (t1 === 'c' && t2 === 'r')) && box(a1) === box(b1)) tech = 'twoStringKite'
        if (best && rank[best.tech] <= rank[tech]) continue
        const name = TECH_INFO[tech].name
        best = { tech, elims, cells: [a1, a2, b1, b2], houses: [L1.h, L2.h], digits: [d],
          text: `${name} on ${d}: in ${houseName(L1.h)} the ${d} is ${cellName(a1)} or ${cellName(a2)}, and in ${houseName(L2.h)} it is ${cellName(b1)} or ${cellName(b2)}. ${cellName(a1)} and ${cellName(b1)} see each other, so they can't both be ${d}. That means ${cellName(a2)} or ${cellName(b2)} must be ${d}, and any cell seeing both can't be: ${list(elims.map((e) => e.cell))}.` }
        if (tech === 'skyscraper') return best
      }
    }
    if (best) return best
  }
  return best
}

function simpleColouring(s: SolveState): Step | null {
  for (let d = 1; d <= 9; d++) {
    const links = strongLinks(s, d)
    const adj = new Map<number, Set<number>>()
    for (const l of links) {
      if (!adj.has(l.a)) adj.set(l.a, new Set())
      if (!adj.has(l.b)) adj.set(l.b, new Set())
      adj.get(l.a)!.add(l.b); adj.get(l.b)!.add(l.a)
    }
    const colour = new Map<number, number>()
    for (const start of adj.keys()) {
      if (colour.has(start)) continue
      const comp: number[] = []
      const queue = [start]
      colour.set(start, 0)
      while (queue.length) {
        const c = queue.shift()!
        comp.push(c)
        for (const n of adj.get(c)!) if (!colour.has(n)) { colour.set(n, 1 - colour.get(c)!); queue.push(n) }
      }
      if (comp.length < 4) continue
      const A = comp.filter((c) => colour.get(c) === 0)
      const B = comp.filter((c) => colour.get(c) === 1)
      // Colour wrap: two cells of the same colour see each other -> that colour is false.
      for (const [same, other] of [[A, B], [B, A]]) {
        let clash = false
        for (let i = 0; i < same.length && !clash; i++) for (let j = i + 1; j < same.length; j++) if (sees(same[i], same[j])) { clash = true; break }
        if (clash) {
          const elims = same.map((cell) => ({ cell, digit: d }))
          return { tech: 'simpleColouring', elims, cells: comp, houses: [], digits: [d],
            text: `Colour the chain of ${d}s that are the only two options in a house: ${list(same)} share one colour and ${list(other)} the other. Two cells of the first colour see each other, so that colour can't be ${d}. Remove ${d} from ${list(same)}.` }
        }
      }
      // Colour trap: an outside cell sees both colours.
      const elims: Elim[] = []
      for (let c = 0; c < 81; c++) {
        if (colour.has(c) && comp.includes(c)) continue
        if (!(s.cands[c] & bit(d))) continue
        if (A.some((a) => sees(a, c)) && B.some((b) => sees(b, c))) elims.push({ cell: c, digit: d })
      }
      if (elims.length) return { tech: 'simpleColouring', elims, cells: comp, houses: [], digits: [d],
        text: `Colour the chain of ${d}s that are the only two options in a house, alternating between two colours (${list(A)} versus ${list(B)}). One colour holds every ${d}. Cells that see both colours can't be ${d}: ${list(elims.map((e) => e.cell))}.` }
    }
  }
  return null
}

// ---------- wings ----------

function xyWing(s: SolveState): Step | null {
  const bivalue = []
  for (let i = 0; i < 81; i++) if (POPCOUNT[s.cands[i]] === 2) bivalue.push(i)
  for (const p of bivalue) {
    const [x, y] = digitsOf(s.cands[p])
    const wings = bivalue.filter((w) => w !== p && sees(p, w))
    for (const w1 of wings) {
      const m1 = s.cands[w1]
      if (!(m1 & bit(x)) || m1 & bit(y)) continue
      const z = digitsOf(m1 & ~bit(x))[0]
      for (const w2 of wings) {
        if (w2 === w1 || s.cands[w2] !== (bit(y) | bit(z))) continue
        const elims: Elim[] = []
        for (let c = 0; c < 81; c++) if (c !== p && s.cands[c] & bit(z) && sees(c, w1) && sees(c, w2)) elims.push({ cell: c, digit: z })
        if (elims.length) return { tech: 'xyWing', elims, cells: [p, w1, w2], houses: [], digits: [x, y, z],
          text: `${cellName(p)} is ${x} or ${y}. If it's ${x}, then ${cellName(w1)} is ${z}. If it's ${y}, then ${cellName(w2)} is ${z}. Either way one of them is ${z}, so cells seeing both can't be ${z}: ${list(elims.map((e) => e.cell))}.` }
      }
    }
  }
  return null
}

function xyzWing(s: SolveState): Step | null {
  for (let p = 0; p < 81; p++) {
    if (POPCOUNT[s.cands[p]] !== 3) continue
    const pm = s.cands[p]
    const wings = PEERS[p].filter((w) => POPCOUNT[s.cands[w]] === 2 && (s.cands[w] & ~pm) === 0)
    for (let i = 0; i < wings.length; i++) for (let j = i + 1; j < wings.length; j++) {
      const w1 = wings[i], w2 = wings[j]
      if (s.cands[w1] === s.cands[w2]) continue
      const zm = s.cands[w1] & s.cands[w2]
      if (POPCOUNT[zm] !== 1) continue
      const z = digitsOf(zm)[0]
      const elims: Elim[] = []
      for (let c = 0; c < 81; c++) if (c !== p && c !== w1 && c !== w2 && s.cands[c] & zm && sees(c, p) && sees(c, w1) && sees(c, w2)) elims.push({ cell: c, digit: z })
      if (elims.length) return { tech: 'xyzWing', elims, cells: [p, w1, w2], houses: [], digits: digitsOf(pm),
        text: `${cellName(p)} holds ${dl(digitsOf(pm))}, and it sees ${cellName(w1)} (${dl(digitsOf(s.cands[w1]))}) and ${cellName(w2)} (${dl(digitsOf(s.cands[w2]))}). One of those three cells must be ${z}, so a cell that sees all three can't be ${z}: ${list(elims.map((e) => e.cell))}.` }
    }
  }
  return null
}

/** Techniques in the order a person would try them. */
export const TECHNIQUES: [TechId | 'turbot', (s: SolveState) => Step | null][] = [
  ['fullHouse', fullHouse],
  ['hiddenSingle', hiddenSingle],
  ['nakedSingle', nakedSingle],
  ['pointing', pointing],
  ['claiming', claiming],
  ['nakedPair', nakedSubset(2)],
  ['hiddenPair', hiddenSubset(2)],
  ['nakedTriple', nakedSubset(3)],
  ['hiddenTriple', hiddenSubset(3)],
  ['xWing', fish(2)],
  ['nakedQuad', nakedSubset(4)],
  ['hiddenQuad', hiddenSubset(4)],
  ['turbot', turbot],
  ['xyWing', xyWing],
  ['xyzWing', xyzWing],
  ['swordfish', fish(3)],
  ['simpleColouring', simpleColouring],
  ['jellyfish', fish(4)],
]

const TECH_LEVEL = (id: TechId | 'turbot') => (id === 'turbot' ? 4 : TECH_INFO[id].level)

/** Finds the easiest available step, optionally capped at a maximum level. */
export function findStep(s: SolveState, maxLevel = 4): Step | null {
  for (const [id, fn] of TECHNIQUES) {
    if (TECH_LEVEL(id) > maxLevel) break
    const step = fn(s)
    if (step) {
      if (step.elims) step.elims = dedupeElims(step.elims)
      return step
    }
  }
  return null
}

export interface Rating {
  solved: boolean
  level: number
  /** Rough effort score for ordering within a level. */
  score: number
  techs: Partial<Record<TechId, number>>
}

export function rate(values: ArrayLike<number>, maxLevel = 4): Rating {
  const s = initState(values)
  let level = 1, score = 0
  const techs: Partial<Record<TechId, number>> = {}
  for (;;) {
    if (s.values.every((v) => v)) return { solved: true, level, score, techs }
    const step = findStep(s, maxLevel)
    if (!step) return { solved: false, level, score, techs }
    const L = TECH_INFO[step.tech].level
    if (L > level) level = L
    score += L * L
    techs[step.tech] = (techs[step.tech] ?? 0) + 1
    applyStep(s, step)
  }
}
