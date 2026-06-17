/**
 * 플랫폼 API — 별도 Supabase 프로젝트 연동 시 확장
 * FC 제로 ../api.js 와 URL·키 분리 (R37)
 */

import { PLATFORM } from './config.js';

export function isBackendReady() {
  return Boolean(PLATFORM.SUPABASE_URL && PLATFORM.SUPABASE_KEY);
}

export async function apiHealth() {
  if (!isBackendReady()) {
    return { ok: false, reason: 'SUPABASE 미설정 (config.js)' };
  }
  const res = await fetch(`${PLATFORM.SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: PLATFORM.SUPABASE_KEY,
      Authorization: `Bearer ${PLATFORM.SUPABASE_KEY}`,
    },
  });
  return { ok: res.ok, status: res.status };
}
