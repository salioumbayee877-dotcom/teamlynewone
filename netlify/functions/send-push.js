// POST /.netlify/functions/send-push
// Body: { title, body?, roles?: ['admin','closer','livreur'], userIds?, tag?, url?, data? }
//
// Auth: requires a logged-in user. Pushes only target subscriptions inside
// the caller's org (anti-cross-tenant guard).

const { requireUser, getProfile } = require('./_auth');
const { sendPush } = require('./lib/sendPush');
const { corsOrigin } = require('./lib/cors');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(origin),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method not allowed' };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: 'Unauthorized' };
  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile || !profile.org_id) return { statusCode: 403, headers, body: 'No org' };

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (_) {}

  const { title, body, roles, userIds, tag, url, data, excludeSelf } = payload;
  if (!title) return { statusCode: 400, headers, body: 'Missing title' };

  // Sanitize roles
  const cleanRoles = Array.isArray(roles)
    ? roles.filter(r => ['admin','closer','livreur'].includes(r))
    : undefined;

  // Default: exclude the caller so they don't self-notify (set excludeSelf:false to opt out)
  const excludeUserIds = excludeSelf === false ? undefined : [user.id];

  try {
    const res = await sendPush({
      orgId: profile.org_id, // hard-locked to caller's org
      roles: cleanRoles,
      userIds: Array.isArray(userIds) ? userIds : undefined,
      excludeUserIds,
      title, body, tag, url, data,
    });
    return { statusCode: 200, headers, body: JSON.stringify(res) };
  } catch (e) {
    console.error('[send-push] error', e.message);
    return { statusCode: 500, headers, body: e.message };
  }
};
