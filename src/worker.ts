/// <reference lib="webworker" />
import { generate } from './engine/generator'
import { mulberry32 } from './engine/rng'

export interface GenRequest { id: number; difficulty: 1 | 2 | 3 | 4; seed: number }

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const { id, difficulty, seed } = e.data
  try {
    const p = generate(difficulty, mulberry32(seed))
    ;(self as unknown as Worker).postMessage({ id, ok: true, puzzle: p })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, error: String(err) })
  }
}
