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

