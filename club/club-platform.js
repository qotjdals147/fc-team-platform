/** FC 플랫폼 — 구단 홈 역할·부트 (club_members.role · M15 adminPw 폐기) */
function isPlatformClub() {
  return Boolean(window.__CLUB__?.teamId);
}

const PLATFORM_ROLE_LABEL = {
  owner: '구단주',
  admin: '관리자',
  treasurer: '총무',
  member: '멤버',
};

/** §15 M15 · M21 — Auth 역할 → FC 제ero UI 권한 */
function platformRolePermissions(role) {
  return {
    admin: role === 'owner' || role === 'admin',
    treasurer: role === 'owner' || role === 'treasurer',
    stats: role === 'owner' || role === 'admin',
  };
}

async function applyPlatformClubBootstrap() {
  await bootstrapApp();
  applyPlatformMemberRoles();
}

function applyPlatformMemberRoles() {
  if (!isPlatformClub()) return;

  const role = window.__CLUB__?.role || 'member';
  const perm = platformRolePermissions(role);

  window.__CLUB__.permissions = perm;

  isAdmin = perm.admin;
  isTreasurer = perm.treasurer;

  hidePlatformAuthLocks();

  const barRole = document.getElementById('platformClubBarRole');
  if (barRole) barRole.textContent = PLATFORM_ROLE_LABEL[role] || role;

  if (typeof applyAdminMode === 'function') applyAdminMode();
  if (typeof applyTreasurerMode === 'function') applyTreasurerMode();
}

function hidePlatformAuthLocks() {
  ['adminToggleBtn', 'treasurerToggleBtn'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}
