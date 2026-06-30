import { PLATFORM } from './config.js';

import {

  getNotifications,

  unreadCount,

  markRead,

  removeNotification,

  refreshNotifications,

} from './notifications.js';

import {

  getSession,

  getUserId,

  signInWithEmail,

  signOut,

  signUpWithEmail,

} from './auth.js';

import {

  apiHealth,

  apiLoadProfile,

  apiSetPlatformId,

  apiListMyClubs,

  apiCreateClub,

} from './api.js';



const $ = (sel, root = document) => root.querySelector(sel);

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];



let activeTab = 'home';

let panelOpen = false;

let backendOk = null;

/** @type {object|null} */

let profile = null;

/** @type {Array<object>} */

let myClubs = [];

let clubsLoading = false;

let createClubOpen = false;



function renderAdSlot(id) {

  if (!PLATFORM.adsEnabled) return '';

  if (PLATFORM.adSlotDebug) {

    return `<div class="ad-slot ad-slot--debug" data-ad-slot="${id}" aria-hidden="true">광고 ${id}</div>`;

  }

  return `<div class="ad-slot" data-ad-slot="${id}"></div>`;

}



function formatTime(ts) {

  const d = new Date(ts);

  const now = new Date();

  const sameDay = d.toDateString() === now.toDateString();

  if (sameDay) {

    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  }

  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

}



function slugify(name) {

  return String(name || '')

    .trim()

    .toLowerCase()

    .replace(/[^a-z0-9]+/g, '-')

    .replace(/^-+|-+$/g, '')

    .slice(0, 30) || 'my-club';

}



function isValidPlatformId(id) {

  return /^[a-z][a-z0-9]{3,15}$/.test(id);

}



function roleLabel(role) {

  const map = { owner: '구단주', admin: '관리자', treasurer: '총무', member: '멤버' };

  return map[role] || role;

}



async function refreshSessionData() {

  const uid = getUserId();

  if (!uid) {

    profile = null;

    myClubs = [];

    await refreshNotifications();

    return;

  }

  try {

    const [p, clubs] = await Promise.all([

      apiLoadProfile(uid),

      apiListMyClubs(uid),

    ]);

    profile = p;

    myClubs = clubs || [];

  } catch {

    profile = null;

    myClubs = [];

  }

  await refreshNotifications();

  updateBadge();

}



function renderNotificationPanel() {

  const list = getNotifications();

  const empty = list.length === 0;

  return `

    <div class="notif-panel ${panelOpen ? 'is-open' : ''}" id="notifPanel" role="dialog" aria-label="알림">

      <div class="notif-panel__head">

        <strong>알림</strong>

        <button type="button" class="btn-icon" id="notifClose" aria-label="닫기">✕</button>

      </div>

      <ul class="notif-list">

        ${empty ? '<li class="notif-empty">알림이 없습니다.</li>' : list.map((n) => `

          <li class="notif-item ${n.readAt ? 'is-read' : 'is-unread'}" data-id="${n.id}">

            <button type="button" class="notif-item__body">

              <span class="notif-item__title">${escapeHtml(n.title)}</span>

              <span class="notif-item__text">${escapeHtml(n.body)}</span>

              <span class="notif-item__time">${formatTime(n.createdAt)}</span>

            </button>

            <button type="button" class="notif-item__delete" aria-label="삭제">✕</button>

          </li>

        `).join('')}

      </ul>

    </div>

    <div class="notif-backdrop ${panelOpen ? 'is-open' : ''}" id="notifBackdrop"></div>

  `;

}



function escapeHtml(s) {

  return String(s || '')

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;');

}



function updateBadge() {

  const badge = $('#notifBadge');

  if (!badge) return;

  const n = unreadCount();

  badge.textContent = n > 99 ? '99+' : String(n);

  badge.hidden = n === 0;

}



