import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/app-system.css'
import App from './App.tsx'
import BackendBusyAlert from './components/ui/BackendBusyAlert'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackendBusyAlert />
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
