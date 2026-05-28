// POST   /.netlify/functions/push-subscribe   { endpoint, p256dh, auth, role? }
// DELETE /.netlify/functions/push-subscribe   { endpoint }
//
// Stores or removes the caller's Web Push subscription. Requires a valid
// Supabase JWT (same Authorization header the app already sends).

const { requireUser, getProfile } = require('./_auth');
const { corsOrigin } = require('./lib/cors');

const SB_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const sbHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

exports.handler = async (event) => {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = {
    'Access-Control-Allow-Origin': corsOrigin(origin),
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    Vary: 'Origin',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const user = await requireUser(event);
  if (!user) return { statusCode: 401, headers, body: 'Unauthorized' };
  const profile = await getProfile(user.id, SERVICE_KEY);
  if (!profile || !profile.org_id) return { statusCode: 403, headers, body: 'No org' };

  let payload = {};
  try { payload = JSON.parse(event.body || '{}'); } catch (_) {}

  const endpoint = payload.endpoint;
  if (!endpoint) return { statusCode: 400, headers, body: 'Missing endpoint' };

  if (event.httpMethod === 'DELETE') {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&user_id=eq.${user.id}`,
        { method: 'DELETE', headers: sbHeaders }
      );
      if (!r.ok) return { statusCode: 500, headers, body: await r.text() };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, headers, body: e.message };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  const { p256dh, auth } = payload;
  if (!p256dh || !auth) return { statusCode: 400, headers, body: 'Missing keys' };

  const role = ['admin', 'closer', 'livreur'].includes(profile.role) ? profile.role : 'closer';

  // Upsert by endpoint
  try {
    const row = {
      user_id: user.id,
      org_id: profile.org_id,
      role,
      endpoint,
      p256dh,
      auth,
      user_agent: (event.headers?.['user-agent'] || event.headers?.['User-Agent'] || '').slice(0, 200),
      last_used_at: new Date().toISOString(),
    };
    const r = await fetch(`${SB_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
      method: 'POST',
      headers: {
        ...sbHeaders,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.error('[push-subscribe] upsert failed', r.status, txt);
      return { statusCode: 500, headers, body: txt };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, role }) };
  } catch (e) {
    return { statusCode: 500, headers, body: e.message };
  }
};
