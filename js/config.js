/** 플랫폼 전용 설정 — FC 제로 api.js 와 분리 (R37) */
export const PLATFORM = {
  name: 'FC 플랫폼',
  version: '0.1.0',
  /** 별도 Supabase 프로젝트 착수 시 채움 */
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
  /** 베타·Pro 무광고 시 false */
  adsEnabled: true,
  /** 개발: 광고 슬롯 회색 박스 표시 */
  adSlotDebug: true,
};
