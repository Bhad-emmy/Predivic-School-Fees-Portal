import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN

if (import.meta.env.PROD && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    sendDefaultPii: false,
    beforeSend(event) {
      // Keep credentials and potentially identifying application data out of events.
      delete event.user
      delete event.extra
      delete event.breadcrumbs

      if (event.request) {
        delete event.request.cookies
        delete event.request.data
        delete event.request.headers

        if (event.request.url) {
          event.request.url = event.request.url.split(/[?#]/, 1)[0]
        }
      }

      return event
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
