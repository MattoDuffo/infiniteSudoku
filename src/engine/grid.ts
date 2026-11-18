/** Core grid geometry. Cells are indexed 0..80 row-major. Digits are 1..9, 0 = empty. */

export const row = (i: number) => (i / 9) | 0
export const col = (i: number) => i % 9
export const box = (i: number) => ((row(i) / 3) | 0) * 3 + ((col(i) / 3) | 0)

/** 27 houses: 0-8 rows, 9-17 columns, 18-26 boxes. */
export const HOUSES: number[][] = []
for (let r = 0; r < 9; r++) HOUSES.push(Array.from({ length: 9 }, (_, c) => r * 9 + c))
for (let c = 0; c < 9; c++) HOUSES.push(Array.from({ length: 9 }, (_, r) => r * 9 + c))
for (let b = 0; b < 9; b++) {
  const r0 = ((b / 3) | 0) * 3, c0 = (b % 3) * 3
  const cells: number[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c)
  HOUSES.push(cells)
}

export const CELL_HOUSES: number[][] = Array.from({ length: 81 }, (_, i) => [row(i), 9 + col(i), 18 + box(i)])

export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>()
  for (const h of CELL_HOUSES[i]) for (const j of HOUSES[h]) if (j !== i) s.add(j)
  return [...s].sort((a, b) => a - b)
})

const PEER_SET: Uint8Array[] = PEERS.map((p) => {
  const a = new Uint8Array(81)
  for (const j of p) a[j] = 1
  return a
})
export const sees = (a: number, b: number) => a !== b && PEER_SET[a][b] === 1

export const bit = (d: number) => 1 << (d - 1)
export const ALL = 0x1ff

export const POPCOUNT = new Uint8Array(512)
for (let m = 1; m < 512; m++) POPCOUNT[m] = POPCOUNT[m >> 1] + (m & 1)

export function digitsOf(mask: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d)
  return out
}

export function houseName(h: number): string {
  if (h < 9) return `row ${h + 1}`
  if (h < 18) return `column ${h - 8}`
  return `box ${h - 17}`
}
export const cellName = (i: number) => `R${row(i) + 1}C${col(i) + 1}`

export function parseGrid(s: string): number[] | null {
  const chars = s.replace(/\s+/g, '').replace(/[.\-_*xX]/g, '0')
  if (chars.length !== 81 || /[^0-9]/.test(chars)) return null
  return [...chars].map(Number)
}
export const gridToString = (g: ArrayLike<number>) => Array.from(g).join('')

/** True if no digit repeats within any house. */
export function isConsistent(g: ArrayLike<number>): boolean {
  for (const h of HOUSES) {
    let seen = 0
    for (const i of h) {
      const v = g[i]
      if (!v) continue
      if (seen & bit(v)) return false
      seen |= bit(v)
    }
  }
  return true
}