function mountNotificationUI() {

  const host = $('#notifHost');

  if (!host) return;

  host.innerHTML = renderNotificationPanel();

  updateBadge();



  $('#notifBell')?.addEventListener('click', () => {

    panelOpen = !panelOpen;

    mountNotificationUI();

  });

  $('#notifClose')?.addEventListener('click', () => {

    panelOpen = false;

    mountNotificationUI();

  });

  $('#notifBackdrop')?.addEventListener('click', () => {

    panelOpen = false;

    mountNotificationUI();

  });



  $$('.notif-item__body', host).forEach((btn) => {

    btn.addEventListener('click', async () => {

      const id = btn.closest('.notif-item')?.dataset.id;

      if (!id) return;

      const item = getNotifications().find((x) => x.id === id);

      await markRead(id);

      panelOpen = false;

      if (item?.payload?.tab) setTab(item.payload.tab);

      mountNotificationUI();

      renderMain();

    });

  });



  $$('.notif-item__delete', host).forEach((btn) => {

    btn.addEventListener('click', async (e) => {

      e.stopPropagation();

      const id = btn.closest('.notif-item')?.dataset.id;

      if (id) await removeNotification(id);

      mountNotificationUI();

    });

  });

}



function setTab(tab) {

  activeTab = tab;

  $$('.nav-tab').forEach((el) => {

    el.classList.toggle('is-active', el.dataset.tab === tab);

  });

  renderMain();

}



function renderHome() {

  const notes = getNotifications().filter((n) => !n.readAt).slice(0, 3);

  const clubHint = myClubs.length

    ? `${myClubs.length}개 구단에 소속되어 있습니다.`

    : '구단을 만들거나 가입하면 활동 요약이 표시됩니다.';

  return `

    <section class="page-section">

      <h1 class="page-title">안녕하세요</h1>

      <p class="page-muted">개인 활동·일정 허브 (§5-1 홈)</p>

      ${backendOk === false ? '<p class="page-warn">DB 연결 확인 필요 — config.js · Exposed tables</p>' : ''}

    </section>

    <section class="card">

      <h2 class="card__title">내 활동 요약</h2>

      <p class="page-muted">${clubHint}</p>

    </section>

    <section class="card">

      <h2 class="card__title">다가오는 일정</h2>

      <p class="page-muted">확정 매칭·구단 일정 (연동 예정)</p>

    </section>

    <section class="card">

      <h2 class="card__title">알림</h2>

      ${notes.length ? `<ul class="simple-list">${notes.map((n) => `<li>${escapeHtml(n.title)}</li>`).join('')}</ul>` : '<p class="page-muted">새 알림 없음</p>'}

      <button type="button" class="btn-text" id="openNotifFromHome">알림 전체 보기</button>

    </section>

    ${renderAdSlot('AD_HOME_FOOTER')}

  `;

}



function renderMatching() {

  if (!getUserId()) {

    return `

      <section class="page-section">

        <h1 class="page-title">매칭</h1>

        <p class="page-muted">로그인 후 팀 간 경기 공고·신청을 이용할 수 있습니다.</p>

        <button type="button" class="btn btn--primary" id="goLoginFromMatching">내 정보에서 로그인</button>

      </section>

      <p class="legal-hint">활약점·랭킹은 플랫폼 비공식 지표입니다. (LG02)</p>

    `;

  }

  return `

    <section class="page-section">

      <h1 class="page-title">매칭</h1>

      <p class="page-muted">구단 연동 후 공고·신청 (MK08~, 다음 단계)</p>

    </section>

    <div class="filter-row">

      <span class="chip">지역 전체</span>

      <span class="chip">모집중</span>

    </div>

    <div class="match-grid">

      <article class="match-card match-card--demo">

        <h3>데모 공고 (UI만)</h3>

        <p>6/20 (토) 14:00 · 잠실 보조경기장 · 서울</p>

        <p class="match-card__meta">Supabase matching_posts 연동 예정</p>

      </article>

      ${renderAdSlot('AD_MATCH_INLINE')}

    </div>

    ${renderAdSlot('AD_MATCH_FOOTER')}

    <p class="legal-hint">매칭은 중개만 제공합니다. 일정·장소 책임은 구단에 있습니다. (LG01)</p>

  `;

}



