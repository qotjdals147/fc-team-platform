/** FC 플랫폼 — 구단 홈 역할·부트 (club_members.role) */
function applyPlatformClubBootstrap() {
  const role = window.__CLUB__?.role;
  if (['owner', 'admin'].includes(role)) {
    isAdmin = true;
    document.body.classList.add('is-admin');
  }
  if (['owner', 'admin', 'treasurer'].includes(role)) {
    isTreasurer = true;
    document.body.classList.add('is-treasurer');
    if (typeof applyTreasurerMode === 'function') applyTreasurerMode();
  }
  bootstrapApp();
}
