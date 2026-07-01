/**
 * 멤버 관리 (M08~M10) — 로비 구단 탭용 데이터·액션
 */

import {
  apiApplyToClub,
  apiGetClubDetail,
  apiInviteToClub,
  apiListClubMembers,
  apiListMyPendingInvitations,
  apiListPendingApplications,
  apiListRecruitingClubs,
  apiRespondApplication,
  apiRespondInvitation,
  apiSearchProfileByPlatformId,
  apiSetClubRecruiting,
  apiUpdateMemberRole,
} from './api.js';
import { getUserId } from './auth.js';
import { refreshNotifications } from './notifications.js';

export function canManageMembers(role) {
  return role === 'owner' || role === 'admin';
}

export function canChangeRoles(role) {
  return role === 'owner';
}

export function canToggleRecruiting(role) {
  return role === 'owner';
}

export async function loadClubPanel(clubId) {
  const [detail, members, applications] = await Promise.all([
    apiGetClubDetail(clubId),
    apiListClubMembers(clubId),
    apiListPendingApplications(clubId),
  ]);
  return { detail, members: members || [], applications: applications || [] };
}

export async function loadMyInvitations() {
  const uid = getUserId();
  if (!uid) return [];
  const rows = await apiListMyPendingInvitations(uid);
  return rows || [];
}

export async function loadRecruitingClubs() {
  const rows = await apiListRecruitingClubs();
  return rows || [];
}

export async function searchPlatformId(platformId) {
  return apiSearchProfileByPlatformId(platformId);
}

export async function inviteMember(clubId, platformId, role) {
  await apiInviteToClub(clubId, platformId, role);
  await refreshNotifications();
}

export async function respondInvite(invitationId, accept) {
  await apiRespondInvitation(invitationId, accept);
  await refreshNotifications();
}

export async function setRecruiting(clubId, recruiting) {
  await apiSetClubRecruiting(clubId, recruiting);
}

export async function applyClub(clubId, message) {
  await apiApplyToClub(clubId, message);
  await refreshNotifications();
}

export async function respondApp(applicationId, approve, role = 'member') {
  await apiRespondApplication(applicationId, approve, role);
  await refreshNotifications();
}

export async function changeMemberRole(clubId, userId, role) {
  await apiUpdateMemberRole(clubId, userId, role);
}

export function memberLabel(row) {
  const p = row.profiles || {};
  return p.legal_name || p.platform_id || row.user_id?.slice(0, 8) || '회원';
}

export function rpcErrorMessage(e) {
  const msg = e?.message || '';
  if (msg.includes('platform id not found')) return '플랫폼 ID를 찾을 수 없습니다.';
  if (msg.includes('already a member')) return '이미 구단 멤버입니다.';
  if (msg.includes('M06')) return 'member 역할은 한 구단만 소속 가능합니다 (M06).';
  if (msg.includes('invitation already pending')) return '이미 초대 대기 중입니다.';
  if (msg.includes('application already pending')) return '이미 신청 대기 중입니다.';
  if (msg.includes('club not recruiting')) return '모집 중인 구단이 아닙니다.';
  if (msg.includes('JWT expired') || msg.includes('로그인이 만료')) {
    return '로그인이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.';
  }
  return msg || '요청 실패';
}
