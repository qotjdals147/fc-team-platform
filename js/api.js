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
  // PostgREST 루트(/rest/v1/)는 401이 뜨는 케이스가 있어
  // 실제 테이블을 "1줄만" 조회해서 연결 여부를 확인한다.
  const res = await fetch(`${PLATFORM.SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
    headers: {
      apikey: PLATFORM.SUPABASE_KEY,
      Authorization: `Bearer ${PLATFORM.SUPABASE_KEY}`,
      Accept: 'application/json',
    },
  });
  return { ok: res.ok, status: res.status };
}
