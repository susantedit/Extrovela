import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { analytics } from './services/firebase/firebaseAnalytics'

// Initialize the typed analytics layer. Without this call trackEvent() is a
// no-op, so every Phase 12 event would silently vanish. init() itself fails
// safe: it only attaches when firebase/analytics isSupported() in this runtime.
void analytics.init().catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
