import { PLATFORM } from './config.js';

import {

  getNotifications,

  unreadCount,

  markRead,

  removeNotification,

  refreshNotifications,

  onNotificationsUpdated,

  syncNotificationsRealtime,

  stopNotificationsRealtime,

} from './notifications.js?v=2';

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

import {

  canManageMembers,

  canChangeRoles,

  canToggleRecruiting,

  canLeaveClub,

  canKickMember,

  loadClubPanel,

  loadMyInvitations,

  loadRecruitingClubs,

  inviteMember,

  respondInvite,

  setRecruiting,

  applyClub,

  respondApp,

  changeMemberRole,

  leaveClub,

  kickMember,

  memberLabel,

  rpcErrorMessage,

} from './members.js';

import {

  staffClubs,

  loadOpenPosts,

  loadPostDetail,

  createPost,

  applyToPost,

  respondApplication,

  formatMatchWhen,

  statusLabel,

  rpcMatchingError,

} from './matching.js?v=1';

import {
  mountLineupPickerForCreate,
  mountLineupPickerForApply,
  saveLineupBeforePost,
  lineupIsReady,
  lineupValidationMessage,
} from './lineup-picker.js';

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

let manageClubId = null;

let clubPanel = null;

let clubPanelLoading = false;

let myInvitations = [];

let recruitingClubs = [];

let showRecruitingList = false;

let memberMsg = '';

let matchingPosts = [];

let matchingLoading = false;

let matchingMsg = '';

let matchingRegionFilter = '';

let matchingPostId = null;

let matchingDetail = null;

let matchingDetailLoading = false;

let createMatchingOpen = false;



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

    stopNotificationsRealtime();

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

    myInvitations = await loadMyInvitations();

  } catch {

    profile = null;

    myClubs = [];

    myInvitations = [];

  }

  await refreshNotifications();

  await syncNotificationsRealtime();

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

          <li class="notif-item ${n.readAt ? 'is-read' : 'is-unread'}" data-id="${n.id}" data-type="${escapeHtml(n.type)}">

            <div class="notif-item__wrap" style="flex:1">

            <button type="button" class="notif-item__body">

              <span class="notif-item__title">${escapeHtml(n.title)}</span>

              <span class="notif-item__text">${escapeHtml(n.body)}</span>

              <span class="notif-item__time">${formatTime(n.createdAt)}</span>

            </button>

            ${n.type === 'club_invite' && !n.readAt && n.payload?.invitation_id ? `

              <div class="notif-actions">

                <button type="button" class="btn btn--primary" data-invite-action="accept" data-invite-id="${n.payload.invitation_id}">수락</button>

                <button type="button" class="btn btn--outline" data-invite-action="decline" data-invite-id="${n.payload.invitation_id}">거절</button>

              </div>

            ` : ''}

            </div>

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



  $$('[data-invite-action]', host).forEach((btn) => {

    btn.addEventListener('click', async (e) => {

      e.stopPropagation();

      const id = btn.dataset.inviteId;

      const accept = btn.dataset.inviteAction === 'accept';

      if (!id) return;

      btn.disabled = true;

      try {

        await respondInvite(Number(id), accept);

        const notifId = btn.closest('.notif-item')?.dataset.id;

        if (notifId) await markRead(notifId);

        panelOpen = false;

        await refreshSessionData();

        mountNotificationUI();

        renderMain();

      } catch (err) {

        alert(rpcErrorMessage(err));

        btn.disabled = false;

      }

    });

  });

}



