import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { loadLocale } from './i18n'
import './index.css'

registerSW({ immediate: true })

async function bootstrap() {
  await loadLocale(localStorage.getItem('myspace-lang') || 'ar')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
