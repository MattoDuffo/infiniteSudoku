import type { ComponentChildren } from 'preact'
import { IconBack } from './icons'

export function Page({ title, onBack, children }: { title: string; onBack: () => void; children: ComponentChildren }) {
  return (
    <div class="screen page">
      <header class="bar">
        <button class="icon-btn" aria-label="Back" onClick={onBack}><IconBack /></button>
        <div class="bar-title"><span>{title}</span></div>
        <div class="bar-right" />
      </header>
      <div class="page-body">{children}</div>
    </div>
  )
}