function initSideRails() {

  if (!PLATFORM.adsEnabled && !PLATFORM.adSlotDebug) return;

  ['adRailLeft', 'adRailRight'].forEach((id, i) => {

    const el = document.getElementById(id);

    if (!el) return;

    const slotId = i === 0 ? 'AD_RAIL_LEFT' : 'AD_RAIL_RIGHT';

    if (PLATFORM.adSlotDebug) {

      el.classList.add('ad-slot', 'ad-slot--debug');

      el.textContent = `광고 ${slotId}`;

      el.setAttribute('aria-hidden', 'false');

    }

  });

}



function renderClubs() {

  if (!getUserId()) {

    return `

      <section class="page-section">

        <h1 class="page-title">내 구단</h1>

        <p class="page-muted">로그인 후 소속 구단을 확인하고 새 구단을 만들 수 있습니다.</p>

        <button type="button" class="btn btn--primary" id="goLoginFromClubs">로그인하기</button>

      </section>

    `;

  }



  const list = myClubs.length

    ? myClubs.map((c) => `

        <section class="card club-card">

          <div class="club-card__thumb">${escapeHtml(c.name.slice(0, 2))}</div>

          <div>

            <h3>${escapeHtml(c.name)}</h3>

            <p class="page-muted">${escapeHtml(c.region)} · ${roleLabel(c.role)}</p>

            <a class="btn btn--primary" href="club/index.html?slug=${encodeURIComponent(c.slug)}" target="_blank" rel="noopener">홈피 가기</a>

          </div>

        </section>

      `).join('')

    : '<p class="page-muted">아직 소속 구단이 없습니다. 아래에서 만들 수 있습니다.</p>';



  const createForm = createClubOpen

    ? `

      <section class="card" id="createClubForm">

        <h2 class="card__title">새 구단 만들기</h2>

        <div class="form-row">

          <label class="form-label">구단명</label>

          <input class="form-input" id="clubName" type="text" placeholder="예: FC 블루" maxlength="40">

        </div>

        <div class="form-row">

          <label class="form-label">URL 주소 (slug)</label>

          <input class="form-input" id="clubSlug" type="text" placeholder="예: fc-blue" maxlength="30">

          <span class="form-hint">영문 소문자·숫자·하이픈 (3~30자)</span>

        </div>

        <div class="form-row">

          <label class="form-label">지역</label>

          <input class="form-input" id="clubRegion" type="text" placeholder="예: 서울" maxlength="20">

        </div>

        <div class="btn-row">

          <button type="button" class="btn btn--primary" id="btnCreateClub">만들기</button>

          <button type="button" class="btn btn--outline" id="btnCancelCreate">취소</button>

        </div>

        <p class="page-muted" id="clubMsg" aria-live="polite"></p>

      </section>

    `

    : '';



  return `

    <section class="page-section">

      <h1 class="page-title">내 구단</h1>

      ${clubsLoading ? '<p class="page-muted">불러오는 중...</p>' : ''}

    </section>

    ${list}

    ${createForm}

    <button type="button" class="btn btn--outline btn--block" id="btnToggleCreate">${createClubOpen ? '닫기' : '+ 구단 만들기'}</button>

  `;

}



