import { useState } from 'preact/hooks'
import type { Game } from '../game'
import { customGame } from './App'
import { Page } from './Page'

export function ImportScreen({ onBack, onStart }: { onBack: () => void; onStart: (g: Game) => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const go = () => {
    const g = customGame(text)
    if (typeof g === 'string') setError(g)
    else onStart(g)
  }
  const digits = text.replace(/[^0-9.]/g, '').length
  return (
    <Page title="Enter a puzzle" onBack={onBack}>
      <p class="note">Got a puzzle from a newspaper or a friend? Type or paste its 81 cells row by row. Use 0 or a full stop for blanks.</p>
      <textarea class="import-box" value={text} onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setError('') }}
        placeholder="530070000600195000098000060…" rows={5} inputMode="numeric" autoCapitalize="off" autoCorrect="off" spellcheck={false} />
      <div class="import-meta"><span>{digits}/81</span>{error && <span class="error">{error}</span>}</div>
      <button class="btn primary" onClick={go} disabled={digits !== 81}>Check and play</button>
    </Page>
  )
}
