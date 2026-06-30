/**
 * 플랫폼 API — Supabase PostgREST (별도 프로젝트, R37)
 * FC 제로 ../api.js 와 URL·키 분리
 */

import { PLATFORM } from './config.js';
import { getAccessToken } from './auth.js';

export function isBackendReady() {
  return Boolean(PLATFORM.SUPABASE_URL && PLATFORM.SUPABASE_KEY);
}

export function authHeaders(requireAuth = false) {
  const token = getAccessToken();
  if (requireAuth && !token) {
    throw new Error('로그인이 필요합니다.');
  }
  return {
    apikey: PLATFORM.SUPABASE_KEY,
    Authorization: `Bearer ${token || PLATFORM.SUPABASE_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function parseJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {string} path — rest/v1/ 이후 (예: profiles?id=eq.xxx)
 */
export async function apiFetch(path, options = {}) {
  const { method = 'GET', body, requireAuth = false, prefer } = options;
  if (!isBackendReady()) throw new Error('SUPABASE 미설정 (config.js)');

  const headers = { ...authHeaders(requireAuth) };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${PLATFORM.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const json = await parseJson(res);
  if (!res.ok) {
    const msg =
      (json && (json.message || json.error || json.hint)) ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function apiHealth() {
  if (!isBackendReady()) {
    return { ok: false, reason: 'SUPABASE 미설정 (config.js)' };
  }
  try {
    await apiFetch('profiles?select=id&limit=1');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message, status: e.status };
  }
}

// ── profiles (§15) ──

export async function apiLoadProfile(userId) {
  const rows = await apiFetch(
    `profiles?id=eq.${userId}&select=id,platform_id,legal_name,verified_at,is_beta_founder,pro_paid_until,created_at`,
    { requireAuth: true },
  );
  return rows?.[0] || null;
}

export async function apiSetPlatformId(userId, platformId) {
  return apiFetch(`profiles?id=eq.${userId}`, {
    method: 'PATCH',
    requireAuth: true,
    prefer: 'return=representation',
    body: { platform_id: platformId, updated_at: new Date().toISOString() },
  });
}

// ── clubs (§15 · M05) ──

export async function apiListMyClubs(userId) {
  const rows = await apiFetch(
    `club_members?user_id=eq.${userId}&status=eq.active&select=role,clubs(id,slug,name,region,team_id)`,
    { requireAuth: true },
  );
  return (rows || [])
    .filter((r) => r.clubs)
    .map((r) => ({ ...r.clubs, role: r.role }));
}

/** RPC create_club — SQL: platform/setup/rpc-create-club.sql */
export async function apiCreateClub({ slug, name, region }) {
  return apiFetch('rpc/create_club', {
    method: 'POST',
    requireAuth: true,
    body: { p_slug: slug, p_name: name, p_region: region },
  });
}

export async function apiGetClubBySlug(slug) {
  const rows = await apiFetch(
    `clubs?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,region,team_id`,
    { requireAuth: true },
  );
  return rows?.[0] || null;
}

export async function apiGetMyClubRole(userId, clubId) {
  const rows = await apiFetch(
    `club_members?user_id=eq.${userId}&club_id=eq.${clubId}&status=eq.active&select=role`,
    { requireAuth: true },
  );
  return rows?.[0]?.role || null;
}

// ── notifications (§5-2) ──

export async function apiLoadNotifications(userId) {
  return apiFetch(
    `notifications?user_id=eq.${userId}&deleted_at=is.null&order=created_at.desc&limit=50&select=id,type,title,body,payload,created_at,read_at,deleted_at`,
    { requireAuth: true },
  );
}

export async function apiMarkNotificationRead(id, userId) {
  return apiFetch(`notifications?id=eq.${id}&user_id=eq.${userId}`, {
    method: 'PATCH',
    requireAuth: true,
    prefer: 'return=minimal',
    body: { read_at: new Date().toISOString() },
  });
}

export async function apiDeleteNotification(id, userId) {
  return apiFetch(`notifications?id=eq.${id}&user_id=eq.${userId}`, {
    method: 'PATCH',
    requireAuth: true,
    prefer: 'return=minimal',
    body: { deleted_at: new Date().toISOString() },
  });
}