function renderProfile() {

  const session = getSession();

  const email = session?.user?.email || session?.user?.new_email || null;

  const pid = profile?.platform_id;

  const verified = profile?.verified_at;



  const platformBlock = session

    ? pid

      ? `<p><strong>플랫폼 ID</strong> — <code>${escapeHtml(pid)}</code> <span class="tag">변경 불가 (M02)</span></p>`

      : `

        <div class="form-row">

          <label class="form-label">플랫폼 ID (1회 설정, M02)</label>

          <input class="form-input" id="platformIdInput" type="text" placeholder="예: fcblue99" maxlength="16" autocomplete="username">

          <span class="form-hint">영문 소문자+숫자, 4~16자, 첫 글자 영문</span>

        </div>

        <button type="button" class="btn btn--primary" id="btnSavePlatformId">ID 저장</button>

        <p class="page-muted" id="platformIdMsg" aria-live="polite"></p>

      `

    : '';



  return `

    <section class="page-section">

      <h1 class="page-title">내 정보</h1>

    </section>

    <section class="card">

      <p class="page-muted">본인인증 · Pro 구독 · 초대 (M03, PY09)</p>



      ${

        session

          ? `

            <p><strong>로그인</strong> — ${escapeHtml(email || '(이메일)')}</p>

            <p><strong>본인인증</strong> — ${verified ? `완료 (${formatTime(new Date(verified).getTime())})` : '미완료 · 구단 생성·가입 전 필요 (M03)'}</p>

            ${platformBlock}

            <button type="button" class="btn btn--outline" id="btnLogout">로그아웃</button>

          `

          : `

            <div class="form-row">

              <label class="form-label">이메일</label>

              <input class="form-input" id="authEmail" type="email" autocomplete="email" placeholder="you@example.com">

            </div>

            <div class="form-row">

              <label class="form-label">비밀번호</label>

              <input class="form-input" id="authPassword" type="password" autocomplete="current-password" placeholder="8자 이상">

            </div>

            <div class="btn-row">

              <button type="button" class="btn btn--primary" id="btnLogin">로그인</button>

              <button type="button" class="btn btn--outline" id="btnSignup">회원가입</button>

            </div>

            <p class="page-muted" id="authMsg" aria-live="polite"></p>

          `

      }



      <button type="button" class="btn-text" id="openNotifFromProfile">알림 전체 보기</button>

    </section>

  `;

}



function renderMain() {

  const main = $('#main');

  if (!main) return;

  const map = {

    home: renderHome,

    matching: renderMatching,

    clubs: renderClubs,

    profile: renderProfile,

  };

  main.innerHTML = (map[activeTab] || renderHome)();



  $('#openNotifFromHome')?.addEventListener('click', () => {

    panelOpen = true;

    mountNotificationUI();

  });

  $('#openNotifFromProfile')?.addEventListener('click', () => {

    panelOpen = true;

    mountNotificationUI();

  });

  $('#goLoginFromMatching')?.addEventListener('click', () => setTab('profile'));

  $('#goLoginFromClubs')?.addEventListener('click', () => setTab('profile'));



  if (activeTab === 'profile') initProfileAuth();

  if (activeTab === 'clubs') initClubsActions();

}



function initClubsActions() {

  $('#btnToggleCreate')?.addEventListener('click', () => {

    createClubOpen = !createClubOpen;

    renderMain();

  });

  $('#btnCancelCreate')?.addEventListener('click', () => {

    createClubOpen = false;

    renderMain();

  });



  $('#clubName')?.addEventListener('input', (e) => {

    const slugEl = $('#clubSlug');

    if (slugEl && !slugEl.dataset.touched) {

      slugEl.value = slugify(e.target.value);

    }

  });

  $('#clubSlug')?.addEventListener('input', () => {

    const slugEl = $('#clubSlug');

    if (slugEl) slugEl.dataset.touched = '1';

  });



  $('#btnCreateClub')?.addEventListener('click', async () => {

    const msg = $('#clubMsg');

    const name = $('#clubName')?.value?.trim();

    const slug = ($('#clubSlug')?.value?.trim() || slugify(name)).toLowerCase();

    const region = $('#clubRegion')?.value?.trim() || '미정';

    if (!name) {

      if (msg) msg.textContent = '구단명을 입력해 주세요.';

      return;

    }

    if (!/^[a-z][a-z0-9-]{2,30}$/.test(slug)) {

      if (msg) msg.textContent = 'slug는 영문 소문자로 시작, 3~30자 (a-z, 0-9, -)';

      return;

    }

    if (msg) msg.textContent = '생성 중...';

    try {

      await apiCreateClub({ slug, name, region });

      createClubOpen = false;

      clubsLoading = true;

      renderMain();

      await refreshSessionData();

      clubsLoading = false;

      setTab('clubs');

    } catch (e) {

      if (msg) {

        msg.textContent = e.message.includes('create_club')

          ? 'RPC 미설치 — Supabase에서 rpc-create-club.sql 실행 필요'

          : `실패: ${e.message}`;

      }

    }

  });

}



