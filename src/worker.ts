/// <reference lib="webworker" />
import { generate } from './engine/generator'
import { mulberry32 } from './engine/rng'

import type { GenOptions } from './engine/generator'

export interface GenRequest { id: number; difficulty: 1 | 2 | 3 | 4; seed: number; opts?: GenOptions }

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const { id, difficulty, seed, opts } = e.data
  try {
    const p = generate(difficulty, mulberry32(seed), opts)
    ;(self as unknown as Worker).postMessage({ id, ok: true, puzzle: p })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: String(err) })
  }
}
