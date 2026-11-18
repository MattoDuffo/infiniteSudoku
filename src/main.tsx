import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './ui/App'
import './styles.css'

render(<App />, document.getElementById('app')!)
registerSW({ immediate: true })

// iOS: block pinch-zoom and double-tap zoom gestures in standalone mode.
document.addEventListener('gesturestart', (e) => e.preventDefault())
