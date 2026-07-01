import { PLATFORM } from './config.js';

const STORE_KEY = 'fc_platform_session_v1';

function mustBeReady() {
  if (!PLATFORM.SUPABASE_URL || !PLATFORM.SUPABASE_KEY) {
    throw new Error('SUPABASE 미설정 (config.js)');
  }
}

function authBase() {
  return `${PLATFORM.SUPABASE_URL}/auth/v1`;
}

function saveSession(session) {
  localStorage.setItem(STORE_KEY, JSON.stringify(session));
}

export function getSession() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return getSession()?.access_token || null;
}

/** @returns {boolean} */
export function isAccessTokenExpired(session = getSession()) {
  if (!session?.access_token) return true;
  const exp = session.expires_at;
  if (typeof exp !== 'number') return false;
  return Date.now() / 1000 >= exp - 30;
}

export async function refreshSession() {
  const session = getSession();
  if (!session?.refresh_token) {
    clearSession();
    return null;
  }

  const { ok, json } = await postJson(
    `${authBase()}/token?grant_type=refresh_token`,
    { refresh_token: session.refresh_token },
  );

  if (ok && json?.access_token) {
    saveSession(json);
    return json;
  }

  clearSession();
  return null;
}

/** 로그인 세션 유지 — access JWT 만료 시 refresh_token으로 갱신 */
export async function ensureValidSession() {
  const session = getSession();
  if (!session?.access_token) return null;
  if (!isAccessTokenExpired(session)) return session;
  return refreshSession();
}

export function getUserId() {
  return getSession()?.user?.id || null;
}

export function clearSession() {
  localStorage.removeItem(STORE_KEY);
}

async function postJson(url, body) {
  mustBeReady();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: PLATFORM.SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, json, text };
}

export async function signUpWithEmail(email, password) {
  const { ok, status, json } = await postJson(`${authBase()}/signup`, {
    email,
    password,
  });

  // 이메일 Confirm ON이면 세션이 없을 수 있음
  const session = json?.session || null;
  if (ok && session?.access_token) saveSession(session);

  return {
    ok,
    status,
    needsEmailConfirm: ok && !session?.access_token,
    session,
    user: json?.user || null,
    error: json?.error_description || json?.msg || null,
  };
}

export async function signInWithEmail(email, password) {
  const { ok, status, json } = await postJson(
    `${authBase()}/token?grant_type=password`,
    { email, password },
  );

  const session = ok ? json : null;
  if (ok && session?.access_token) saveSession(session);

  return {
    ok,
    status,
    session,
    error: json?.error_description || json?.msg || null,
  };
}

export async function signOut() {
  const token = getAccessToken();
  clearSession();
  if (!token) return { ok: true, skipped: true };

  mustBeReady();
  const res = await fetch(`${authBase()}/logout`, {
    method: 'POST',
    headers: {
      apikey: PLATFORM.SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  return { ok: res.ok, status: res.status };
}

