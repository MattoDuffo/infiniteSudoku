import { DIFF_NAMES } from '../game'
import { levelSpec, TIER_START } from '../progression'
import { store } from '../store'
import { Page } from './Page'

const TIERS = [1, 2, 3, 4] as const

export function ProgressiveScreen({ onBack, onPlay }: { onBack: () => void; onPlay: () => void }) {
  const prog = store.progress()
  const level = prog.level
  const tier = levelSpec(level).difficulty
  const inProgress = !!store.games()[`prog-${level}`]
  const totalStars = Object.values(prog.stars).reduce((a, b) => a + b, 0)
  const done = Object.keys(prog.stars).map(Number).sort((a, b) => b - a)

  const reset = () => {
    if (!confirm('Start progressive mode again from level 1? Your stars will be cleared.')) return
    for (const id of Object.keys(store.games())) if (id.startsWith('prog-')) store.deleteGame(id)
    store.saveProgress({ level: 1, stars: {} })
    onBack()
  }

  return (
    <Page title="Progressive" onBack={onBack}>
      <div class="level-hero">
        <span class="eyebrow">Level</span>
        <strong>{level}</strong>
        <span class="meta">{DIFF_NAMES[tier]}{tier === 4 && level >= TIER_START[4] + 9 ? ' · maximum' : ''}</span>
      </div>

      <div class="tier-track" aria-label="Difficulty track">
        {TIERS.map((t) => {
          const start = TIER_START[t]
          const end = t === 4 ? start + 10 : TIER_START[(t + 1) as 2 | 3 | 4]
          const fill = level >= end ? 1 : level <= start ? 0 : (level - start) / (end - start)
          return (
            <div class={`tier ${t === tier ? 'current' : ''}`}>
              <div class="tier-bar"><i style={{ width: `${fill * 100}%` }} /></div>
              <span>{DIFF_NAMES[t]}</span>
            </div>
          )
        })}
      </div>

      <button class="btn primary" onClick={onPlay}>{inProgress ? `Continue level ${level}` : `Play level ${level}`}</button>

      <p class="note">
        Each level is a little harder than the last. Easy levels start with lots of clues and gradually remove them.
        From Medium on, puzzles lean more heavily on that tier’s techniques. Solve a level to unlock the next.
        Earn ★★★ with no hints or mistakes.
      </p>

      {done.length > 0 && (
        <>
          <h3 class="section-title">Completed · {totalStars} ★</h3>
          <div class="level-grid">
            {done.map((n) => (
              <div class={`level-chip t${levelSpec(n).difficulty}`}>
                <strong>{n}</strong>
                <span>{'★'.repeat(prog.stars[n])}{'☆'.repeat(3 - prog.stars[n])}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {level > 1 && <button class="row link danger reset-link" onClick={reset}>Restart from level 1</button>}
    </Page>
  )
}
