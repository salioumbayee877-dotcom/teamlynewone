// Helper to send Web Push notifications to all subscriptions of an org
// matching the requested roles. Safe to call from any Netlify function.
//
// Required env vars:
//   VAPID_PUBLIC_KEY   (same value as VITE_VAPID_PUBLIC_KEY)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT      (optional, defaults to mailto:noreply@teamly.app)
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY

const webpush = require('web-push');

const SB_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@teamly.app';

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn('[push] VAPID keys missing — push disabled');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

const sbHeaders = {
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

async function fetchSubscriptions({ orgId, roles, userIds, excludeUserIds }) {
  let url = `${SB_URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth,user_id,role`;
  if (orgId) url += `&org_id=eq.${orgId}`;
  if (Array.isArray(roles) && roles.length) {
    url += `&role=in.(${roles.map(encodeURIComponent).join(',')})`;
  }
  if (Array.isArray(userIds) && userIds.length) {
    url += `&user_id=in.(${userIds.map(encodeURIComponent).join(',')})`;
  }
  if (Array.isArray(excludeUserIds) && excludeUserIds.length) {
    url += `&user_id=not.in.(${excludeUserIds.map(encodeURIComponent).join(',')})`;
  }
  const r = await fetch(url, { headers: sbHeaders });
  if (!r.ok) {
    console.error('[push] fetch subs failed', r.status, await r.text());
    return [];
  }
  return await r.json();
}

async function deleteSubscription(id) {
  try {
    await fetch(`${SB_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
      method: 'DELETE',
      headers: sbHeaders,
    });
  } catch (e) { /* ignore */ }
}

/**
 * Send a push notification.
 * @param {object} opts
 * @param {string} opts.orgId
 * @param {string[]} [opts.roles]   target roles, e.g. ['admin','closer']
 * @param {string[]} [opts.userIds] alternative: target specific users
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {string} [opts.tag]       collapse key
 * @param {string} [opts.url]       URL opened on click (default '/')
 * @param {object} [opts.data]      extra payload
 */
async function sendPush(opts) {
  if (!ensureConfigured()) return { sent: 0, skipped: true };
  const { orgId, roles, userIds, excludeUserIds, title, body, tag, url, data } = opts || {};
  if (!orgId && !(userIds && userIds.length)) return { sent: 0 };
  if (!title) return { sent: 0 };

  const subs = await fetchSubscriptions({ orgId, roles, userIds, excludeUserIds });
  if (!subs.length) return { sent: 0 };

  const payload = JSON.stringify({
    title: String(title).slice(0, 120),
    body: body ? String(body).slice(0, 240) : '',
    tag: tag || 'teamly',
    url: url || '/',
    data: data || {},
  });

  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 60 * 60 }
      );
      sent++;
    } catch (err) {
      const code = err && err.statusCode;
      if (code === 404 || code === 410) {
        // gone — drop it
        await deleteSubscription(s.id);
      } else {
        console.error('[push] send failed', code, err && err.body);
      }
    }
  }));
  return { sent, total: subs.length };
}

module.exports = { sendPush };
