// Shared CORS allowlist for Netlify Functions.
// Includes production domains, configured site URLs, and any branch deploy
// preview of the teamlyofficiell site (pattern: <branch>--teamlyofficiell.netlify.app).
const STATIC_ALLOWED = [
  "https://www.teamlyecom.com",
  "https://teamlyecom.com",
  "https://teamly.life",
  "https://www.teamly.life",
  "https://admirable-gingersnap-0038d8.netlify.app",
  "https://teamlyofficiell.netlify.app",
  "http://localhost:5173",
];

const BRANCH_DEPLOY_RE = /^https:\/\/[\w-]+--teamlyofficiell\.netlify\.app$/;

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (STATIC_ALLOWED.includes(origin)) return true;
  if (BRANCH_DEPLOY_RE.test(origin)) return true;
  return false;
}

function corsOrigin(origin) {
  return isOriginAllowed(origin) ? origin : STATIC_ALLOWED[0];
}

module.exports = { STATIC_ALLOWED, isOriginAllowed, corsOrigin };
