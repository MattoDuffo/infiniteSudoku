import { store, type Settings } from '../store'
import { Page } from './Page'

type Bool = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings]

export function SettingsScreen({ settings, onChange, onBack }: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v })
  const toggle = (k: Bool, label: string, desc?: string) => (
    <label class="row">
      <div><span>{label}</span>{desc && <small>{desc}</small>}</div>
      <input type="checkbox" {...{ switch: true }} checked={settings[k]} onChange={(e) => set(k, (e.target as HTMLInputElement).checked)} />
    </label>
  )
  const choice = <K extends keyof Settings>(k: K, label: string, opts: [Settings[K], string][], desc?: string) => (
    <div class="row col">
      <div><span>{label}</span>{desc && <small>{desc}</small>}</div>
      <div class="seg">
        {opts.map(([v, l]) => <button class={settings[k] === v ? 'on' : ''} onClick={() => set(k, v)}>{l}</button>)}
      </div>
    </div>
  )

  const exportData = async () => {
    const blob = new Blob([store.exportAll()], { type: 'application/json' })
    const file = new File([blob], `sudoku-backup-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Sudoku backup' }) } catch { /* cancelled */ }
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.name
    a.click()
  }
  const importData = (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    f.text().then((t) => {
      if (store.importAll(t)) location.reload()
      else alert('That file isn’t a valid backup.')
    })
  }

  return (
    <Page title="Settings" onBack={onBack}>
      <h3 class="section-title">Appearance</h3>
      <div class="group">
        {choice('theme', 'Theme', [['system', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
        {toggle('showTimer', 'Show timer')}
        {toggle('haptics', 'Haptic feedback', 'Light taps when you place digits.')}
      </div>

      <h3 class="section-title">Input</h3>
      <div class="group">
        {choice('inputOrder', 'Input style', [['cell', 'Cell first'], ['digit', 'Digit first']],
          'Cell first: tap a cell, then a digit. Digit first: pick a digit, then tap cells to fill them.')}
        {toggle('autoRemoveNotes', 'Auto-remove notes', 'Placing a digit clears it from notes in the same row, column and box.')}
        {toggle('colourMode', 'Colour mode', 'Shade cells with colours to track chains and ideas.')}
        {toggle('cornerMode', 'Corner marks', 'A second kind of pencil mark, written in the corners of a cell.')}
      </div>

      <h3 class="section-title">Assistance</h3>
      <div class="group">
        {choice('mistakes', 'Mistakes', [['off', 'Off'], ['conflicts', 'Conflicts'], ['instant', 'Instant']],
          'Conflicts shows repeated digits. Instant also marks wrong digits right away. There is never a mistake limit.')}
        {toggle('highlightPeers', 'Highlight row, column and box')}
        {toggle('highlightSame', 'Highlight matching digits')}
        {toggle('showRemaining', 'Show digits remaining')}
      </div>

      <h3 class="section-title">Data</h3>
      <div class="group">
        <button class="row link" onClick={exportData}>Back up games and stats</button>
        <label class="row link">Restore from backup<input type="file" accept="application/json,.json" hidden onChange={importData} /></label>
        <button class="row link danger" onClick={() => { if (confirm('Reset all statistics? This can’t be undone.')) store.resetStats() }}>Reset statistics</button>
      </div>
      <p class="note">Everything is stored on this device only. No account, no tracking, no ads.</p>
    </Page>
  )
}
