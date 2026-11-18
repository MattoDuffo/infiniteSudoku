/**
 * Light haptic tap. Android uses the Vibration API. iOS Safari (18+) has no vibration API,
 * but toggling a native `<input type=checkbox switch>` produces a system haptic, so we
 * click a hidden one.
 */
let enabled = true
let label: HTMLLabelElement | null = null

export const setHaptics = (on: boolean) => { enabled = on }

export function tap() {
  if (!enabled) return
  if (typeof navigator.vibrate === 'function') { navigator.vibrate(8); return }
  if (!label) {
    label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
  }
  label.click()
}
