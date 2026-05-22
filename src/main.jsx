import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './styles/global.css'
import App from './App'
import TeamlyLanding from './teamly-v2'

Sentry.init({
  dsn: "https://f9ab4ebc622cca0a77e4227c91389f06@o4511325827760128.ingest.de.sentry.io/4511326170972240",
  enabled: false,
})

const path = window.location.pathname;
const hasToken = !!localStorage.getItem("teamly_token");
const hasOAuthHash = /access_token=|error=/.test(window.location.hash || "");
const _qp = new URLSearchParams(window.location.search || "");
const isRecoveryCallback = _qp.get("type") === "recovery"
  || _qp.get("reset") === "1"
  || (!!_qp.get("token_hash") && _qp.get("type") !== "signup");

function Root() {
  if (path === '/' || path === '') {
    if (isRecoveryCallback) {
      // Password recovery callback landed on root — route to App so the handler fires
      window.location.replace('/dashboard' + window.location.search + window.location.hash);
      return null;
    }
    if (hasOAuthHash) {
      // OAuth callback landed on root — redirect to /dashboard preserving the hash
      window.location.replace('/dashboard' + window.location.hash);
      return null;
    }
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