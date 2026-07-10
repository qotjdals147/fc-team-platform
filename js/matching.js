/**
 * 매칭 (MK01~MK03) — 로비 매칭 탭
 */

import {
  apiApplyToMatchingPost,
  apiCountPendingApplications,
  apiCreateMatchingPost,
  apiGetMatchingPost,
  apiListMatchingApplications,
  apiListMatchingPosts,
  apiRespondMatchingApplication,
} from './api.js';
import { getUserId } from './auth.js';
import { refreshNotifications } from './notifications.js';

export function canManageMatching(role) {
  return role === 'owner' || role === 'admin';
}

export function staffClubs(myClubs) {
  return (myClubs || []).filter((c) => canManageMatching(c.role));
}

export async function loadOpenPosts(regionFilter = '') {
  const rows = await apiListMatchingPosts(regionFilter);
  const withCounts = await Promise.all(
    (rows || []).map(async (post) => {
      let pendingCount = 0;
      try {
        pendingCount = await apiCountPendingApplications(post.id);
      } catch {
        pendingCount = 0;
      }
      return { ...post, pendingCount };
    }),
  );
  return withCounts;
}

export async function loadPostDetail(postId) {
  const post = await apiGetMatchingPost(postId);
  if (!post) return null;
  const applications = await apiListMatchingApplications(postId);
  return { post, applications: applications || [] };
}

export async function createPost(clubId, scheduledAt, place, region) {
  const result = await apiCreateMatchingPost(clubId, scheduledAt, place, region);
  await refreshNotifications();
  return result;
}

export async function applyToPost(postId, clubId) {
  const result = await apiApplyToMatchingPost(postId, clubId);
  await refreshNotifications();
  return result;
}

export async function respondApplication(applicationId, accept) {
  const result = await apiRespondMatchingApplication(applicationId, accept);
  await refreshNotifications();
  return result;
}

export function formatMatchWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const wd = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  const date = d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `${date} (${wd}) ${time}`;
}

export function statusLabel(status) {
  const map = {
    open: '모집중',
    applications_pending: '신청 접수중',
    matched: '매칭완료',
    cancelled: '취소',
    pending: '대기',
    accepted: '승인',
    rejected: '거절',
    withdrawn: '철회',
  };
  return map[status] || status;
}

export function rpcMatchingError(e) {
  const msg = e?.message || '';
  if (msg.includes('field snapshot empty')) {
    return '포메(라인업)이 비어 있습니다. 구단 홈 → 포메 탭에서 명단을 짠 뒤 다시 시도해 주세요. (MK08)';
  }
  if (msg.includes('post not open') || msg.includes('already matched')) {
    return '이미 마감된 공고입니다. (MK15)';
  }
  if (msg.includes('cannot apply to own post')) return '본인 구단 공고에는 신청할 수 없습니다.';
  if (msg.includes('application already exists')) return '이미 신청한 공고입니다.';
  if (msg.includes('owner or admin required')) return '구단주 또는 관리자만 가능합니다.';
  if (msg.includes('scheduled_at must be future')) return '경기 일시는 미래로 설정해 주세요.';
  if (msg.includes('place required')) return '장소를 입력해 주세요.';
  if (msg.includes('JWT expired') || msg.includes('로그인이 만료')) {
    return '로그인이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.';
  }
  return msg || '요청 실패';
}
