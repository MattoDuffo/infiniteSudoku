import { LEVEL_NAMES, TECH_INFO, type TechId } from '../engine/techniques'
import { Page } from './Page'

export function Learn({ onBack }: { onBack: () => void }) {
  const ids = Object.keys(TECH_INFO) as TechId[]
  return (
    <Page title="Techniques" onBack={onBack}>
      <p class="note">Each puzzle is rated by the hardest technique it needs. You never have to guess: every puzzle can be solved by logic alone.</p>
      {[1, 2, 3, 4].map((lvl) => (
        <section class="learn-level">
          <h3 class="section-title">{LEVEL_NAMES[lvl]}</h3>
          {ids.filter((id) => TECH_INFO[id].level === lvl).map((id) => (
            <details class="learn-item">
              <summary>{TECH_INFO[id].name}</summary>
              <p>{TECH_INFO[id].blurb}</p>
            </details>
          ))}
        </section>
      ))}
    </Page>
  )
}
