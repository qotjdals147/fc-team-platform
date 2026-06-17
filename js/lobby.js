import { PLATFORM } from './config.js';
import {
  getNotifications,
  unreadCount,
  markRead,
  removeNotification,
} from './notifications.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let activeTab = 'home';
let panelOpen = false;

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
              <span class="notif-item__title">${n.title}</span>
              <span class="notif-item__text">${n.body}</span>
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
    btn.addEventListener('click', () => {
      const id = btn.closest('.notif-item')?.dataset.id;
      if (!id) return;
      const item = getNotifications().find((x) => x.id === id);
      markRead(id);
      panelOpen = false;
      if (item?.payload?.tab) setTab(item.payload.tab);
      mountNotificationUI();
      renderMain();
    });
  });

  $$('.notif-item__delete', host).forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.notif-item')?.dataset.id;
      if (id) removeNotification(id);
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
  return `
    <section class="page-section">
      <h1 class="page-title">안녕하세요</h1>
      <p class="page-muted">개인 활동·일정 허브 (§5-1 홈)</p>
    </section>
    <section class="card">
      <h2 class="card__title">내 활동 요약</h2>
      <p class="page-muted">구단 연결 후 출전·골·MOM이 여기에 표시됩니다.</p>
    </section>
    <section class="card">
      <h2 class="card__title">다가오는 일정</h2>
      <p class="page-muted">확정 매칭·구단 일정 (연동 예정)</p>
    </section>
    <section class="card">
      <h2 class="card__title">알림</h2>
      ${notes.length ? `<ul class="simple-list">${notes.map((n) => `<li>${n.title}</li>`).join('')}</ul>` : '<p class="page-muted">새 알림 없음</p>'}
      <button type="button" class="btn-text" id="openNotifFromHome">알림 전체 보기</button>
    </section>
    ${renderAdSlot('AD_HOME_FOOTER')}
  `;
}

function renderMatching() {
  return `
    <section class="page-section">
      <h1 class="page-title">매칭</h1>
      <p class="page-muted">로그인·구단 연동 후 공고·신청 (MK08~)</p>
    </section>
    <div class="filter-row">
      <span class="chip">지역 전체</span>
      <span class="chip">모집중</span>
    </div>
    <div class="match-grid">
      <article class="match-card">
        <h3>서울 FC</h3>
        <p>6/20 (토) 14:00 · 잠실 보조경기장 · 서울</p>
        <p class="match-card__meta">현재 2팀이 신청했어요</p>
      </article>
      <article class="match-card">
        <h3>강남 유나이티드</h3>
        <p>6/22 (월) 20:00 · 강남 풋살장 · 서울</p>
        <p class="match-card__meta">현재 0팀이 신청했어요</p>
      </article>
      <article class="match-card">
        <h3>분당 FC</h3>
        <p>6/25 (목) 19:00 · 분당 풋살파크 · 경기</p>
        <p class="match-card__meta">현재 1팀이 신청했어요</p>
      </article>
      <article class="match-card">
        <h3>인천 블루윙즈</h3>
        <p>6/28 (일) 10:00 · 인천 축구센터 · 인천</p>
        <p class="match-card__meta">현재 0팀이 신청했어요</p>
      </article>
      ${renderAdSlot('AD_MATCH_INLINE')}
    </div>
    ${renderAdSlot('AD_MATCH_FOOTER')}
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
  return `
    <section class="page-section">
      <h1 class="page-title">내 구단</h1>
    </section>
    <section class="card club-card">
      <div class="club-card__thumb">FC</div>
      <div>
        <h3>데모 FC</h3>
        <p class="page-muted">서울 · 구단주</p>
        <a class="btn btn--primary" href="club/index.html?slug=demo-fc" target="_blank" rel="noopener">홈피 가기</a>
      </div>
    </section>
    <button type="button" class="btn btn--outline btn--block">+ 구단 만들기</button>
  `;
}

function renderProfile() {
  return `
    <section class="page-section">
      <h1 class="page-title">내 정보</h1>
    </section>
    <section class="card">
      <p><strong>플랫폼 ID</strong> — (로그인 연동 예정)</p>
      <p class="page-muted">본인인증 · Pro 구독 · 초대 (M03, PY09)</p>
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
}

function initNav() {
  $$('.nav-tab').forEach((el) => {
    el.addEventListener('click', () => setTab(el.dataset.tab));
  });
}

function init() {
  document.title = PLATFORM.name;
  initSideRails();
  initNav();
  mountNotificationUI();
  renderMain();
}

init();
