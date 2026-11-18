import { useRef } from 'preact/hooks'
import { bit, box, col, HOUSES, PEERS, row } from '../engine/grid'
import { conflictCells, isGiven, solutionAt, type Game } from '../game'
import type { Settings } from '../store'

export interface BoardHighlight {
  houses?: number[]
  cells?: number[]
  /** Cells with a candidate to remove, keyed cell -> digit mask. */
  elims?: Map<number, number>
  target?: { cell: number; digit: number }
  bad?: number[]
}

interface Props {
  game: Game
  settings: Settings
  selected: number[]
  activeDigit: number
  flash: Set<number>
  hint: BoardHighlight | null
  paused: boolean
  onPress: (cell: number, kind: 'start' | 'drag') => void
}

// Snyder corner mark positions (as % of the cell), in fill order.
const CORNER_POS = [[14, 16], [86, 16], [14, 84], [86, 84], [50, 16], [50, 84], [14, 50], [86, 50], [50, 50]]

export function Board({ game, settings, selected, activeDigit, flash, hint, paused, onPress }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const last = useRef(-1)

  const cellAt = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect()
    const c = Math.floor(((x - r.left) / r.width) * 9)
    const rr = Math.floor(((y - r.top) / r.height) * 9)
    if (c < 0 || c > 8 || rr < 0 || rr > 8) return -1
    return rr * 9 + c
  }

  const down = (e: PointerEvent) => {
    e.preventDefault()
    const c = cellAt(e.clientX, e.clientY)
    if (c < 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
    last.current = c
    onPress(c, 'start')
  }
  const move = (e: PointerEvent) => {
    if (!dragging.current) return
    const c = cellAt(e.clientX, e.clientY)
    if (c < 0 || c === last.current) return
    last.current = c
    onPress(c, 'drag')
  }
  const up = () => { dragging.current = false }

  const single = selected.length === 1 ? selected[0] : -1
  const focusDigit = activeDigit || (single >= 0 ? game.values[single] : 0)
  const peers = new Set(single >= 0 && settings.highlightPeers ? PEERS[single] : [])
  const sel = new Set(selected)
  const conflicts = settings.mistakes === 'off' ? new Set<number>() : conflictCells(game.values)
  const hintHouse = new Set(hint?.houses?.flatMap((h) => HOUSES[h]) ?? [])
  const hintCells = new Set(hint?.cells ?? [])
  const bad = new Set(hint?.bad ?? [])

  const cells = []
  for (let b = 0; b < 9; b++) {
    const boxCells = []
    for (const i of HOUSES[18 + b]) {
      const v = game.values[i]
      const given = isGiven(game, i)
      const cls = ['cell']
      if (given) cls.push('given')
      else if (v) cls.push('user')
      if (sel.has(i)) cls.push('sel')
      else if (peers.has(i)) cls.push('peer')
      if (settings.highlightSame && focusDigit && v === focusDigit) cls.push('same')
      if (v && conflicts.has(i)) cls.push('conflict')
      if (v && !given && settings.mistakes === 'instant' && v !== solutionAt(game, i)) cls.push('wrong')
      if (hintHouse.has(i)) cls.push('hint-house')
      if (hintCells.has(i)) cls.push('hint-cell')
      if (bad.has(i)) cls.push('hint-bad')
      if (hint?.target?.cell === i) cls.push('hint-target')
      if (flash.has(i)) cls.push('flash')
      const colour = game.colours[i]
      const elimMask = hint?.elims?.get(i) ?? 0
      let content = null
      if (paused) content = null
      else if (v) content = <span class="digit">{v}</span>
      else if (hint?.target?.cell === i) content = <span class="digit ghost">{hint.target.digit}</span>
      else if (game.notes[i] || elimMask) {
        const notes = game.notes[i] || elimMask
        content = (
          <div class="cands">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
              <span class={`${notes & bit(d) ? '' : 'off'} ${settings.highlightSame && focusDigit === d ? 'hl' : ''} ${elimMask & bit(d) ? 'elim' : ''}`}>{d}</span>
            ))}
          </div>
        )
      }
      const corner = !v && !paused && game.corner[i]
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => game.corner[i] & bit(d)).map((d, k) => (
          <span class={`corner ${focusDigit === d ? 'hl' : ''}`} style={{ left: `${CORNER_POS[k][0]}%`, top: `${CORNER_POS[k][1]}%` }}>{d}</span>
        ))
        : null
      boxCells.push(
        <div class={cls.join(' ')} data-cell={i} data-colour={colour || undefined}
          style={flash.has(i) ? { animationDelay: `${(Math.abs(row(i) - row(selected[0] ?? i)) + Math.abs(col(i) - col(selected[0] ?? i))) * 35}ms` } : undefined}>
          {content}{corner}
        </div>,
      )
    }
    cells.push(<div class="box" data-box={box(HOUSES[18 + b][0])}>{boxCells}</div>)
  }

  return (
    <div class={`board ${paused ? 'paused' : ''}`} ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      role="grid" aria-label="Sudoku board">
      {cells}
    </div>
  )
}
