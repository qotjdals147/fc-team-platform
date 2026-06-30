/** FC 플랫폼 — 구단 홈 역할·부트 (club_members.role) */
async function applyPlatformClubBootstrap() {
  await bootstrapApp();
  applyPlatformMemberRoles();
}

function applyPlatformMemberRoles() {
  const role = window.__CLUB__?.role;
  if (!role) return;

  if (role === 'owner' || role === 'admin') {
    isAdmin = true;
  } else {
    isAdmin = false;
  }

  if (role === 'owner' || role === 'treasurer') {
    isTreasurer = true;
  } else if (role === 'admin') {
    isTreasurer = false;
  } else {
    isTreasurer = false;
  }

  if (typeof applyAdminMode === 'function') applyAdminMode();
  if (typeof applyTreasurerMode === 'function') applyTreasurerMode();
}