function initProfileAuth() {

  const msg = $('#authMsg');



  $('#btnLogout')?.addEventListener('click', async () => {

    await signOut();

    profile = null;

    myClubs = [];

    await refreshNotifications();

    mountNotificationUI();

    renderMain();

  });



  $('#btnSavePlatformId')?.addEventListener('click', async () => {

    const uid = getUserId();

    const pidMsg = $('#platformIdMsg');

    const raw = $('#platformIdInput')?.value?.trim().toLowerCase();

    if (!uid || !raw) {

      if (pidMsg) pidMsg.textContent = 'ID를 입력해 주세요.';

      return;

    }

    if (!isValidPlatformId(raw)) {

      if (pidMsg) pidMsg.textContent = '4~16자, 영문 소문자+숫자, 첫 글자 영문 (M02)';

      return;

    }

    if (pidMsg) pidMsg.textContent = '저장 중...';

    try {

      await apiSetPlatformId(uid, raw);

      profile = await apiLoadProfile(uid);

      if (pidMsg) pidMsg.textContent = '저장되었습니다.';

      renderMain();

    } catch (e) {

      if (pidMsg) pidMsg.textContent = e.message.includes('duplicate')

        ? '이미 사용 중인 ID입니다.'

        : `저장 실패: ${e.message}`;

    }

  });



  $('#btnLogin')?.addEventListener('click', async () => {

    const email = $('#authEmail')?.value?.trim();

    const password = $('#authPassword')?.value || '';

    if (!email || !password) {

      if (msg) msg.textContent = '이메일/비밀번호를 입력해 주세요.';

      return;

    }

    if (msg) msg.textContent = '로그인 중...';

    const r = await signInWithEmail(email, password);

    if (!r.ok) {

      if (msg) msg.textContent = `로그인 실패 (${r.status})`;

      return;

    }

    await refreshSessionData();

    mountNotificationUI();

    renderMain();

  });



  $('#btnSignup')?.addEventListener('click', async () => {

    const email = $('#authEmail')?.value?.trim();

    const password = $('#authPassword')?.value || '';

    if (!email || !password) {

      if (msg) msg.textContent = '이메일/비밀번호를 입력해 주세요.';

      return;

    }

    if (msg) msg.textContent = '회원가입 중...';

    const r = await signUpWithEmail(email, password);

    if (!r.ok) {

      if (msg) msg.textContent = `회원가입 실패 (${r.status})`;

      return;

    }

    if (r.needsEmailConfirm) {

      if (msg) msg.textContent = '메일함에서 인증을 완료한 뒤 로그인해 주세요.';

      return;

    }

    await refreshSessionData();

    mountNotificationUI();

    renderMain();

  });

}



function initNav() {

  $$('.nav-tab').forEach((el) => {

    el.addEventListener('click', () => setTab(el.dataset.tab));

  });

}



async function init() {

  document.title = PLATFORM.name;

  initSideRails();

  initNav();



  const health = await apiHealth();

  backendOk = health.ok;



  await refreshSessionData();

  mountNotificationUI();

  renderMain();

}



init();


