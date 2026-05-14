// Shared auth helpers for all API handlers
// Replaces hardcoded role === 'admin' checks with permission-based checks

const SUPABASE_URL = 'https://anagoloyaaikuexzbxae.supabase.co';

export async function getCallerUserId(token, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey }
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u.id || null;
}

// Check a single permission via the DB function user_has_permission()
export async function hasPermission(userId, permissionKey, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/user_has_permission`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    body: JSON.stringify({ p_user_id: userId, p_permission_key: permissionKey }),
  });
  if (!r.ok) return false;
  return (await r.json()) === true;
}

// Legacy fallback: check old role column while migration is active
// Returns true if user has the permission OR the old 'admin' role
export async function hasPermissionOrLegacyAdmin(userId, permissionKey, serviceKey) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`,
    { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
  );
  const data = await r.json();
  if (data?.[0]?.role === 'admin') return true;
  return hasPermission(userId, permissionKey, serviceKey);
}

export { SUPABASE_URL };
