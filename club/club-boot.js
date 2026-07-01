/**
 * 구단 홈 진입 — slug → team_id, Auth·소속 확인 후 FC 제ero UI 로드
 */
import { PLATFORM } from '../js/config.js';
import { getUserId, ensureValidSession } from '../js/auth.js';
import { apiGetClubBySlug, apiGetMyClubRole } from '../js/api.js';

window.__PLATFORM__ = PLATFORM;

function showGate(message, linkHref, linkText) {
  document.body.innerHTML = `
    <div class="club-stub" style="max-width:480px;margin:48px auto;padding:24px;font-family:system-ui,sans-serif">
      <p><a href="../index.html">← FC 플랫폼</a></p>
      <h1 style="font-size:1.25rem">구단 홈</h1>
      <p class="page-muted" style="color:#6b7280">${message}</p>
      ${linkHref ? `<p><a href="${linkHref}">${linkText || '이동'}</a></p>` : ''}
    </div>`;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
    document.body.appendChild(s);
  });
}

async function main() {
  const slug = new URLSearchParams(location.search).get('slug');
  if (!slug) {
    showGate('구단 주소(slug)가 없습니다.', '../index.html', '플랫폼으로');
    return;
  }

  const userId = getUserId();
  if (!userId) {
    showGate(
      '로그인이 필요합니다.',
      `../index.html#login`,
      '로그인하러 가기',
    );
    return;
  }

  const session = await ensureValidSession();
  if (!session) {
    showGate(
      '로그인이 만료되었습니다.',
      '../index.html',
      '다시 로그인',
    );
    return;
  }

  window.__ensurePlatformSession = ensureValidSession;

  let club;
  let role;
  try {
    club = await apiGetClubBySlug(slug);
    if (!club) {
      showGate('구단을 찾을 수 없습니다.', '../index.html', '플랫폼으로');
      return;
    }
    role = await apiGetMyClubRole(userId, club.id);
    if (!role) {
      showGate('이 구단의 멤버가 아닙니다.', '../index.html', '플랫폼으로');
      return;
    }
  } catch (e) {
    showGate(`연결 오류: ${e.message}`, '../index.html', '플랫폼으로');
    return;
  }

  window.__CLUB__ = {
    id: club.id,
    slug: club.slug,
    name: club.name,
    region: club.region,
    teamId: club.team_id,
    role,
  };

  document.title = `${club.name} | FC 플랫폼`;
  const barName = document.getElementById('platformClubBarName');
  if (barName) barName.textContent = club.name;

  try {
    await loadScript('data.js?v=1');
    await loadScript('club-api.js?v=1');
    await loadScript('club-platform.js?v=4');
    await loadScript('app.js?v=4');
  } catch (e) {
    showGate(e.message, '../index.html', '플랫폼으로');
  }
}

main();
