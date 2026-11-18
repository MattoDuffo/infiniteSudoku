/** Fast brute-force solver (bitmask backtracking with MRV) used for uniqueness checks and generation. */
import { box, col, row, POPCOUNT } from './grid'
import type { Rng } from './rng'

interface Ctx {
  g: Uint8Array
  rows: Uint16Array
  cols: Uint16Array
  boxes: Uint16Array
}

function makeCtx(grid: ArrayLike<number>): Ctx | null {
  const g = new Uint8Array(81)
  const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9)
  for (let i = 0; i < 81; i++) {
    const v = grid[i]
    if (!v) continue
    const b = 1 << (v - 1)
    const r = row(i), c = col(i), x = box(i)
    if ((rows[r] | cols[c] | boxes[x]) & b) return null
    g[i] = v
    rows[r] |= b; cols[c] |= b; boxes[x] |= b
  }
  return { g, rows, cols, boxes }
}

const ROW = Array.from({ length: 81 }, (_, i) => row(i))
const COL = Array.from({ length: 81 }, (_, i) => col(i))
const BOX = Array.from({ length: 81 }, (_, i) => box(i))

function search(ctx: Ctx, limit: number, found: { n: number; first: Uint8Array | null }, rng?: Rng): void {
  const { g, rows, cols, boxes } = ctx
  let best = -1, bestMask = 0, bestCount = 10
  for (let i = 0; i < 81; i++) {
    if (g[i]) continue
    const m = ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & 0x1ff
    const n = POPCOUNT[m]
    if (n < bestCount) {
      best = i; bestMask = m; bestCount = n
      if (n <= 1) break
    }
  }
  if (best < 0) {
    found.n++
    if (!found.first) found.first = g.slice()
    return
  }
  if (bestCount === 0) return
  const r = ROW[best], c = COL[best], x = BOX[best]
  const digits: number[] = []
  for (let d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d)
  if (rng) for (let k = digits.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1))
    ;[digits[k], digits[j]] = [digits[j], digits[k]]
  }
  for (const d of digits) {
    const b = 1 << (d - 1)
    g[best] = d; rows[r] |= b; cols[c] |= b; boxes[x] |= b
    search(ctx, limit, found, rng)
    g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[x] &= ~b
    if (found.n >= limit) return
  }
}

/** Counts solutions, stopping at `limit`. */
export function countSolutions(grid: ArrayLike<number>, limit = 2): number {
  const ctx = makeCtx(grid)
  if (!ctx) return 0
  const found = { n: 0, first: null as Uint8Array | null }
  search(ctx, limit, found)
  return found.n
}

export function solve(grid: ArrayLike<number>): number[] | null {
  const ctx = makeCtx(grid)
  if (!ctx) return null
  const found = { n: 0, first: null as Uint8Array | null }
  search(ctx, 1, found)
  return found.first ? Array.from(found.first) : null
}

export function randomSolution(rng: Rng): number[] {
  const ctx = makeCtx(new Array(81).fill(0))!
  const found = { n: 0, first: null as Uint8Array | null }
  search(ctx, 1, found, rng)
  return Array.from(found.first!)
}
