import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { bit, HOUSES, houseName } from '../engine/grid'
import { TECH_INFO } from '../engine/techniques'
import {
  applyHint, completedHouses, DIFF_NAMES, erase, fillNotes, getHint, input, isGiven, isSolved, redo, remaining, undo,
  wrongCells, type Game, type Hint, type Mode,
} from '../game'
import { tap } from '../haptics'
import { formatTime, parseDateKey, type Settings } from '../store'
import { Board, type BoardHighlight } from './Board'
import {
  IconBack, IconCheck, IconClose, IconErase, IconFill, IconHint, IconMore, IconPause, IconPlay, IconRedo, IconRestart, IconShare, IconUndo,
} from './icons'

interface Props {
  game: Game
  settings: Settings
  onChange: (g: Game) => void
  onWin: (g: Game) => { isBest: boolean }
  onHome: () => void
  onNewGame: (d: Game['difficulty']) => void
}

interface HintState { hint: Hint; stage: number }

export function GameScreen({ game, settings, onChange, onWin, onHome, onNewGame }: Props) {
  const [selected, setSelected] = useState<number[]>(() => [game.values.findIndex((v) => !v)].filter((x) => x >= 0))
  const [mode, setMode] = useState<Mode>('pen')
  const [activeDigit, setActiveDigit] = useState(0)
  const [hint, setHint] = useState<HintState | null>(null)
  const [flash, setFlash] = useState<Set<number>>(new Set())
  const [paused, setPaused] = useState(false)
  const [menu, setMenu] = useState(false)
  const [checkCells, setCheckCells] = useState<number[] | null>(null)
  const [won, setWon] = useState<{ isBest: boolean; game: Game } | null>(null)
  const [toast, setToast] = useState('')
  const gameRef = useRef(game)
  gameRef.current = game

  const opts = { autoRemoveNotes: settings.autoRemoveNotes, countMistakes: settings.mistakes === 'instant' }
  const digitFirst = settings.inputOrder === 'digit'

  // ----- timer -----
  useEffect(() => {
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const dt = now - last
      last = now
      const g = gameRef.current
      if (paused || won || document.hidden || dt > 5000) return
      onChange({ ...g, elapsed: g.elapsed + dt })
    }, 1000)
    return () => clearInterval(id)
  }, [paused, won])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  // ----- core update -----
  const commit = (next: Game, touched: number[] = []) => {
    if (next === game) return
    setCheckCells(null)
    // Celebrate newly completed rows/columns/boxes.
    const done = new Set<number>()
    for (const c of touched) {
      if (!next.values[c] || next.values[c] === game.values[c]) continue
      const before = new Set(completedHouses(game, c))
      for (const h of completedHouses(next, c)) if (!before.has(h)) for (const x of HOUSES[h]) done.add(x)
    }
    if (isSolved(next)) {
      const final = { ...next, completed: Date.now() }
      setFlash(new Set(Array.from({ length: 81 }, (_, i) => i)))
      const res = onWin(final)
      setTimeout(() => setWon({ ...res, game: final }), 900)
      onChange(final)
      return
    }
    if (done.size) {
      setFlash(done)
      setTimeout(() => setFlash(new Set()), 800)
    }
    onChange(next)
  }

  const applyDigit = (cells: number[], d: number) => {
    if (!cells.length) return
    tap()
    commit(input(game, cells, d, mode, opts), cells)
  }

  const onDigit = (d: number) => {
    if (paused || won) return
    setHint(null)
    if (digitFirst) {
      tap()
      setActiveDigit(activeDigit === d ? 0 : d)
      return
    }
    applyDigit(selected, d)
  }

  const onPress = (cell: number, kind: 'start' | 'drag') => {
    if (paused || won) return
    if (digitFirst && activeDigit) {
      if (kind === 'drag' && mode === 'pen') return
      setSelected([cell])
      if (isGiven(game, cell) && mode !== 'colour') { setActiveDigit(game.values[cell]); return }
      applyDigit([cell], activeDigit)
      return
    }
    if (kind === 'start') {
      setSelected([cell])
      if (digitFirst && game.values[cell]) setActiveDigit(0)
    } else setSelected((s) => (s.includes(cell) ? s : [...s, cell]))
  }

  const onErase = () => {
    if (paused || won) return
    tap()
    commit(erase(game, selected))
  }

  // ----- keyboard (desktop / external keyboards) -----
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z') { e.preventDefault(); commit(e.shiftKey ? redo(game) : undo(game)) }
        return
      }
      const cur = selected[selected.length - 1] ?? 40
      const moveBy = (dr: number, dc: number) => {
        const r = (Math.floor(cur / 9) + dr + 9) % 9, c = ((cur % 9) + dc + 9) % 9
        setSelected([r * 9 + c])
      }
      if (/^[1-9]$/.test(e.key)) onDigit(Number(e.key))
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') onErase()
      else if (e.key === 'ArrowUp') moveBy(-1, 0)
      else if (e.key === 'ArrowDown') moveBy(1, 0)
      else if (e.key === 'ArrowLeft') moveBy(0, -1)
      else if (e.key === 'ArrowRight') moveBy(0, 1)
      else if (e.key === 'n' || e.key === ' ') { e.preventDefault(); setMode(mode === 'pen' ? 'notes' : 'pen') }
      else return
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // ----- hints -----
  const openHint = () => {
    if (paused || won) return
    tap()
    const h = getHint(game)
    setHint({ hint: h, stage: 1 })
    onChange({ ...game, hints: game.hints + 1 })
  }

  const hintHighlight: BoardHighlight | null = useMemo(() => {
    if (checkCells) return { bad: checkCells }
    if (!hint) return null
    const { hint: h, stage } = hint
    if (h.kind === 'mistake' || h.kind === 'badNote') return stage >= 2 ? { bad: h.cells } : null
    if (h.kind === 'reveal') return stage >= 2 ? { target: { cell: h.cell, digit: h.digit } } : null
    const s = h.step
    if (stage === 1) return { houses: s.houses.slice(0, 2) }
    if (stage === 2) return { houses: s.houses.slice(0, 2), cells: s.cells }
    const elims = new Map<number, number>()
    for (const e of s.elims ?? []) elims.set(e.cell, (elims.get(e.cell) ?? 0) | bit(e.digit))
    return { cells: s.cells, elims, target: s.place }
  }, [hint, checkCells])

  const hintContent = () => {
    if (!hint) return null
    const { hint: h, stage } = hint
    const next = () => { tap(); setHint({ hint: h, stage: stage + 1 }) }
    const apply = () => {
      tap()
      const g = applyHint(game, h, opts)
      setHint(null)
      commit(g, h.kind === 'step' && h.step.place ? [h.step.place.cell] : h.kind === 'reveal' ? [h.cell] : [])
    }
    let title = '', body = '', action: [string, () => void] | null = null
    if (h.kind === 'mistake') {
      title = 'Something’s not right'
      body = stage === 1 ? `There ${h.cells.length === 1 ? 'is a digit' : `are ${h.cells.length} digits`} on the board that won’t work.` : 'The highlighted digits are incorrect.'
      action = stage === 1 ? ['Show me', next] : ['Clear them', apply]
    } else if (h.kind === 'badNote') {
      title = 'Check your notes'
      body = stage === 1 ? 'Some of your notes rule out the correct digit.' : 'The highlighted cells’ notes are missing the digit that belongs there.'
      action = stage === 1 ? ['Show me', next] : ['Fix notes', apply]
    } else if (h.kind === 'reveal') {
      title = 'Beyond my techniques'
      body = stage === 1 ? 'There’s no step here that the techniques I know can find.' : `Here is one digit to help you along.`
      action = stage === 1 ? ['Reveal a digit', next] : ['Place it', apply]
    } else {
      const s = h.step
      const info = TECH_INFO[s.tech]
      if (stage === 1) {
        title = 'Where to look'
        const where = s.houses.length ? s.houses.slice(0, 2).map(houseName).join(' and ') : ''
        const digits = s.digits.length === 1 ? `the ${s.digits[0]}s` : ''
        body = `Look at ${[where, digits].filter(Boolean).join(', especially ') || 'cells with only two or three candidates'}.`
        action = ['What technique?', next]
      } else if (stage === 2) {
        title = info.name
        body = info.blurb
        action = ['Show the step', next]
      } else {
        title = info.name
        body = s.text
        action = [s.place ? 'Place digit' : 'Apply to notes', apply]
      }
    }
    return (
      <div class="hint-card" role="dialog" aria-live="polite">
        <div class="hint-head">
          <IconHint />
          <strong>{title}</strong>
          <button class="icon-btn" aria-label="Close hint" onClick={() => setHint(null)}><IconClose /></button>
        </div>
        <p>{body}</p>
        {action && <button class="btn primary" onClick={action[1]}>{action[0]}</button>}
      </div>
    )
  }

  // ----- menu actions -----
  const doCheck = () => {
    setMenu(false)
    const wrong = wrongCells(game)
    if (!wrong.length) setToast('No mistakes so far')
    else { setCheckCells(wrong); onChange({ ...game, hints: game.hints + 1 }) }
  }
  const doRestart = () => {
    setMenu(false)
    if (!confirm('Restart this puzzle? Your progress will be cleared, but the timer keeps running.')) return
    const values = [...game.puzzle].map(Number)
    commit({ ...game, values, notes: new Array(81).fill(0), corner: new Array(81).fill(0), colours: new Array(81).fill(0), history: [...game.history, { values: game.values, notes: game.notes, corner: game.corner, colours: game.colours }], future: [] })
  }
  const doShare = async () => {
    setMenu(false)
    const url = `${location.origin}${import.meta.env.BASE_URL}#p=${game.puzzle}`
    try {
      if (navigator.share) await navigator.share({ title: 'Sudoku', text: `Try this ${DIFF_NAMES[game.difficulty]} sudoku`, url })
      else { await navigator.clipboard.writeText(url); setToast('Link copied') }
    } catch { /* cancelled */ }
  }

  const rem = remaining(game.values)
  const modes: [Mode, string][] = [['pen', 'Digit'], ['notes', 'Notes']]
  if (settings.cornerMode) modes.push(['corner', 'Corner'])
  if (settings.colourMode) modes.push(['colour', 'Colour'])
  const title = game.kind === 'daily' && game.date
    ? `Daily · ${parseDateKey(game.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
    : DIFF_NAMES[game.difficulty]

  return (
    <div class="screen game">
      <header class="bar">
        <button class="icon-btn" aria-label="Home" onClick={onHome}><IconBack /></button>
        <div class="bar-title">
          <span>{title}</span>
          {game.kind === 'daily' && <small>{DIFF_NAMES[game.difficulty]}</small>}
        </div>
        <div class="bar-right">
          {settings.showTimer && (
            <button class="timer" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume' : 'Pause'}>
              {formatTime(game.elapsed)} {paused ? <IconPlay /> : <IconPause />}
            </button>
          )}
          <button class="icon-btn" aria-label="More" onClick={() => setMenu(true)}><IconMore /></button>
        </div>
      </header>

      <div class="board-wrap">
        <Board game={game} settings={settings} selected={selected} activeDigit={digitFirst ? activeDigit : 0}
          flash={flash} hint={hintHighlight} paused={paused} onPress={onPress} />
        {paused && (
          <button class="pause-overlay" onClick={() => setPaused(false)}>
            <IconPlay /><span>Paused</span>
          </button>
        )}
      </div>

      <div class="controls">
        {hint ? hintContent() : (
          <>
            <div class="tools">
              <button class="tool" onClick={() => { tap(); commit(undo(game)) }} disabled={!game.history.length}><IconUndo /><span>Undo</span></button>
              <button class="tool" onClick={() => { tap(); commit(redo(game)) }} disabled={!game.future.length}><IconRedo /><span>Redo</span></button>
              <button class="tool" onClick={onErase}><IconErase /><span>Erase</span></button>
              <button class="tool" onClick={() => { tap(); commit(fillNotes(game)) }}><IconFill /><span>Fill notes</span></button>
              <button class="tool" onClick={openHint}><IconHint /><span>Hint</span></button>
            </div>
            <div class="modes" role="tablist">
              {modes.map(([m, label]) => (
                <button role="tab" aria-selected={mode === m} class={mode === m ? 'on' : ''} onClick={() => { tap(); setMode(m) }}>{label}</button>
              ))}
            </div>
            <div class={`pad ${mode}`}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                const done = rem[d] <= 0 && mode !== 'colour'
                return (
                  <button class={`key ${done ? 'done' : ''} ${digitFirst && activeDigit === d ? 'active' : ''}`} data-colour={mode === 'colour' ? d : undefined}
                    onClick={() => onDigit(d)} aria-label={mode === 'colour' ? `Colour ${d}` : `${d}`}>
                    {mode === 'colour' ? '' : <span class="key-digit">{d}</span>}
                    {mode !== 'colour' && settings.showRemaining && <small>{rem[d] > 0 ? rem[d] : ''}</small>}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {menu && (
        <div class="sheet-backdrop" onClick={() => setMenu(false)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()}>
            <button class="sheet-item" onClick={doCheck}><IconCheck /> Check for mistakes</button>
            <button class="sheet-item" onClick={doShare}><IconShare /> Share this puzzle</button>
            <button class="sheet-item" onClick={doRestart}><IconRestart /> Restart puzzle</button>
            <button class="sheet-item muted" onClick={() => setMenu(false)}>Cancel</button>
          </div>
        </div>
      )}

      {toast && <div class="toast">{toast}</div>}

      {won && (
        <div class="win-backdrop">
          <div class="win">
            <div class="win-badge">{won.isBest ? 'New best time!' : 'Solved'}</div>
            <h2>{formatTime(won.game.elapsed)}</h2>
            <p class="win-sub">{DIFF_NAMES[won.game.difficulty]}{won.game.kind === 'daily' ? ' · Daily' : ''}</p>
            <div class="win-stats">
              <div><strong>{won.game.hints}</strong><span>hints</span></div>
              <div><strong>{won.game.mistakes}</strong><span>mistakes</span></div>
            </div>
            <button class="btn primary" onClick={() => onNewGame(won.game.difficulty === 5 ? 4 : won.game.difficulty)}>
              New {DIFF_NAMES[won.game.difficulty === 5 ? 4 : won.game.difficulty]} game
            </button>
            <button class="btn" onClick={onHome}>Home</button>
          </div>
        </div>
      )}
    </div>
  )
}
