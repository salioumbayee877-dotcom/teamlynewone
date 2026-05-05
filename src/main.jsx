import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App'
import TeamlyLanding from './teamly-v2'

Sentry.init({
  dsn: "https://f9ab4ebc622cca0a77e4227c91389f06@o4511325827760128.ingest.de.sentry.io/4511326170972240",
  enabled: false,
})

const path = window.location.pathname;
const hasToken = !!localStorage.getItem("teamly_token");

function Root() {
  if (path === '/' || path === '') {
    if (hasToken) {
      window.location.replace('/dashboard');
      return null;
    }
    return <TeamlyLanding />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)