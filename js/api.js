/**
 * 플랫폼 API — Supabase PostgREST (별도 프로젝트, R37)
 * FC 제로 ../api.js 와 URL·키 분리
 */

import { PLATFORM } from './config.js';
import { clearSession, ensureValidSession, getAccessToken, refreshSession } from './auth.js';

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
 * @param {object} options
 * @param {boolean} [_retried]
 */
export async function apiFetch(path, options = {}, _retried = false) {
  const { method = 'GET', body, requireAuth = false, prefer } = options;
  if (!isBackendReady()) throw new Error('SUPABASE 미설정 (config.js)');

  if (requireAuth) {
    const session = await ensureValidSession();
    if (!session) {
      throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }
  }

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
    const jwtExpired =
      requireAuth &&
      !_retried &&
      (msg.includes('JWT expired') || msg.includes('Invalid JWT'));

    if (jwtExpired) {
      const refreshed = await refreshSession();
      if (refreshed) return apiFetch(path, options, true);
      clearSession();
      throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    }

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

/** RPC create_club — SQL: setup/platform_setup/rpc-create-club.sql */
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

// ── members (M08~M10) — RPC: setup/platform_setup/rpc-members.sql ──

export async function apiSearchProfileByPlatformId(platformId) {
  const pid = encodeURIComponent(String(platformId || '').trim().toLowerCase());
  const rows = await apiFetch(
    `profiles?platform_id=eq.${pid}&select=id,platform_id,legal_name`,
    { requireAuth: true },
  );
  return rows?.[0] || null;
}

export async function apiGetClubDetail(clubId) {
  const rows = await apiFetch(
    `clubs?id=eq.${clubId}&select=id,slug,name,region,recruiting,team_id`,
    { requireAuth: true },
  );
  return rows?.[0] || null;
}

export async function apiListClubMembers(clubId) {
  return apiFetch(
    `club_members?club_id=eq.${clubId}&status=eq.active&select=role,joined_at,user_id,profiles(platform_id,legal_name)&order=joined_at.asc`,
    { requireAuth: true },
  );
}

export async function apiListPendingApplications(clubId) {
  return apiFetch(
    `club_applications?club_id=eq.${clubId}&status=eq.pending&select=id,message,created_at,user_id,profiles(platform_id,legal_name)&order=created_at.desc`,
    { requireAuth: true },
  );
}

export async function apiListMyPendingInvitations(userId) {
  return apiFetch(
    `club_invitations?invitee_id=eq.${userId}&status=eq.pending&select=id,role,created_at,inviter_id,clubs(id,name,slug)`,
    { requireAuth: true },
  );
}

export async function apiListRecruitingClubs() {
  return apiFetch(
    'clubs?recruiting=eq.true&select=id,slug,name,region&order=name.asc',
    { requireAuth: true },
  );
}

export async function apiInviteToClub(clubId, platformId, role = 'member') {
  return apiFetch('rpc/invite_to_club', {
    method: 'POST',
    requireAuth: true,
    body: {
      p_club_id: clubId,
      p_invitee_platform_id: platformId,
      p_role: role,
    },
  });
}

export async function apiRespondInvitation(invitationId, accept) {
  return apiFetch('rpc/respond_invitation', {
    method: 'POST',
    requireAuth: true,
    body: { p_invitation_id: invitationId, p_accept: accept },
  });
}

export async function apiSetClubRecruiting(clubId, recruiting) {
  return apiFetch('rpc/set_club_recruiting', {
    method: 'POST',
    requireAuth: true,
    body: { p_club_id: clubId, p_recruiting: recruiting },
  });
}

export async function apiApplyToClub(clubId, message = '') {
  return apiFetch('rpc/apply_to_club', {
    method: 'POST',
    requireAuth: true,
    body: { p_club_id: clubId, p_message: message },
  });
}

export async function apiRespondApplication(applicationId, approve, role = 'member') {
  return apiFetch('rpc/respond_application', {
    method: 'POST',
    requireAuth: true,
    body: {
      p_application_id: applicationId,
      p_approve: approve,
      p_role: role,
    },
  });
}

export async function apiUpdateMemberRole(clubId, targetUserId, newRole) {
  return apiFetch('rpc/update_member_role', {
    method: 'POST',
    requireAuth: true,
    body: {
      p_club_id: clubId,
      p_target_user_id: targetUserId,
      p_new_role: newRole,
    },
  });
}

/** RPC leave_club / kick_member — SQL: setup/platform_setup/rpc-leave-kick.sql */
export async function apiLeaveClub(clubId) {
  return apiFetch('rpc/leave_club', {
    method: 'POST',
    requireAuth: true,
    body: { p_club_id: clubId },
  });
}

export async function apiKickMember(clubId, targetUserId) {
  return apiFetch('rpc/kick_member', {
    method: 'POST',
    requireAuth: true,
    body: { p_club_id: clubId, p_target_user_id: targetUserId },
  });
}