function setTab(tab) {

  activeTab = tab;

  $$('.nav-tab').forEach((el) => {

    el.classList.toggle('is-active', el.dataset.tab === tab);

  });

  if (tab === 'matching') {

    matchingPostId = null;

    matchingDetail = null;

    createMatchingOpen = false;

    loadMatchingList();

  }

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



async function loadMatchingList() {

  if (!getUserId()) return;

  matchingLoading = true;

  matchingMsg = '';

  renderMain();

  try {

    matchingPosts = await loadOpenPosts(matchingRegionFilter);

  } catch (e) {

    matchingPosts = [];

    matchingMsg = rpcMatchingError(e);

  }

  matchingLoading = false;

  renderMain();

}



async function openMatchingDetail(postId) {

  matchingPostId = postId;

  matchingDetail = null;

  matchingDetailLoading = true;

  matchingMsg = '';

  renderMain();

  try {

    matchingDetail = await loadPostDetail(postId);

  } catch (e) {

    matchingMsg = rpcMatchingError(e);

    matchingPostId = null;

  }

  matchingDetailLoading = false;

  renderMain();

}



function renderMatchingCreate(staff) {

  const clubOptions = staff.map((c) =>

    `<option value="${c.id}" ${staff.length === 1 ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.region)})</option>`,

  ).join('');

  const defaultRegion = staff[0]?.region || '';

  return `

    <section class="page-section">

      <button type="button" class="btn-text" id="matchingBackToList">← 목록</button>

      <h1 class="page-title">매칭 공고 올리기</h1>

      <p class="page-muted">구단 홈에서 저장한 포메이션을 선택해 등록합니다. (MK18)</p>

    </section>

    <section class="card">

      <div class="form-row">

        <label class="form-label">구단</label>

        <select class="form-input" id="matchCreateClub">${clubOptions}</select>

      </div>

      <div class="form-row">

        <label class="form-label">경기 일시</label>

        <input class="form-input" type="datetime-local" id="matchCreateWhen">

      </div>

      <div class="form-row">

        <label class="form-label">장소</label>

        <input class="form-input" type="text" id="matchCreatePlace" placeholder="잠실 보조경기장">

      </div>

      <div class="form-row">

        <label class="form-label">지역 (시/도)</label>

        <input class="form-input" type="text" id="matchCreateRegion" value="${escapeHtml(defaultRegion)}" placeholder="서울">

      </div>

    </section>

    <section class="card">

      <h2 class="card__title">포메이션 선택</h2>

      <div id="matchLineupPicker"><p class="page-muted">로딩…</p></div>

    </section>

    <section class="card">

      <div class="btn-row">

        <button type="button" class="btn btn--primary" id="btnSubmitMatchingPost">공고 등록</button>

        <button type="button" class="btn btn--outline" id="btnCancelMatchingPost">취소</button>

      </div>

      ${matchingMsg ? `<p class="page-warn">${escapeHtml(matchingMsg)}</p>` : ''}

    </section>

    <p class="legal-hint">매칭은 중개만 제공합니다. 일정·장소 책임은 구단에 있습니다. (LG01)</p>

  `;

}



function renderMatchingDetailView() {

  if (matchingDetailLoading) {

    return '<p class="page-muted">불러오는 중...</p>';

  }

  if (!matchingDetail?.post) {

    return `<p class="page-warn">${escapeHtml(matchingMsg || '공고를 찾을 수 없습니다.')}</p>`;

  }

  const { post, applications } = matchingDetail;

  const host = post.clubs || {};

  const myStaff = staffClubs(myClubs);

  const isHostStaff = myStaff.some((c) => c.id === post.host_club_id);

  const canApply = myStaff.filter((c) => c.id !== post.host_club_id);

  const pendingApps = applications.filter((a) => a.status === 'pending');

  const appRows = isHostStaff && pendingApps.length

    ? pendingApps.map((a) => {

        const ac = a.clubs || {};

        return `

          <div class="app-card" data-match-app-id="${a.id}">

            <strong>${escapeHtml(ac.name || '구단')}</strong>

            <p class="app-card__meta">${formatMatchWhen(a.created_at)} 신청</p>

            <div class="btn-row">

              <button type="button" class="btn btn--primary btn--sm" data-match-accept="${a.id}">승인 (MK03)</button>

              <button type="button" class="btn btn--outline btn--sm" data-match-reject="${a.id}">거절</button>

            </div>

          </div>

        `;

      }).join('')

    : isHostStaff ? '<p class="page-muted">대기 중인 신청 없음</p>' : '';



  const applyBlock = !isHostStaff && canApply.length && post.status !== 'matched'

    ? `

      <div class="form-row">

        <label class="form-label">신청 구단</label>

        <select class="form-input" id="matchApplyClub">

          ${canApply.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}

        </select>

      </div>

      <div class="form-row">

        <label class="form-label">포메이션 선택</label>

        <div id="matchApplyLineupPicker"><p class="page-muted">로딩…</p></div>

      </div>

      <button type="button" class="btn btn--primary" id="btnApplyMatching">매칭 신청 (MK02)</button>

      <p class="page-muted">구단 홈에서 저장한 포메이션만 선택할 수 있습니다. (MK20)</p>

    `

    : !isHostStaff && !canApply.length

      ? '<p class="page-muted">신청하려면 owner/admin 역할의 구단이 필요합니다.</p>'

      : '';



  return `

    <section class="page-section">

      <button type="button" class="btn-text" id="matchingBackToList">← 목록</button>

      <h1 class="page-title">${escapeHtml(host.name || '매칭 공고')}</h1>

      <p class="page-muted">${escapeHtml(post.region)} · ${statusLabel(post.status)}</p>

    </section>

    <section class="card">

      <p><strong>${formatMatchWhen(post.scheduled_at)}</strong></p>

      <p>${escapeHtml(post.place)}</p>

      <p class="match-card__meta">현재 ${pendingApps.length}팀 신청 (MK13)</p>

      ${matchingMsg ? `<p class="page-warn">${escapeHtml(matchingMsg)}</p>` : ''}

      ${applyBlock}

    </section>

    ${isHostStaff ? `<section class="card"><h2 class="card__title">신청 목록</h2>${appRows}</section>` : ''}

    <p class="legal-hint">매칭은 중개만 제공합니다. (LG01)</p>

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



  const staff = staffClubs(myClubs);



  if (createMatchingOpen && staff.length) {

    return renderMatchingCreate(staff);

  }



  if (matchingPostId) {

    return `

      <div id="matchingDetailRoot">${renderMatchingDetailView()}</div>

    `;

  }



  const regions = [...new Set(matchingPosts.map((p) => p.region).filter(Boolean))];

  const filterChips = [

    `<button type="button" class="chip chip--btn ${!matchingRegionFilter ? 'is-active' : ''}" data-match-region="">전체</button>`,

    ...regions.map((r) =>

      `<button type="button" class="chip chip--btn ${matchingRegionFilter === r ? 'is-active' : ''}" data-match-region="${escapeHtml(r)}">${escapeHtml(r)}</button>`,

    ),

  ].join('');



  const cards = matchingPosts.length

    ? matchingPosts.map((p) => {

        const host = p.clubs || {};

        return `

          <article class="match-card" data-match-post="${p.id}">

            <h3>${escapeHtml(host.name || '구단')}</h3>

            <p>${formatMatchWhen(p.scheduled_at)} · ${escapeHtml(p.place)}</p>

            <p class="page-muted">${escapeHtml(p.region)}</p>

            <p class="match-card__meta">${p.pendingCount || 0}팀 신청 · ${statusLabel(p.status)}</p>

          </article>

        `;

      }).join('')

    : matchingLoading

      ? ''

      : '<p class="page-muted">모집 중인 공고가 없습니다.</p>';



  return `

    <section class="page-section">

      <h1 class="page-title">매칭</h1>

      <p class="page-muted">팀 간 경기 공고 · 신청 · 승인 (MK01~03)</p>

      ${staff.length ? '<button type="button" class="btn btn--primary" id="btnOpenMatchingCreate">공고 올리기</button>' : '<p class="page-muted">공고는 구단 owner/admin만 올릴 수 있습니다.</p>'}

    </section>

    <div class="filter-row">${filterChips}</div>

    ${matchingMsg ? `<p class="page-warn">${escapeHtml(matchingMsg)}</p>` : ''}

    ${matchingLoading ? '<p class="page-muted">공고 불러오는 중...</p>' : ''}

    <div class="match-grid">${cards}${!matchingLoading && matchingPosts.length ? renderAdSlot('AD_MATCH_INLINE') : ''}</div>

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



function renderMemberPanel(club) {

  if (!clubPanel || clubPanel.detail?.id !== club.id) {

    return clubPanelLoading ? '<p class="page-muted">멤버 불러오는 중...</p>' : '';

  }

  const { detail, members, applications } = clubPanel;

  const canManage = canManageMembers(club.role);

  const canRoles = canChangeRoles(club.role);

  const canRecruit = canToggleRecruiting(club.role);

  const uid = getUserId();



  const memberRows = members.map((m) => {

    const label = memberLabel(m);

    const isOwner = m.role === 'owner';

    const roleSelect = canRoles && !isOwner && m.user_id !== uid

      ? `<select class="member-role-select" data-member-role data-user-id="${m.user_id}">

          <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>관리자</option>

          <option value="treasurer" ${m.role === 'treasurer' ? 'selected' : ''}>총무</option>

          <option value="member" ${m.role === 'member' ? 'selected' : ''}>멤버</option>

        </select>`

      : `<span class="tag">${roleLabel(m.role)}</span>`;

    const kickBtn = canKickMember(club.role, m.role, uid, m.user_id)

      ? `<button type="button" class="btn btn--outline btn--sm" data-kick-member data-club-id="${club.id}" data-user-id="${m.user_id}">강퇴</button>`

      : '';

    return `<li class="member-list__row"><span>${escapeHtml(label)}</span><span class="member-list__actions">${roleSelect}${kickBtn}</span></li>`;

  }).join('');



  const appRows = canManage && applications.length

    ? applications.map((a) => `

        <div class="card app-card" data-app-id="${a.id}">

          <strong>${escapeHtml(memberLabel(a))}</strong>

          <p class="app-card__meta">${escapeHtml(a.message || '메시지 없음')}</p>

          <div class="btn-row">

            <button type="button" class="btn btn--primary btn--sm" data-app-approve="${a.id}">승인</button>

            <button type="button" class="btn btn--outline btn--sm" data-app-reject="${a.id}">거절</button>

          </div>

        </div>

      `).join('')

    : canManage ? '<p class="page-muted">대기 중인 가입 신청 없음</p>' : '';



  const manageBlock = canManage ? `

    <div class="member-panel">

      <div class="member-panel__head"><strong>멤버 (${members.length})</strong></div>

      <ul class="member-list">${memberRows || '<li class="page-muted">멤버 없음</li>'}</ul>



      <div class="member-panel__head" style="margin-top:12px"><strong>초대 (M08)</strong></div>

      <div class="invite-row">

        <input class="form-input" id="invitePlatformId" type="text" placeholder="플랫폼 ID" maxlength="16">

        <select class="member-role-select" id="inviteRole">

          <option value="member">멤버</option>

          <option value="admin">관리자</option>

          <option value="treasurer">총무</option>

        </select>

        <button type="button" class="btn btn--primary" id="btnSendInvite" data-club-id="${club.id}">초대</button>

      </div>



      ${canRecruit ? `

        <div class="toggle-row">

          <label><input type="checkbox" id="recruitingToggle" data-club-id="${club.id}" ${detail?.recruiting ? 'checked' : ''}> 모집중 (M09)</label>

        </div>

      ` : ''}



      ${applications.length || canManage ? `

        <div class="member-panel__head" style="margin-top:12px"><strong>가입 신청</strong></div>

        ${appRows}

      ` : ''}

    </div>

  ` : '';



  return manageBlock;

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



  const inviteBlock = myInvitations.length ? `

    <section class="card">

      <h2 class="card__title">받은 초대</h2>

      ${myInvitations.map((inv) => `

        <div class="app-card" data-invite-card="${inv.id}">

          <strong>${escapeHtml(inv.clubs?.name || '구단')}</strong>

          <p class="app-card__meta">역할: ${roleLabel(inv.role || 'member')}</p>

          <div class="btn-row">

            <button type="button" class="btn btn--primary btn--sm" data-invite-accept="${inv.id}">수락</button>

            <button type="button" class="btn btn--outline btn--sm" data-invite-decline="${inv.id}">거절</button>

          </div>

        </div>

      `).join('')}

    </section>

  ` : '';



  const list = myClubs.length

    ? myClubs.map((c) => `

        <section class="card club-card" data-club-id="${c.id}">

          <div class="club-card__thumb">${escapeHtml(c.name.slice(0, 2))}</div>

          <div style="flex:1">

            <h3>${escapeHtml(c.name)}</h3>

            <p class="page-muted">${escapeHtml(c.region)} · ${roleLabel(c.role)}</p>

            <div class="btn-row">

              <a class="btn btn--primary" href="club/index.html?slug=${encodeURIComponent(c.slug)}" target="_blank" rel="noopener">홈피 가기</a>

              ${canManageMembers(c.role) ? `<button type="button" class="btn btn--outline" data-manage-club="${c.id}">${manageClubId === c.id ? '멤버 관리 닫기' : '멤버 관리'}</button>` : ''}

              ${canLeaveClub(c.role) ? `<button type="button" class="btn btn--outline" data-leave-club="${c.id}">구단 탈퇴</button>` : ''}

            </div>

            ${manageClubId === c.id ? renderMemberPanel(c) : ''}

          </div>

        </section>

      `).join('')

    : '<p class="page-muted">아직 소속 구단이 없습니다. 아래에서 만들거나 모집 중인 구단에 신청하세요.</p>';



  const recruitingBlock = showRecruitingList ? `

    <section class="card" id="recruitingSection">

      <h2 class="card__title">모집 중인 구단 (M09)</h2>

      ${recruitingClubs.length ? recruitingClubs.map((rc) => {

        const joined = myClubs.some((mc) => mc.id === rc.id);

        return `

          <div class="app-card">

            <strong>${escapeHtml(rc.name)}</strong>

            <p class="app-card__meta">${escapeHtml(rc.region)}</p>

            ${joined ? '<span class="tag">이미 소속</span>' : `

              <div class="form-row">

                <input class="form-input" type="text" placeholder="신청 메시지 (선택)" data-apply-msg="${rc.id}">

              </div>

              <button type="button" class="btn btn--primary btn--sm" data-apply-club="${rc.id}">가입 신청</button>

            `}

          </div>

        `;

      }).join('') : '<p class="page-muted">모집 중인 구단이 없습니다.</p>'}

    </section>

  ` : '';



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

      ${memberMsg ? `<p class="page-warn" aria-live="polite">${escapeHtml(memberMsg)}</p>` : ''}

    </section>

    ${inviteBlock}

    ${list}

    ${recruitingBlock}

    ${createForm}

    <button type="button" class="btn btn--outline btn--block" id="btnToggleRecruiting">${showRecruitingList ? '모집 목록 닫기' : '모집 중인 구단 찾기'}</button>

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

  if (activeTab === 'clubs') {

    initClubsActions();

    initMembersActions();

  }

  if (activeTab === 'matching') {
    initMatchingActions();
    const staff = staffClubs(myClubs);
    if (createMatchingOpen) {
      void mountLineupPickerForCreate(staff);
    } else if (matchingPostId && matchingDetail && !matchingDetailLoading) {
      const post = matchingDetail.post;
      const myStaff = staff;
      const canApply = myStaff.filter((c) => c.id !== post?.host_club_id);
      if (canApply.length && post?.status !== 'matched') {
        void mountLineupPickerForApply(staff);
      }
    }
  }

}



async function openClubPanel(clubId) {

  if (manageClubId === clubId) {

    manageClubId = null;

    clubPanel = null;

    renderMain();

    return;

  }

  manageClubId = clubId;

  clubPanel = null;

  clubPanelLoading = true;

  memberMsg = '';

  renderMain();

  try {

    clubPanel = await loadClubPanel(clubId);

  } catch (e) {

    memberMsg = rpcErrorMessage(e);

    manageClubId = null;

  }

  clubPanelLoading = false;

  renderMain();

}



function initMembersActions() {

  $$('[data-manage-club]').forEach((btn) => {

    btn.addEventListener('click', () => openClubPanel(btn.dataset.manageClub));

  });



  $('#btnToggleRecruiting')?.addEventListener('click', async () => {

    showRecruitingList = !showRecruitingList;

    if (showRecruitingList && !recruitingClubs.length) {

      try {

        recruitingClubs = await loadRecruitingClubs();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

      }

    }

    renderMain();

  });



  $('#btnSendInvite')?.addEventListener('click', async () => {

    const clubId = $('#btnSendInvite')?.dataset.clubId;

    const pid = $('#invitePlatformId')?.value?.trim().toLowerCase();

    const role = $('#inviteRole')?.value || 'member';

    if (!clubId || !pid) {

      memberMsg = '플랫폼 ID를 입력해 주세요.';

      renderMain();

      return;

    }

    memberMsg = '초대 중...';

    renderMain();

    try {

      await inviteMember(clubId, pid, role);

      memberMsg = '초대를 보냈습니다.';

      clubPanel = await loadClubPanel(clubId);

      renderMain();

    } catch (e) {

      memberMsg = rpcErrorMessage(e);

      renderMain();

    }

  });



  $('#recruitingToggle')?.addEventListener('change', async (e) => {

    const clubId = e.target.dataset.clubId;

    if (!clubId) return;

    try {

      await setRecruiting(clubId, e.target.checked);

      if (clubPanel?.detail) clubPanel.detail.recruiting = e.target.checked;

      memberMsg = e.target.checked ? '모집을 시작했습니다.' : '모집을 종료했습니다.';

    } catch (err) {

      memberMsg = rpcErrorMessage(err);

      e.target.checked = !e.target.checked;

    }

    renderMain();

  });



  $$('[data-member-role]').forEach((sel) => {

    sel.addEventListener('change', async () => {

      const userId = sel.dataset.userId;

      const clubId = manageClubId;

      if (!userId || !clubId) return;

      try {

        await changeMemberRole(clubId, userId, sel.value);

        memberMsg = '역할을 변경했습니다.';

        clubPanel = await loadClubPanel(clubId);

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-leave-club]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const clubId = btn.dataset.leaveClub;

      if (!clubId) return;

      if (!confirm('이 구단에서 탈퇴하시겠습니까?')) return;

      try {

        await leaveClub(clubId);

        memberMsg = '구단에서 탈퇴했습니다.';

        manageClubId = null;

        clubPanel = null;

        await refreshSessionData();

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-kick-member]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const clubId = btn.dataset.clubId;

      const userId = btn.dataset.userId;

      if (!clubId || !userId) return;

      if (!confirm('이 멤버를 강퇴하시겠습니까?')) return;

      try {

        await kickMember(clubId, userId);

        memberMsg = '강퇴했습니다.';

        clubPanel = await loadClubPanel(clubId);

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-app-approve]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const id = Number(btn.dataset.appApprove);

      if (!id || !manageClubId) return;

      try {

        await respondApp(id, true);

        memberMsg = '가입을 승인했습니다.';

        await refreshSessionData();

        clubPanel = await loadClubPanel(manageClubId);

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-app-reject]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const id = Number(btn.dataset.appReject);

      if (!id || !manageClubId) return;

      try {

        await respondApp(id, false);

        memberMsg = '가입을 거절했습니다.';

        clubPanel = await loadClubPanel(manageClubId);

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-invite-accept]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      try {

        await respondInvite(Number(btn.dataset.inviteAccept), true);

        memberMsg = '초대를 수락했습니다.';

        await refreshSessionData();

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-invite-decline]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      try {

        await respondInvite(Number(btn.dataset.inviteDecline), false);

        memberMsg = '초대를 거절했습니다.';

        await refreshSessionData();

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });



  $$('[data-apply-club]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const clubId = btn.dataset.applyClub;

      const msgEl = document.querySelector(`[data-apply-msg="${clubId}"]`);

      const message = msgEl?.value?.trim() || '';

      try {

        await applyClub(clubId, message);

        memberMsg = '가입 신청을 보냈습니다.';

        renderMain();

      } catch (e) {

        memberMsg = rpcErrorMessage(e);

        renderMain();

      }

    });

  });

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

    stopNotificationsRealtime();

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



function initMatchingActions() {

  $('#btnOpenMatchingCreate')?.addEventListener('click', () => {

    createMatchingOpen = true;

    matchingMsg = '';

    renderMain();

  });



  $('#matchingBackToList')?.addEventListener('click', () => {

    matchingPostId = null;

    matchingDetail = null;

    createMatchingOpen = false;

    matchingMsg = '';

    loadMatchingList();

  });



  $('#btnCancelMatchingPost')?.addEventListener('click', () => {

    createMatchingOpen = false;

    matchingMsg = '';

    renderMain();

  });



  $('#matchCreateClub')?.addEventListener('change', () => {

    const staff = staffClubs(myClubs);

    void mountLineupPickerForCreate(staff);

  });



  $('#btnSubmitMatchingPost')?.addEventListener('click', async () => {

    const clubId = $('#matchCreateClub')?.value;

    const when = $('#matchCreateWhen')?.value;

    const place = $('#matchCreatePlace')?.value?.trim();

    const region = $('#matchCreateRegion')?.value?.trim();

    if (!clubId || !when || !place || !region) {

      matchingMsg = '구단·일시·장소·지역을 모두 입력해 주세요.';

      renderMain();

      return;

    }

    if (!lineupIsReady()) {

      matchingMsg = lineupValidationMessage() || '라인업을 확인해 주세요.';

      renderMain();

      return;

    }

    const scheduledAt = new Date(when).toISOString();

    matchingMsg = '등록 중...';

    renderMain();

    try {

      await saveLineupBeforePost();

      await createPost(clubId, scheduledAt, place, region);

      createMatchingOpen = false;

      matchingMsg = '공고를 등록했습니다.';

      await loadMatchingList();

    } catch (e) {

      matchingMsg = rpcMatchingError(e);

      renderMain();

    }

  });



  $$('[data-match-region]').forEach((btn) => {

    btn.addEventListener('click', () => {

      matchingRegionFilter = btn.dataset.matchRegion || '';

      loadMatchingList();

    });

  });



  $$('[data-match-post]').forEach((el) => {

    el.addEventListener('click', () => {

      const id = Number(el.dataset.matchPost);

      if (id) openMatchingDetail(id);

    });

  });



  $('#matchApplyClub')?.addEventListener('change', () => {

    const staff = staffClubs(myClubs);

    void mountLineupPickerForApply(staff);

  });



  $('#btnApplyMatching')?.addEventListener('click', async () => {

    const clubId = $('#matchApplyClub')?.value;

    if (!clubId || !matchingPostId) return;

    if (!lineupIsReady()) {

      matchingMsg = lineupValidationMessage() || '포메이션을 선택해 주세요.';

      renderMain();

      return;

    }

    matchingMsg = '신청 중...';

    renderMain();

    try {

      await saveLineupBeforePost();

      await applyToPost(matchingPostId, clubId);

      matchingMsg = '매칭 신청을 보냈습니다.';

      matchingDetail = await loadPostDetail(matchingPostId);

      renderMain();

    } catch (e) {

      matchingMsg = rpcMatchingError(e);

      renderMain();

    }

  });



  $$('[data-match-accept]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const id = Number(btn.dataset.matchAccept);

      if (!id) return;

      if (!confirm('이 구단과 매칭을 확정할까요? 나머지 신청은 자동 거절됩니다. (MK12)')) return;

      try {

        await respondApplication(id, true);

        matchingMsg = '매칭이 확정되었습니다. 양쪽 일정에 등록되었습니다. (MK05)';

        matchingPostId = null;

        matchingDetail = null;

        await loadMatchingList();

      } catch (e) {

        matchingMsg = rpcMatchingError(e);

        renderMain();

      }

    });

  });



  $$('[data-match-reject]').forEach((btn) => {

    btn.addEventListener('click', async () => {

      const id = Number(btn.dataset.matchReject);

      if (!id) return;

      try {

        await respondApplication(id, false);

        matchingMsg = '신청을 거절했습니다.';

        matchingDetail = await loadPostDetail(matchingPostId);

        renderMain();

      } catch (e) {

        matchingMsg = rpcMatchingError(e);

        renderMain();

      }

    });

  });

}



async function init() {

  document.title = PLATFORM.name;

  initSideRails();

  initNav();

  onNotificationsUpdated(async () => {

    const uid = getUserId();

    if (uid) {

      try {

        myInvitations = await loadMyInvitations();

      } catch {

        myInvitations = [];

      }

    }

    updateBadge();

    if (panelOpen) mountNotificationUI();

    renderMain();

  });



  const health = await apiHealth();

  backendOk = health.ok;



  await refreshSessionData();

  mountNotificationUI();

  renderMain();

}



init();


