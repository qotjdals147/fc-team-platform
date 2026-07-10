// ── 프레젠테이션 모드 ──
let presentMode = false;
let presentScales = { token: 1, bench: 1, avail: 1, quarter: 1, panelLeft: 1.2, panelRight: 1 };
let availPanelCollapsed = false;
function togglePresentMode() {
  if (!isAdmin) return;
  presentMode = !presentMode;
  document.body.classList.toggle('presentation-mode', presentMode);
  const btn = document.getElementById('btnPresent');
  if (btn) {
    btn.classList.toggle('active', presentMode);
    btn.textContent = presentMode ? '✕ 발표 종료' : '🖥️ 발표';
  }
  // 발표 모드 해제 시 현재 탭(포메이션)이 보이도록 강제 적용
  if (!presentMode) {
    const tab = document.getElementById('tab-formation');
    if (tab) tab.style.cssText = '';
  }
  // 레이아웃 확정 후 캔버스 재계산 (두 번 RAF로 안정적 크기 확보)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    drawFieldCanvas();
    renderField();
    renderBench();
    renderAvailPanel();
    if (presentMode) { applyPresentScales(); updatePresentPanel(); }
    updateAvailBtn();
    updateQuarterCopyBtns();
  }));
}

// ── 프레젠테이션 패널 ──
function stepPresentScale(key, dir) {
  const min = 0.5, max = 2.5, step = 0.1;
  const cur = presentScales[key] || 1;
  presentScales[key] = Math.max(min, Math.min(max, Math.round((cur + dir * step) * 10) / 10));
  applyPresentScales();
  drawFieldCanvas();
  updatePresentPanel();
  persistMeta().catch(() => {});
}
function applyPresentScales() {
  const root = document.documentElement;
  root.style.setProperty('--ps-bench',   String(presentScales.bench   || 1));
  root.style.setProperty('--ps-avail',   String(presentScales.avail   || 1));
  root.style.setProperty('--ps-quarter', String(presentScales.quarter || 1));
  root.style.setProperty('--ps-panel-left',  String(presentScales.panelLeft  || 1.2));
  root.style.setProperty('--ps-panel-right', String(presentScales.panelRight || 1));
  const mapR = { token:'psToken', quarter:'psQuarter', panelRight:'psPanel' };
  for (const [k, id] of Object.entries(mapR)) {
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round((presentScales[k] || 1) * 100) + '%';
  }
  const mapL = { bench:'psBenchL', avail:'psAvailL', panelLeft:'psPanelL' };
  for (const [k, id] of Object.entries(mapL)) {
    const el = document.getElementById(id);
    if (el) el.textContent = Math.round((presentScales[k] || 1) * 100) + '%';
  }
}
function updatePresentPanel() {
  if (!presentMode) return;
  const dash = document.getElementById('ppDashboard');
  if (!dash) return;
  // 쿼터별 선수 참여 집계
  const participation = {};
  for (let q = 1; q <= 4; q++) {
    const tokens = q === activeQuarter ? fieldTokens : (quarterData[q]?.tokens || []);
    tokens.forEach(t => {
      const key = String(t.pid);
      if (!participation[key]) participation[key] = [];
      participation[key].push(q);
    });
  }
  const entries = Object.entries(participation);
  if (!entries.length) {
    dash.innerHTML = '<div class="pp-empty">&#xBC30;&#xCE58;&#xB41C; &#xC120;&#xC218; &#xC5C6;&#xC74C;</div>';
    return;
  }
  dash.innerHTML = entries.map(([pid, quarters]) => {
    const p = players.find(pl => String(pl.id) === pid);
    if (!p) return '';
    const label = (p.jersey != null ? '#' + p.jersey + '\u00a0' : '') + p.name;
    const isAll = quarters.length === 4;
    const badges = isAll
      ? '<span class="pp-q-all">&#xC804;&#xCCB4;</span>'
      : [1,2,3,4].map(q =>
          `<span class="pp-q-badge ${quarters.includes(q)?'on':'off'}">${q}Q</span>`
        ).join('');
    return `<div class="pp-row"><span class="pp-name">${label}</span><span class="pp-badges">${badges}</span></div>`;
  }).filter(Boolean).join('');
}
function togglePresentPanel() {
  document.getElementById('presentPanel')?.classList.toggle('mobile-open');
}
function toggleAvailCollapse() {
  availPanelCollapsed = !availPanelCollapsed;
  renderAvailPanel();
}

// ── 관리자 모드 ──
const ADMIN_PW_DEFAULT = '0607';
let isAdmin = false; // 새로고침·재접속 시 항상 비관리자 (비밀번호 재입력 필요)

// ── 총무 모드 ──
const TREASURER_PW_DEFAULT = '1234';
let isTreasurer = false;

function getTreasurerPw() {
  return String(localStorage.getItem('fc_treasurer_pw') || TREASURER_PW_DEFAULT);
}

function applyTreasurerMode() {
  document.body.classList.toggle('is-treasurer', isTreasurer);
  const btn = document.getElementById('treasurerToggleBtn');
  if (btn) {
    btn.textContent = isTreasurer ? '\uD83D\uDCB3' : '\uD83D\uDCB0';
    btn.title = isTreasurer ? '\uCD1D\uBB34 \uBAA8\uB4DC \uD574\uC81C' : '\uCD1D\uBB34 \uBAA8\uB4DC \uC9C4\uC785';
    btn.classList.toggle('active', isTreasurer);
  }
  const tBtn = document.getElementById('treasurerTabBtn');
  if (tBtn) tBtn.style.display = isTreasurer ? '' : 'none';
  if (!isTreasurer && document.getElementById('tab-treasurer')?.classList.contains('active')) {
    switchTab('home');
  }
  if (isTreasurer) renderTreasurer();
}

function toggleTreasurerMode() {
  if (isPlatformClub()) return;
  if (isTreasurer) {
    openTreasurerOptionsModal();
  } else {
    openTreasurerModal();
  }
}

function openTreasurerModal() {
  const inp = document.getElementById('treasurerPwInput');
  if (inp) inp.value = '';
  document.getElementById('treasurerModal').classList.add('open');
  setTimeout(() => document.getElementById('treasurerPwInput')?.focus(), 150);
}
function closeTreasurerModal() {
  document.getElementById('treasurerModal').classList.remove('open');
}
function submitTreasurerPw() {
  const pw = document.getElementById('treasurerPwInput')?.value ?? '';
  if (pw === getTreasurerPw()) {
    isTreasurer = true;
    // 관리자 모드와 상호 배타
    if (isAdmin) { isAdmin = false; applyAdminMode(); }
    closeTreasurerModal();
    applyTreasurerMode();
  } else {
    alert('\uC554\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4');
    const inp = document.getElementById('treasurerPwInput');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

function openTreasurerOptionsModal() {
  document.getElementById('treasurerOptionsModal').classList.add('open');
}
function closeTreasurerOptionsModal() {
  document.getElementById('treasurerOptionsModal').classList.remove('open');
}
function exitTreasurerMode() {
  if (isPlatformClub() && platformRolePermissions(window.__CLUB__?.role).treasurer) return;
  closeTreasurerOptionsModal();
  isTreasurer = false;
  applyTreasurerMode();
}

function openTreasurerPwChangeModal() {
  closeTreasurerOptionsModal();
  ['trPwCurrent','trPwNew','trPwConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('treasurerPwChangeModal').classList.add('open');
  setTimeout(() => document.getElementById('trPwCurrent')?.focus(), 150);
}
function closeTreasurerPwChangeModal() {
  document.getElementById('treasurerPwChangeModal').classList.remove('open');
}
function submitTreasurerPwChange() {
  const current = document.getElementById('trPwCurrent')?.value ?? '';
  const newPw   = document.getElementById('trPwNew')?.value ?? '';
  const confirm = document.getElementById('trPwConfirm')?.value ?? '';
  if (current !== getTreasurerPw()) {
    alert('\uD604\uC7AC \uBE44\uBC00\uBC88\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4');
    document.getElementById('trPwCurrent').value = '';
    document.getElementById('trPwCurrent').focus();
    return;
  }
  if (!newPw) { alert('\uC0C8 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
  if (newPw !== confirm) { alert('\uC0C8 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4'); document.getElementById('trPwConfirm').value = ''; return; }
  localStorage.setItem('fc_treasurer_pw', newPw);
  persistMeta().then(() => {
    closeTreasurerPwChangeModal();
    alert('\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4 \u2713');
  }).catch(() => {
    closeTreasurerPwChangeModal();
    alert('\uBE44\uBC00\uBC88\uD638\uAC00 \uBCC0\uACBD\uB418\uC5C8\uC2B5\uB2C8\uB2E4 (\uC2DC\uD2B8 \uC800\uC7A5 \uC2E4\uD328 - \uB85C\uCEEC\uB9CC \uBC18\uC601)');
  });
}

// localStorage 또는 기본값에서 현재 비밀번호 반환
function getAdminPw() {
  return String(localStorage.getItem('fc_admin_pw') || ADMIN_PW_DEFAULT);
}

function syncMetaPasswords(meta) {
  if (isPlatformClub()) return;
  if (!meta) return;
  if (meta.adminPw != null && String(meta.adminPw) !== '') {
    localStorage.setItem('fc_admin_pw', String(meta.adminPw));
  }
  if (meta.treasurerPw != null && String(meta.treasurerPw) !== '') {
    localStorage.setItem('fc_treasurer_pw', String(meta.treasurerPw));
  }
}

function applyAdminMode() {
  document.body.classList.toggle('is-admin', isAdmin);
  if (isPlatformClub()) hidePlatformAuthLocks?.();
  // 관리자 켜질 때 총무 상호 배타 (플랫폼 구단주 owner 는 예외)
  if (isAdmin && isTreasurer && window.__CLUB__?.role !== 'owner') {
    isTreasurer = false;
    applyTreasurerMode();
  }
  // 잠금 버튼 아이콘
  const btn = document.getElementById('adminToggleBtn');
  if (btn) {
    btn.textContent = isAdmin ? '\uD83D\uDD13' : '\uD83D\uDD12';
    btn.title = isAdmin ? '\uAD00\uB9AC\uC790 \uBAA8\uB4DC \uD574\uC81C' : '\uAD00\uB9AC\uC790 \uBAA8\uB4DC \uC9C4\uC785';
    btn.classList.toggle('active', isAdmin);
  }
  // 통계 탭 버튼: 비관리자에게 숨김
  const statsTabBtn = document.getElementById('statsTabBtn');
  if (statsTabBtn) statsTabBtn.style.display = isAdmin ? '' : 'none';
  // 비관리자가 통계 탭에 있으면 홈으로
  if (!isAdmin && document.getElementById('tab-stats')?.classList.contains('active')) {
    switchTab('home');
  }
  // 포메이션 뷰 레이블 업데이트
  const vl = document.getElementById('formationViewLabel');
  if (vl) vl.textContent = getFormation() || '';
  updateQuarterCopyBtns();
  // 동적 렌더 요소 재렌더 (편집 버튼 포함 여부 반영)
  renderRoster();
  renderRecords();
}

function toggleAdminMode() {
  if (isPlatformClub()) return;
  if (isAdmin) {
    openAdminOptionsModal();
  } else {
    openAdminModal();
  }
}

function openAdminOptionsModal() {
  document.getElementById('adminOptionsModal').classList.add('open');
}
function closeAdminOptionsModal() {
  document.getElementById('adminOptionsModal').classList.remove('open');
}
function exitAdminMode() {
  if (isPlatformClub() && platformRolePermissions(window.__CLUB__?.role).admin) return;
  closeAdminOptionsModal();
  isAdmin = false;
  applyAdminMode();
}

function openPwChangeModal() {
  closeAdminOptionsModal();
  ['pwCurrent','pwNew','pwConfirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('pwChangeModal').classList.add('open');
  setTimeout(() => document.getElementById('pwCurrent')?.focus(), 150);
}
function closePwChangeModal() {
  document.getElementById('pwChangeModal').classList.remove('open');
}
function submitPwChange() {
  const current = document.getElementById('pwCurrent')?.value ?? '';
  const newPw   = document.getElementById('pwNew')?.value ?? '';
  const confirm = document.getElementById('pwConfirm')?.value ?? '';
  if (current !== getAdminPw()) {
    alert('현재 비밀번호가 틀렸습니다');
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwCurrent').focus();
    return;
  }
  if (!newPw) { alert('새 비밀번호를 입력해주세요'); return; }
  if (newPw !== confirm) { alert('새 비밀번호가 일치하지 않습니다'); document.getElementById('pwConfirm').value = ''; return; }
  localStorage.setItem('fc_admin_pw', newPw);
  // Google Sheets에도 동기화 (시트에서 확인 가능)
  persistMeta().then(() => {
    closePwChangeModal();
    alert('비밀번호가 변경되었습니다 ✓');
  }).catch(() => {
    // 시트 저장 실패해도 로컬은 이미 변경됨
    closePwChangeModal();
    alert('비밀번호가 변경되었습니다 (시트 저장 실패 - 로컬만 반영)');
  });
}

function openWageRatesModal() {
  closeAdminOptionsModal();
  const grid = document.getElementById('wageRatesGrid');
  if (grid) {
    grid.innerHTML = WAGE_FIELDS.map(f => `
      <div class="form-field wage-rate-field">
        <label>${f.label}</label>
        <input type="number" id="wage_${f.key}" min="0" max="99999" step="1" value="${wageRates[f.key] ?? WAGE_DEFAULTS[f.key]}">
      </div>`).join('');
  }
  document.getElementById('wageRatesModal')?.classList.add('open');
}
function closeWageRatesModal() {
  document.getElementById('wageRatesModal')?.classList.remove('open');
}
function saveWageRates() {
  const next = { ...WAGE_DEFAULTS, ...wageRates };
  for (const f of WAGE_FIELDS) {
    const v = parseInt(document.getElementById('wage_' + f.key)?.value, 10);
    if (Number.isNaN(v) || v < 0) {
      alert(f.label + ' 금액을 확인해주세요');
      return;
    }
    next[f.key] = v;
  }
  wageRates = next;
  persistMeta().then(() => {
    closeWageRatesModal();
    renderRecords();
    renderRoster();
    refreshStatsIfVisible();
    alert('수당 기준이 저장되었습니다.\n미정산·선수 가치에 반영됩니다.\n(이미 정산 완료된 금액은 변경되지 않습니다)');
  }).catch(handleSaveError);
}

function openAdminModal() {
  const inp = document.getElementById('adminPwInput');
  if (inp) inp.value = '';
  document.getElementById('adminModal').classList.add('open');
  setTimeout(() => document.getElementById('adminPwInput')?.focus(), 150);
}

function closeAdminModal() {
  document.getElementById('adminModal').classList.remove('open');
}

function submitAdminPw() {
  const pw = document.getElementById('adminPwInput')?.value ?? '';
  if (pw === getAdminPw()) {
    isAdmin = true;
    closeAdminModal();
    applyAdminMode();
  } else {
    alert('암호가 틀렸습니다');
    const inp = document.getElementById('adminPwInput');
    if (inp) { inp.value = ''; inp.focus(); }
  }
}

// ── 상태 ──
// fieldTokens: { pid, slotIdx, freeX, freeY, pos, subPid? }
// slotIdx >= 0 → 어느 포메이션 슬롯(역할)인지 / freeX·freeY → 실제 화면 좌표(미세 조정)
// subPid: 교체 예정 선수 pid (optional)
let players = [], editingId = null, fieldSize = {w:0,h:0};
let matchEvents = {}, matchMom = null, matchBestDef = null, matchBestDef2 = null, editingMatchId = null;

// ── 선수 가치 표기 (실제 원 × 1,000,000 → 전체 숫자 + 원) ──
function formatPlayerValue(wageWon) {
  const val = (wageWon || 0) * 1000000;
  if (val === 0) return null;
  return val.toLocaleString();
}

// ── 수당 기준 (meta.wageRates로 오버라이드 가능) ──
const WAGE_DEFAULTS = { attendance:50, win:100, cleansheet:150, goal:300, assist:200, bestDef:500, bestDef2:300, mom:500 };
let wageRates = { ...WAGE_DEFAULTS };
const WAGE_FIELDS = [
  { key: 'attendance', label: '출석' },
  { key: 'win', label: '승리' },
  { key: 'cleansheet', label: '클린시트 (수비)' },
  { key: 'goal', label: '골' },
  { key: 'assist', label: '어시스트' },
  { key: 'bestDef', label: '베스트 수비' },
  { key: 'bestDef2', label: '수비 공헌 수당' },
  { key: 'mom', label: 'MOM' },
];
const DEF_POSITIONS = new Set(['CB','LB','RB','GK']);

function loadWageRates(meta) {
  if (!meta?.wageRates) return;
  try { wageRates = { ...WAGE_DEFAULTS, ...(typeof meta.wageRates === 'string' ? JSON.parse(meta.wageRates) : meta.wageRates) }; } catch(e) {}
}

// 한 경기에서 각 선수가 받는 수당 계산 → {pid: {items:[{label,amount}], total}}
function computeMatchWages(match) {
  const result = {};
  const win = match.scoreUs > match.scoreOpp;
  const clean = match.scoreOpp === 0;
  const allPids = [
    ...(match.lineup || []).map(x => ({pid:x.pid, pos:x.pos, type:'field'})),
    ...(match.subs   || []).map(x => ({pid:x.pid, pos:x.pos, type:'sub'})),
  ];
  allPids.forEach(({pid, pos, type}) => {
    if (!pid) return;
    // 용병은 수당 지급 제외
    const _plyr = players.find(p => p.id == pid);
    if (_plyr?.isMercenary) return;
    const items = [];
    items.push({ label:'&#xCD9C;&#xC11D;', amount: wageRates.attendance });
    if (win) items.push({ label:'&#xC2B9;&#xB9AC;', amount: wageRates.win });
    if (clean && DEF_POSITIONS.has(pos)) items.push({ label:'&#xD074;&#xB9B0;&#xC2DC;&#xD2B8;', amount: wageRates.cleansheet });
    const scorer = (match.scorers || []).find(s => s.pid == pid);
    if (scorer?.goals)   items.push({ label:`&#xACE8;${scorer.goals>1?'&times;'+scorer.goals:''}`, amount: wageRates.goal * scorer.goals });
    if (scorer?.assists) items.push({ label:`&#xC5B4;&#xC2DC;${scorer.assists>1?'&times;'+scorer.assists:''}`, amount: wageRates.assist * scorer.assists });
    if (match.bestDef  == pid) items.push({ label:'&#xBCA0;&#xC2A4;&#xD2B8;&#xC218;&#xBE44;', amount: wageRates.bestDef });
    if (match.bestDef2 == pid) items.push({ label:'&#xC218;&#xBE44;&#xACF5;&#xD5CC;&#xC218;&#xB2F9;', amount: wageRates.bestDef2 });
    if (match.mom      == pid) items.push({ label:'MOM', amount: wageRates.mom });
    result[pid] = { items, total: items.reduce((s,i)=>s+i.amount, 0) };
  });
  return result;
}

// ── 징계 (9조 8항: 불화·마찰) ──
const DISCIPLINE_REASON_LABELS = {
  internal: '\uD300 \uB0B4 \uBD88\uD654',
  opponent: '\uC0C1\uB300\uD300 \uB9C8\uCC30',
  late: '\uC9C0\uAC01',
  no_show: '\uBB34\uB2E8 \uBD88\uCC38',
  other: '\uAE30\uD0C0',
};
function disciplineLevelLabel(level) {
  if (level === 30) return '\uC120\uC218 \uAC00\uCE58 -30\uC6D0';
  if (level === 50) return '\uC120\uC218 \uAC00\uCE58 -50\uC6D0';
  if (level >= 1 && level <= 3) return `${level}\uCC28`;
  const amt = DISCIPLINE_AMOUNTS[level];
  return amt ? `-\uC120\uC218 \uAC00\uCE58 ${amt.toLocaleString()}\uC6D0` : String(level);
}
function isSuspensionDiscipline(d) {
  const lv = Number(d?.level);
  return lv >= 1 && lv <= 3;
}

function getDisciplinesForPlayer(pid) {
  return disciplines.filter(d => d.pid == pid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function getConflictDisciplineCount(pid) {
  return disciplines.filter(d => d.pid == pid && isSuspensionDiscipline(d)).length;
}
function getSuggestedDisciplineLevel(pid) {
  return Math.min(getConflictDisciplineCount(pid) + 1, 3);
}
function disciplineReasonLabel(reason) {
  return DISCIPLINE_REASON_LABELS[reason] || reason || '\uAE30\uD0C0';
}
function computeTotalDisciplineDeduction(pid) {
  if (players.find(p => p.id === pid)?.isMercenary) return 0;
  return disciplines.filter(d => d.pid == pid).reduce((s, d) => s + (d.amount || 0), 0);
}
function getUnsettledDisciplinesInPeriod(pid, from, to) {
  const fromD = from ? normalizeDate(from) : null;
  const toD = to ? normalizeDate(to) : null;
  return disciplines.filter(d => {
    if (d.pid != pid || d.settlementGroupId) return false;
    const dd = normalizeDate(d.date);
    if (!dd) return false;
    if (fromD && dd < fromD) return false;
    if (toD && dd > toD) return false;
    return true;
  });
}
function computeMatchWageGross(pid, from, to, excludeSettled) {
  if (players.find(p => p.id === pid)?.isMercenary) return 0;
  const settled = excludeSettled ? settlements.filter(s => s.pid == pid && s.status === 'done') : [];
  const fromD = from ? normalizeDate(from) : null;
  const toD = to ? normalizeDate(to) : null;
  return matches.reduce((sum, m) => {
    const md = normalizeDate(m.date);
    if (fromD && md < fromD) return sum;
    if (toD && md > toD) return sum;
    if (excludeSettled && settled.some(s => md >= normalizeDate(s.startDate) && md <= normalizeDate(s.endDate))) return sum;
    const w = computeMatchWages(m);
    return sum + (w[pid]?.total || 0);
  }, 0);
}
function computeUnsettledWageBreakdown(pid, from, to) {
  if (players.find(p => p.id === pid)?.isMercenary) return { gross: 0, discipline: 0, net: 0, disciplineItems: [] };
  const gross = computeMatchWageGross(pid, from, to, true);
  const disciplineItems = getUnsettledDisciplinesInPeriod(pid, from, to);
  const discipline = disciplineItems.reduce((s, d) => s + (d.amount || 0), 0);
  const net = Math.max(0, gross - discipline);
  return { gross, discipline, net, disciplineItems };
}
function linkDisciplinesToSettlement(pid, from, to, groupId) {
  const fromD = normalizeDate(from);
  const toD = normalizeDate(to);
  disciplines.forEach(d => {
    if (d.pid != pid || d.settlementGroupId) return;
    const dd = normalizeDate(d.date);
    if (dd && dd >= fromD && dd <= toD) d.settlementGroupId = groupId;
  });
}
function hasSuspensionToday(pid) {
  const today = new Date().toISOString().slice(0, 10);
  return disciplines.some(d => d.pid == pid && normalizeDate(d.date) === today);
}
function checkSuspensionWarning(pid) {
  if (!isAdmin) return;
  const today = new Date().toISOString().slice(0, 10);
  const todayDisc = disciplines.filter(d => d.pid == pid && normalizeDate(d.date) === today && isSuspensionDiscipline(d));
  if (!todayDisc.length) return;
  const p = players.find(x => x.id === pid);
  const levels = todayDisc.map(d => d.level + '\uCC28').join(', ');
  setTimeout(() => alert(`${p?.name || ''} \u2014 \uB2F9\uC77C \uCD9C\uC804 \uC815\uC9C0 (${levels} \uC9D5\uACC4)`), 50);
}

// 선수의 전체 누적 선수 가치 (경기 수당 − 징계)
function computePlayerTotalWage(pid) {
  if (players.find(p => p.id === pid)?.isMercenary) return 0;
  const gross = computeMatchWageGross(pid, null, null, false);
  const deduction = computeTotalDisciplineDeduction(pid);
  return Math.max(0, gross - deduction);
}
let fieldTokens = [], matches = [], formationSaves = [], myTeamName = '', teamPhotoUrl = '';

function getDisplayMyTeam(m) {
  return (myTeamName || m?.myTeam || '우리 FC').trim();
}
function syncAllMatchTeamNames(name) {
  const team = (name || myTeamName || '우리 FC').trim();
  let changed = false;
  matches = matches.map(m => {
    if (m.myTeam === team) return m;
    changed = true;
    return { ...m, myTeam: team };
  });
  return changed;
}
let dues = [], expenses = [], settlements = [], disciplines = [];
let schedules = [], notices = [], dueExemptions = [], dueMemos = [];
let trFilterYearMonth = null;
let cachedFormation = '';
let photoTransform = { x: 0, y: 0, scale: 1 };
const PHOTO_SCALE_MIN = 1;
const PHOTO_SCALE_MAX = 4;
let matchParticipants = [];
let statsSubTab = 'personal';
let slotHighlight = -1; // 드래그 중 강조할 포메이션 슬롯 인덱스
// 쿼터별 필드 상태: quarterData[1~4] = { formation, tokens } | null
let quarterData = {1:null,2:null,3:null,4:null};
let activeQuarter = 1;
// 슬라이드쇼
let photoUrls = [], photoInterval = 10, currentPhotoIdx = 0, photoTransforms = [];
let photoEditSlots = [];
const PHOTO_MAX_SLOTS = 15;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
let _slideTimer = null;
// 오늘 멤버 필터 (세션 전용, 저장 안 함)
let sessionAvailablePids = null; // null=필터 없음, Set=필터 적용 중

// 팝업 모드: 'pos' | 'sub'
let popupMode = 'pos', popupTargetPid = null;

function getFormation() { return document.getElementById('formationSelect').value; }
function getSlots()     { return FORMATIONS[getFormation()] || []; }
function getLabels()    { return FORMATION_POS_LABELS[getFormation()] || []; }
function isFormationSelected() {
  const f = getFormation();
  return !!(f && FORMATIONS[f]);
}
function saveFormationLocal(value) {
  if (value && FORMATIONS[value]) {
    cachedFormation = value;
    localStorage.setItem('fc_formation', value);
  }
}
function inferFormationFromTokens(tokens) {
  if (!tokens?.length) return '';
  let bestKey = '';
  let bestScore = -1;
  Object.keys(FORMATIONS).forEach(key => {
    const labels = FORMATION_POS_LABELS[key] || [];
    let score = 0;
    tokens.forEach(t => {
      if (t.slotIdx >= 0 && t.slotIdx < labels.length) {
        if (!t.pos || t.pos === labels[t.slotIdx] || slotAcceptsPos(labels[t.slotIdx], t.pos)) score += 2;
        else score += 1;
      } else if (t.pos && labels.some(l => slotAcceptsPos(l, t.pos))) score += 1;
    });
    if (score > bestScore) { bestScore = score; bestKey = key; }
  });
  return bestScore > 0 ? bestKey : '4-3-3';
}
function resolveFormation(remoteFormation, tokens) {
  if (remoteFormation && FORMATIONS[remoteFormation]) return remoteFormation;
  const local = localStorage.getItem('fc_formation');
  if (local && FORMATIONS[local]) return local;
  if (tokens?.length) return inferFormationFromTokens(tokens);
  return '';
}
function setFormationSelect(value) {
  const sel = document.getElementById('formationSelect');
  if (!sel) return;
  const v = value && FORMATIONS[value] ? value : '';
  sel.value = v;
  if (v) saveFormationLocal(v);
}
function getFormationForSave() {
  const sel = getFormation();
  if (sel && FORMATIONS[sel]) return sel;
  if (cachedFormation && FORMATIONS[cachedFormation]) return cachedFormation;
  if (fieldTokens.length) return inferFormationFromTokens(fieldTokens) || '4-3-3';
  return '';
}
// 포메이션 변경 시: 기존 pos 라벨 기준으로 새 슬롯에 재배치 (freeX/freeY 갱신)
function remapTokensToNewFormation() {
  const slots = getSlots();
  const labels = getLabels();
  if (!slots.length) return;

  // slotIdx 가 겹치지 않도록 순서대로 배정
  const claimed = new Set();

  // 1차: pos 가 있는 토큰 → 포지션에 맞는 빈 슬롯 탐색
  fieldTokens.forEach(ft => {
    if (!ft.pos) return;
    for (let i = 0; i < labels.length; i++) {
      if (!claimed.has(i) && slotAcceptsPos(labels[i], ft.pos)) {
        claimed.add(i);
        ft.slotIdx = i;
        ft.freeX = slots[i][0];
        ft.freeY = slots[i][1];
        return;
      }
    }
    // 포지션 맞는 자리 없으면 slotIdx=-1 유지 (자유 위치)
    ft.slotIdx = -1;
  });

  // 2차: pos 없는 토큰 → 남은 빈 슬롯에 순서대로
  fieldTokens.forEach(ft => {
    if (ft.slotIdx >= 0) return;
    for (let i = 0; i < labels.length; i++) {
      if (!claimed.has(i)) {
        claimed.add(i);
        ft.slotIdx = i;
        ft.freeX = slots[i][0];
        ft.freeY = slots[i][1];
        ft.pos = labels[i];
        return;
      }
    }
  });
}
function reconcileFieldTokensToFormation() {
  const slots = getSlots();
  const labels = getLabels();
  if (!slots.length) return;
  fieldTokens.forEach(ft => {
    if (ft.slotIdx >= 0 && ft.slotIdx < slots.length) {
      // 기존 slotIdx 유효 → 좌표만 새 포메이션 기준으로 갱신
      ft.freeX = slots[ft.slotIdx][0];
      ft.freeY = slots[ft.slotIdx][1];
      if (!ft.pos) ft.pos = labels[ft.slotIdx];
    }
  });
}
function alertFormationRequired() {
  alert('포메이션을 선택해주세요.');
}

// ── 쿼터 전환 ──
function isQuarterEmpty(qd) {
  return !qd || !qd.tokens?.length;
}
function syncActiveQuarterData() {
  quarterData[activeQuarter] = {
    formation: getFormation(),
    tokens: JSON.parse(JSON.stringify(fieldTokens)),
  };
}
function switchQuarter(q) {
  if (q === activeQuarter) return;
  syncActiveQuarterData();
  activeQuarter = q;
  const qd = quarterData[q];
  if (!isQuarterEmpty(qd)) {
    fieldTokens = normalizeFieldTokens(qd.tokens || []).map(t => ({...t, pos: migratePos(t.pos || '')}));
    const formation = resolveFormation(qd.formation, fieldTokens);
    setFormationSelect(formation);
    if (formation) reconcileFieldTokensToFormation();
  } else {
    fieldTokens = [];
    setFormationSelect(qd?.formation || '');
  }
  updateQuarterButtons();
  updateQuarterCopyBtns();
  drawFieldCanvas();
  renderField();
  renderBench();
  updatePresentPanel();
}
function getQuarterSnapshot(q) {
  if (q === activeQuarter) {
    return { formation: getFormation(), tokens: JSON.parse(JSON.stringify(fieldTokens)) };
  }
  const qd = quarterData[q];
  if (!qd) return { formation: '', tokens: [] };
  return {
    formation: qd.formation || '',
    tokens: JSON.parse(JSON.stringify(qd.tokens || [])),
  };
}
function applyQuarterSnapshot(qd) {
  fieldTokens = normalizeFieldTokens(qd.tokens || []).map(t => ({ ...t, pos: migratePos(t.pos || '') }));
  const formation = resolveFormation(qd.formation, fieldTokens);
  setFormationSelect(formation);
  if (formation) reconcileFieldTokensToFormation();
  drawFieldCanvas();
  renderField();
}
/** fromQ 라인업 → 다음 쿼터로 복사 (쿼터 탭 전환과 분리, 현재 화면 유지) */
function copyQuarterForward(fromQ) {
  if (!isAdmin) return;
  const toQ = fromQ + 1;
  if (fromQ < 1 || fromQ > 3) return;
  syncActiveQuarterData();
  const src = getQuarterSnapshot(fromQ);
  if (!src.tokens?.length) {
    alert(`${fromQ}Q\uC5D0 \uBC30\uCE58\uB41C \uC120\uC218\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.`);
    return;
  }
  const toQd = quarterData[toQ];
  if (toQd?.tokens?.length) {
    if (!confirm(`${toQ}Q\uC5D0 \uC774\uBBF8 \uBC30\uCE58\uAC00 \uC788\uC2B5\uB2C8\uB2E4. \uB36E\uC5B4\uC4F8\uAE4C\uC694?`)) return;
  }
  quarterData[toQ] = {
    formation: src.formation || inferFormationFromTokens(src.tokens) || '',
    tokens: JSON.parse(JSON.stringify(src.tokens)),
  };
  if (activeQuarter === toQ) applyQuarterSnapshot(quarterData[toQ]);
  updateQuarterButtons();
  updateQuarterCopyBtns();
  saveFieldState();
}
function updateQuarterCopyBtns() {
  for (let from = 1; from <= 3; from++) {
    const has = getQuarterSnapshot(from).tokens?.length > 0;
    ['qc', 'pqc'].forEach(prefix => {
      const btn = document.getElementById(prefix + from + 'btn');
      if (!btn) return;
      btn.disabled = !isAdmin || !has;
    });
  }
}
function updateQuarterButtons() {
  for (let q = 1; q <= 4; q++) {
    const isActive = q === activeQuarter;
    const qTokens = q === activeQuarter ? fieldTokens : (quarterData[q]?.tokens || []);
    const hasPlayers = qTokens.length > 0;
    // 일반 쿼터 바 버튼
    const btn = document.getElementById('q'+q+'btn');
    if (btn) { btn.classList.toggle('active', isActive); btn.classList.toggle('has-players', hasPlayers && !isActive); }
    // 프레젠테이션 플로팅 버튼
    const pbtn = document.getElementById('pq'+q+'btn');
    if (pbtn) { pbtn.classList.toggle('active', isActive); pbtn.classList.toggle('has-players', hasPlayers && !isActive); }
  }
}
function quarterLabel(quarters) {
  if (!quarters || !quarters.length) return '';
  if (quarters.length >= 4) return '(전체)';
  return '(' + quarters.join(',') + 'Q)';
}

function tokenXY(t) {
  // freeX/freeY = 실제 화면 위치 (슬롯 근처 미세 조정 가능)
  if (t.freeX != null && t.freeY != null) return { x: t.freeX, y: t.freeY };
  const slots = getSlots();
  if (t.slotIdx >= 0 && slots[t.slotIdx]) return { x: slots[t.slotIdx][0], y: slots[t.slotIdx][1] };
  return { x: 0.5, y: 0.5 };
}
function resolveTokenPos(t, p) {
  const labels = getLabels();
  const slotLabel = (t.slotIdx >= 0 && labels[t.slotIdx]) ? labels[t.slotIdx] : '';
  return t.pos || slotLabel || p.positions[0] || '';
}
function slotDefaultXY(i) {
  const slots = getSlots();
  return slots[i] ? { x: slots[i][0], y: slots[i][1] } : { x: 0.5, y: 0.5 };
}

const STAR_ARC_LAYOUT = {
  1: [[50, 2]],
  2: [[30, 10], [70, 10]],
  3: [[20, 16], [50, 2], [80, 16]],
  4: [[14, 20], [36, 6], [64, 6], [86, 20]],
  5: [[10, 22], [28, 8], [50, 0], [72, 8], [90, 22]],
};
function tokenStarArcHtml(ovr) {
  const n = ovrStarCount(ovr);
  if (!n) return '';
  const tier = ovrStarTier(ovr);
  const pts = STAR_ARC_LAYOUT[n] || STAR_ARC_LAYOUT[1];
  const stars = pts.map(([l, t]) =>
    `<span class="token-star" style="left:${l}%;top:${t}%">★</span>`
  ).join('');
  return `<div class="token-star-arc ${tier}">${stars}</div>`;
}
function tokenOvrPillHtml(baseOvr, formBonus) {
  if (baseOvr == null) return '';
  const bonus = formBonus || 0;
  const effectiveOvr = baseOvr + bonus;
  const tier = ovrStarTier(effectiveOvr);
  const bonusStr = bonus !== 0
    ? `<span class="form-bonus-badge ${bonus > 0 ? 'plus' : 'minus'}">${bonus > 0 ? '+' : ''}${bonus}</span>`
    : '';
  return `<div class="token-ovr-pill ${tier}"><span class="token-ovr-label">OVR+</span><span class="token-ovr-val">${Math.round(baseOvr)}</span>${bonusStr}</div>`;
}
function buildTokenInnerHtml(p, pos, ovr, subPid) {
  let subStr = '';
  if (subPid) {
    const subP = players.find(x => x.id === subPid);
    if (subP) subStr = `<div class="token-sub">🔄 ${subP.jersey != null ? subP.jersey + ' ' : ''}${subP.name}</div>`;
  }
  const circleColor = posColor(pos ? [pos] : p.positions);
  const bonus = p.formBonus || 0;
  const effectiveOvr = ovr != null ? ovr + bonus : null;
  return `<div class="token-avatar-wrap">
    ${effectiveOvr != null ? tokenStarArcHtml(effectiveOvr) : ''}
    <div class="token-circle" style="background:${circleColor}">
      ${p.name.slice(0, 2)}
      ${pos ? `<span class="token-pos-badge">${pos}</span>` : ''}
    </div>
  </div>
  ${tokenOvrPillHtml(ovr, bonus)}${subStr}`;
}
function tokenAtSlot(slotIdx, excludePid) {
  // 1차: slotIdx 정확히 일치
  const exact = fieldTokens.find(t => t.slotIdx === slotIdx && t.pid !== excludePid);
  if (exact) return exact;
  // 2차: slotIdx가 어긋난 경우 슬롯 중심 좌표 근접 거리로 탐색 (0.03 이내)
  const slots = getSlots();
  if (!slots[slotIdx]) return undefined;
  const [sx, sy] = slots[slotIdx];
  return fieldTokens.find(t =>
    t.pid !== excludePid &&
    typeof t.freeX === 'number' && typeof t.freeY === 'number' &&
    Math.hypot(t.freeX - sx, t.freeY - sy) < 0.03
  );
}

// ── 포지션별 슬롯 수 체크 ──
// 해당 포지션이 배치 가능한 슬롯 총 수 vs 이미 배치된 수 비교
function countSlotsByPos(pos) {
  // 현재 포메이션에서 이 포지션을 수용하는 슬롯 수
  const labels = getLabels();
  return labels.filter(l => slotAcceptsPos(l, pos)).length;
}
function countFieldByPos(pos, excludePid) {
  // slotIdx >= 0 인 토큰만 카운트 (자유 위치 토큰은 슬롯 점유 안 함)
  const labels = getLabels();
  return fieldTokens.filter(t =>
    t.pid !== excludePid &&
    t.slotIdx >= 0 &&
    t.slotIdx < labels.length &&
    slotAcceptsPos(labels[t.slotIdx], pos)
  ).length;
}
function checkSlotCapacity(pos, excludePid) {
  // return null = OK, string = 오류 메시지
  if (!isFormationSelected()) return '포메이션을 선택해주세요.';
  const cap = countSlotsByPos(pos);
  if (cap === 0) return `현재 포메이션에 ${pos} 자리가 없습니다.`;
  const cur = countFieldByPos(pos, excludePid);
  if (cur >= cap) return `${pos} 자리가 이미 꽉 찼습니다. (${cap}/${cap})`;
  return null;
}

// ── 구글 시트 동기화 ──
function updateSyncBar(state, msg) {
  const bar = document.getElementById('syncBar');
  const text = document.getElementById('syncText');
  if (!bar) return;
  // admin-only 클래스가 있는 syncInfo는 건드리지 않고 bar state만 변경
  bar.className = 'sync-bar ' + state;
  if (text) text.textContent = msg;
}
function handleSaveError(e) {
  console.error(e);
  updateSyncBar('error', '저장 실패');
  alert('저장에 실패했습니다. 인터넷 연결을 확인해주세요.');
}
function normalizeFieldTokens(raw) {
  return (raw || []).map(t => {
    // 구버전: slotIdx 없음 → {x,y} 좌표 방식
    if (t.slotIdx === undefined) {
      return { pid: t.pid, slotIdx: -1, freeX: t.x ?? 0.5, freeY: t.y ?? 0.5, pos: t.pos || '' };
    }
    // 현재 버전: pid/slotIdx 있음, 나머지 필드 기본값 보장
    return {
      pid: t.pid,
      slotIdx: t.slotIdx ?? -1,
      freeX: t.freeX ?? 0.5,
      freeY: t.freeY ?? 0.5,
      pos: t.pos || '',
      ...(t.subPid != null ? { subPid: t.subPid } : {}),
    };
  });
}
// 구 포지션 → 신 포지션 전체 마이그레이션 테이블
const POS_MIGRATION_MAP = {
  'LWB':'LB', 'RWB':'RB',
  'DF':'CB',
  'CM':'CDM', 'MF':'CDM',
  'LM':'LW',  'RM':'RW',
  'CF':'ST',  'FW':'ST',
};
function migratePos(pos) { return POS_MIGRATION_MAP[pos] || pos; }

// 단일 포지션 이름 마이그레이션 (필드 토큰 pos, 세이브 tokens.pos 등)
function migrateWingback(pos) { return migratePos(pos); }

// 선수 객체 포지션·OVR 키 마이그레이션
function migratePlayerPos(p) {
  const rawPos = p.positions || [];
  const newPos = [...new Set(rawPos.map(migratePos))];
  const changed = JSON.stringify(newPos) !== JSON.stringify(rawPos);
  if (!changed) return p;
  const newOvr = {...(p.ovr || {})};
  // 구 포지션 OVR 값 → 신 포지션 키로 이전 (신 키가 없을 때만)
  rawPos.forEach(old => {
    const neo = migratePos(old);
    if (neo !== old) {
      if (newOvr[old] != null && newOvr[neo] == null) newOvr[neo] = newOvr[old];
      delete newOvr[old];
    }
  });
  return {...p, positions: newPos, ovr: newOvr};
}

function applyRemoteData(data) {
  const emptyRoster = isPlatformClub() ? [] : DEFAULT_PLAYERS.map(p => ({...p}));
  players = (data.players?.length ? data.players : emptyRoster)
    .map(p => normalizePlayerOvr(migratePlayerPos({...p})));
  matches = normalizeMatchDates(data.matches || []);
  myTeamName = data.meta?.myTeam || '';
  if (!myTeamName && isPlatformClub()) myTeamName = window.__CLUB__?.name || '';
  if (!myTeamName) myTeamName = localStorage.getItem('fc_myteam') || '';
  if (myTeamName && !isPlatformClub()) localStorage.setItem('fc_myteam', myTeamName);
  // 시트에 저장된 비밀번호로 로컬 동기화 (기기 간 비밀번호 통일)
  syncMetaPasswords(data.meta);
  // 총무 데이터 (시트 Date/ISO → YYYY-MM-DD)
  dues        = normalizeDuesDates(data.dues || []);
  expenses    = normalizeExpenseDates(data.expenses || []);
  settlements = normalizeSettlementDates(data.settlements || []);
  schedules     = normalizeScheduleDates(data.schedules || []);
  notices       = normalizeNoticeDates(data.notices || []);
  dueExemptions = normalizeExemptionMonths(data.dueExemptions || []);
  dueMemos      = normalizeDueMemos(data.dueMemos || []);
  disciplines   = normalizeDisciplineDates(data.disciplines || []);
  if (cleanupTreasurerData()) {
    persistExpenses().catch(() => {});
    persistSettlements().catch(() => {});
  }
  // 슬라이드쇼 URLs
  const rawUrls = data.meta?.teamPhotoUrls;
  if (rawUrls && rawUrls !== '[]') {
    try { photoUrls = typeof rawUrls === 'string' ? JSON.parse(rawUrls) : rawUrls; } catch(e) { photoUrls = []; }
  } else {
    const single = normalizePhotoUrl(data.meta?.teamPhotoUrl || '');
    photoUrls = single ? [single] : [];
  }
  photoUrls = photoUrls.map(u => normalizePhotoUrl(u)).filter(Boolean);
  if (!photoUrls.length && !isPlatformClub()) {
    const rawPhotosL = localStorage.getItem('fc_team_photos');
    if (rawPhotosL) { try { photoUrls = JSON.parse(rawPhotosL); } catch(e) {} }
    else { const s = localStorage.getItem('fc_team_photo'); if (s) photoUrls = [s]; }
    photoUrls = photoUrls.map(u => normalizePhotoUrl(u)).filter(Boolean);
  }
  teamPhotoUrl = photoUrls[0] || '';
  if (teamPhotoUrl && !isPlatformClub()) localStorage.setItem('fc_team_photo', teamPhotoUrl);
  if (photoUrls.length && !isPlatformClub()) localStorage.setItem('fc_team_photos', JSON.stringify(photoUrls));
  // 슬라이드 간격
  const rawInterval = data.meta?.photoInterval;
  if (rawInterval != null) photoInterval = Math.max(3, Number(rawInterval) || 10);
  // 슬라이드 transforms
  const rawPT = data.meta?.teamPhotoTransforms;
  if (rawPT) {
    try { photoTransforms = typeof rawPT === 'string' ? JSON.parse(rawPT) : rawPT; } catch(e) { photoTransforms = []; }
  } else {
    const st = data.meta?.teamPhotoTransform;
    if (typeof st === 'string' && st) {
      try { photoTransforms = [JSON.parse(st)]; } catch(e) { photoTransforms = []; }
    } else {
      photoTransforms = st && typeof st === 'object' ? [{ x: st.x||0, y: st.y||0, scale: st.scale||1 }] : [];
    }
    const lt = localStorage.getItem('fc_photo_transform');
    if (!photoTransforms.length && lt && !isPlatformClub()) try { photoTransforms = [JSON.parse(lt)]; } catch(e) {}
  }
  currentPhotoIdx = 0;
  photoTransform = photoTransforms[0] || { x:0, y:0, scale:1 };
  loadWageRates(data.meta);
  // 프레젠테이션 스케일
  const rawPS = data.meta?.presentScales;
  if (rawPS) {
    try {
      const ps = typeof rawPS === 'string' ? JSON.parse(rawPS) : rawPS;
      presentScales = { ...presentScales, ...ps };
      if (ps.panel != null && ps.panelLeft == null) presentScales.panelLeft = ps.panel;
    } catch(e) {}
  }
  // formationSaves 마이그레이션 (구형식 → q1, 포지션 마이그레이션)
  formationSaves = (data.saves || []).map(sv => {
    const migrateT = t => ({...t, pos: migratePos(t.pos || '')});
    const normDate = sv.date ? normalizeDate(sv.date) : sv.date;
    if (sv.q1tokens !== undefined) {
      const migrated = {...sv, date: normDate};
      for (let q = 1; q <= 4; q++) {
        migrated['q'+q+'tokens'] = (sv['q'+q+'tokens'] || []).map(migrateT);
      }
      return migrated;
    } else {
      return {
        ...sv,
        date: normDate,
        q1formation: sv.formation || '',
        q1tokens: (sv.tokens || []).map(migrateT),
        q2formation:'', q2tokens:[],
        q3formation:'', q3tokens:[],
        q4formation:'', q4tokens:[],
      };
    }
  });
  const field = data.field || {};
  const migrateT = t => ({...t, pos: migratePos(t.pos || '')});
  if (field.q1tokens !== undefined) {
    for (let q = 1; q <= 4; q++) {
      const rawTokens = field['q'+q+'tokens'] || [];
      const formation = field['q'+q+'formation'] || '';
      const tokens = normalizeFieldTokens(rawTokens).map(migrateT);
      quarterData[q] = (!tokens.length && !formation) ? null : { formation, tokens };
    }
    activeQuarter = field.activeQuarter || 1;
  } else {
    const tokens = normalizeFieldTokens(field.tokens || []).map(migrateT);
    quarterData[1] = { formation: field.formation || '', tokens };
    quarterData[2] = null; quarterData[3] = null; quarterData[4] = null;
    activeQuarter = 1;
  }
  const qd = quarterData[activeQuarter] || { formation: '', tokens: [] };
  fieldTokens = qd.tokens;
  const formation = resolveFormation(qd.formation, fieldTokens);
  if (formation) saveFormationLocal(formation);
  setFormationSelect(formation);
  if (formation) reconcileFieldTokensToFormation();
  updateQuarterButtons();
  if (myTeamName && syncAllMatchTeamNames(myTeamName)) {
    persistMatches().catch(() => {});
  }
}
async function maybeMigrateLocal(data) {
  if (isPlatformClub()) return data;
  const remoteEmpty = !data.players?.length && !data.matches?.length && !data.saves?.length;
  if (!remoteEmpty) return data;
  const lp = localStorage.getItem('fc_players');
  const lm = localStorage.getItem('fc_matches');
  const lf = localStorage.getItem('fc_field');
  const ls = localStorage.getItem('fc_saves');
  const lt = localStorage.getItem('fc_myteam');
  if (!lp && (!lm || lm === '[]') && !lf && (!ls || ls === '[]')) return data;
  const migrated = {
    players: lp ? JSON.parse(lp) : [],
    matches: lm ? JSON.parse(lm) : [],
    field: lf ? { formation: localStorage.getItem('fc_formation') || '4-3-3', tokens: JSON.parse(lf) } : (data.field || { formation: '4-3-3', tokens: [] }),
    saves: ls ? JSON.parse(ls) : [],
    meta: {
      myTeam: lt || '',
      teamPhotoUrls: localStorage.getItem('fc_team_photos') || '',
      teamPhotoUrl: localStorage.getItem('fc_team_photo') || '',
    },
  };
  await apiSavePartial(migrated);
  return migrated;
}
function loadLocalFallback() {
  if (isPlatformClub()) {
    players = [];
    matches = [];
    formationSaves = [];
    myTeamName = window.__CLUB__?.name || '';
    photoUrls = [];
    teamPhotoUrl = '';
    photoTransforms = [];
    photoTransform = { x: 0, y: 0, scale: 1 };
    dues = [];
    expenses = [];
    settlements = [];
    schedules = [];
    notices = [];
    dueExemptions = [];
    dueMemos = [];
    disciplines = [];
    loadFieldState();
    return;
  }
  const s = localStorage.getItem('fc_players');
  players = (s ? JSON.parse(s) : DEFAULT_PLAYERS.map(p => ({...p}))).map(p => normalizePlayerOvr(migratePlayerPos({...p})));
  matches = normalizeMatchDates(JSON.parse(localStorage.getItem('fc_matches') || '[]'));
  const rawSaves = JSON.parse(localStorage.getItem('fc_saves') || '[]');
  formationSaves = rawSaves.map(sv => {
    const migrateT = t => ({...t, pos: migratePos(t.pos || '')});
    if (sv.q1tokens !== undefined) {
      const migrated = {...sv};
      for (let q = 1; q <= 4; q++) {
        migrated['q'+q+'tokens'] = (sv['q'+q+'tokens'] || []).map(migrateT);
      }
      return migrated;
    }
    return {
      ...sv,
      q1formation: sv.formation || '',
      q1tokens: (sv.tokens || []).map(migrateT),
      q2formation:'', q2tokens:[],
      q3formation:'', q3tokens:[],
      q4formation:'', q4tokens:[],
    };
  });
  myTeamName = localStorage.getItem('fc_myteam') || '';
  const rawPhotosL = localStorage.getItem('fc_team_photos');
  if (rawPhotosL) { try { photoUrls = JSON.parse(rawPhotosL); } catch(e) {} }
  else { const s = localStorage.getItem('fc_team_photo'); photoUrls = s ? [s] : []; }
  photoUrls = photoUrls.map(u => normalizePhotoUrl(u)).filter(Boolean);
  teamPhotoUrl = photoUrls[0] || '';
  const rawPT2 = localStorage.getItem('fc_photo_transforms');
  if (rawPT2) { try { photoTransforms = JSON.parse(rawPT2); } catch(e) {} }
  else { const lt = localStorage.getItem('fc_photo_transform'); if (lt) try { photoTransforms = [JSON.parse(lt)]; } catch(e) {} }
  const rawPI = localStorage.getItem('fc_photo_interval');
  if (rawPI) photoInterval = Math.max(3, parseInt(rawPI) || 10);
  currentPhotoIdx = 0;
  photoTransform = photoTransforms[0] || { x:0, y:0, scale:1 };
  dues        = normalizeDuesDates(JSON.parse(localStorage.getItem('fc_dues')        || '[]'));
  expenses    = normalizeExpenseDates(JSON.parse(localStorage.getItem('fc_expenses')    || '[]'));
  settlements = normalizeSettlementDates(JSON.parse(localStorage.getItem('fc_settlements') || '[]'));
  schedules     = normalizeScheduleDates(JSON.parse(localStorage.getItem('fc_schedules')     || '[]'));
  notices       = normalizeNoticeDates(JSON.parse(localStorage.getItem('fc_notices')       || '[]'));
  dueExemptions = normalizeExemptionMonths(JSON.parse(localStorage.getItem('fc_due_exemptions') || '[]'));
  dueMemos      = normalizeDueMemos(JSON.parse(localStorage.getItem('fc_due_memos') || '[]'));
  disciplines   = normalizeDisciplineDates(JSON.parse(localStorage.getItem('fc_disciplines') || '[]'));
  cleanupTreasurerData();
  loadFieldState();
}
function hasLocalData() {
  if (isPlatformClub()) return false;
  return !!(localStorage.getItem('fc_players')
    || (localStorage.getItem('fc_matches') && localStorage.getItem('fc_matches') !== '[]')
    || localStorage.getItem('fc_field')
    || (localStorage.getItem('fc_saves') && localStorage.getItem('fc_saves') !== '[]'));
}
async function bootstrapApp() {
  setSyncHandler(updateSyncBar);
  try {
    let data = await apiLoadAll();
    if (isPlatformClub() && !data.players?.length && typeof window.apiEnsureClubRoster === 'function') {
      try {
        await window.apiEnsureClubRoster();
        data = await apiLoadAll(true);
      } catch (e) {
        console.warn('[bootstrap] ensure_club_roster:', e);
      }
    }
    const remoteEmpty = !data.players?.length && !data.matches?.length && !data.saves?.length;
    data = await maybeMigrateLocal(data);
    applyRemoteData(data);
    if (remoteEmpty && !hasLocalData()) {
      if (!isPlatformClub()) await persistPlayers();
      if (!isPlatformClub()) await persistField();
    }
  } catch (e) {
    console.error(e);
    updateSyncBar('error', '오프라인 (로컬 데이터)');
    loadLocalFallback();
  }
  renderHome();
  renderRoster();
  renderRecords();
  renderFormationSaves();
  populateStatsYearFilter();
  document.getElementById('formationSelect').addEventListener('change', () => {
    const f = getFormation();
    if (f) saveFormationLocal(f);
    remapTokensToNewFormation();
    slotHighlight = -1;
    drawFieldCanvas(-1);
    renderField();
    persistField().catch(handleSaveError);
    // 비관리자용 포메이션 레이블 갱신
    const vl = document.getElementById('formationViewLabel');
    if (vl) vl.textContent = f || '';
  });
  // 초기 관리자·총무 모드 적용 (새로고침 시 항상 비로그인)
  applyAdminMode();
  applyTreasurerMode();
  checkNewNoticeAlert();
  // 30초마다 자동 갱신 시작
  startPolling();
}
async function persistPlayers() {
  localStorage.setItem('fc_players', JSON.stringify(players));
  await apiSavePartial({ players });
}
async function persistField() {
  quarterData[activeQuarter] = {
    formation: getFormationForSave(),
    tokens: JSON.parse(JSON.stringify(fieldTokens))
  };
  if (quarterData[activeQuarter].formation) saveFormationLocal(quarterData[activeQuarter].formation);
  const payload = { activeQuarter };
  for (let q = 1; q <= 4; q++) {
    const qd = quarterData[q] || {};
    payload['q'+q+'formation'] = qd.formation || '';
    payload['q'+q+'tokens'] = qd.tokens || [];
  }
  payload.formation = payload.q1formation || payload.q2formation || '';
  payload.tokens = payload.q1tokens || [];
  localStorage.setItem('fc_field_quarters', JSON.stringify({quarterData, activeQuarter}));
  localStorage.setItem('fc_field', JSON.stringify(fieldTokens));
  localStorage.setItem('fc_field_full', JSON.stringify({formation: payload.formation, tokens: fieldTokens}));
  await apiSavePartial({ field: payload });
}
async function persistMatches() { await apiSavePartial({ matches }); }
async function persistSaves() { await apiSavePartial({ saves: formationSaves }); }
async function persistMeta() {
  const adminPw = isPlatformClub() ? undefined : (localStorage.getItem('fc_admin_pw') || undefined);
  const treasurerPw = isPlatformClub() ? undefined : (localStorage.getItem('fc_treasurer_pw') || undefined);
  photoTransforms[currentPhotoIdx] = { ...photoTransform };
  const meta = {
    myTeam: myTeamName || localStorage.getItem('fc_myteam') || '',
    teamPhotoUrl: photoUrls[0] || '',
    teamPhotoUrls: JSON.stringify(photoUrls),
    photoInterval: String(photoInterval),
    teamPhotoTransform: JSON.stringify(photoTransform),
    teamPhotoTransforms: JSON.stringify(photoTransforms),
    ...(adminPw     ? { adminPw }     : {}),
    ...(treasurerPw ? { treasurerPw } : {}),
    presentScales: JSON.stringify(presentScales),
    wageRates: JSON.stringify(wageRates),
  };
  await apiSavePartial({ meta });
  localStorage.setItem('fc_myteam', myTeamName || '');
  localStorage.setItem('fc_team_photos', JSON.stringify(photoUrls));
  localStorage.setItem('fc_photo_transforms', JSON.stringify(photoTransforms));
  localStorage.setItem('fc_photo_interval', String(photoInterval));
  if (photoUrls[0]) localStorage.setItem('fc_team_photo', photoUrls[0]);
  else localStorage.removeItem('fc_team_photo');
  localStorage.setItem('fc_photo_transform', JSON.stringify(photoTransform));
}
function normalizePhotoUrl(url) {
  if (!url) return '';
  const u = url.trim();
  // Google Drive: /file/d/ID/view 또는 ?id=ID 형태 모두 처리
  const fileId = u.match(/\/file\/d\/([^/?]+)/)?.[1]
    || (u.includes('drive.google.com') && u.match(/[?&]id=([^&]+)/)?.[1]);
  if (fileId) {
    // Google Drive thumbnail API: 공유 설정 무관하게 가장 안정적으로 로드됨
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
  }
  // OneDrive / Windows 공유 링크 → 직접 표시 불가
  if (/onedrive\.live\.com|1drv\.ms|sharepoint\.com/i.test(u)) return '__onedrive__';
  return u;
}

// ── 홈 (단체 사진 · 클럽원) ──
function getPhotoFrameMetrics() {
  const wrap = document.getElementById('homePhotoWrap');
  const img = document.getElementById('homePhoto');
  if (!wrap || !img || !img.naturalWidth || !img.naturalHeight) return null;
  const cw = wrap.clientWidth;
  const ch = wrap.clientHeight;
  if (!cw || !ch) return null;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const coverK = Math.max(cw / nw, ch / nh);
  return { cw, ch, coverW: nw * coverK, coverH: nh * coverK };
}
function clampPhotoTransform() {
  const m = getPhotoFrameMetrics();
  if (!m) {
    photoTransform.scale = Math.max(PHOTO_SCALE_MIN, Math.min(PHOTO_SCALE_MAX, photoTransform.scale || 1));
    return;
  }
  photoTransform.scale = Math.max(PHOTO_SCALE_MIN, Math.min(PHOTO_SCALE_MAX, photoTransform.scale || 1));
  const dispW = m.coverW * photoTransform.scale;
  const dispH = m.coverH * photoTransform.scale;
  const maxX = Math.max(0, (dispW - m.cw) / 2);
  const maxY = Math.max(0, (dispH - m.ch) / 2);
  photoTransform.x = Math.max(-maxX, Math.min(maxX, photoTransform.x || 0));
  photoTransform.y = Math.max(-maxY, Math.min(maxY, photoTransform.y || 0));
}
function applyPhotoTransform() {
  const img = document.getElementById('homePhoto');
  if (!img) return;
  clampPhotoTransform();
  const m = getPhotoFrameMetrics();
  if (m) {
    img.style.width = (m.coverW * photoTransform.scale) + 'px';
    img.style.height = (m.coverH * photoTransform.scale) + 'px';
    img.style.objectFit = 'fill';
  }
  img.style.transform = `translate(calc(-50% + ${photoTransform.x}px), calc(-50% + ${photoTransform.y}px))`;
  img.style.transformOrigin = 'center center';
}
let _photoSaveTimer = null;
function savePhotoTransform() {
  photoTransforms[currentPhotoIdx] = { ...photoTransform };
  clearTimeout(_photoSaveTimer);
  _photoSaveTimer = setTimeout(() => {
    persistMeta().catch(handleSaveError);
  }, 600);
}
function resetPhotoTransform() {
  photoTransform = { x: 0, y: 0, scale: 1 };
  photoTransforms[currentPhotoIdx] = { ...photoTransform };
  applyPhotoTransform();
  persistMeta().catch(handleSaveError);
}
// ── 슬라이드쇼 ──
function goToPhoto(idx) {
  if (!photoUrls.length) return;
  photoTransforms[currentPhotoIdx] = { ...photoTransform };
  currentPhotoIdx = ((idx % photoUrls.length) + photoUrls.length) % photoUrls.length;
  photoTransform = photoTransforms[currentPhotoIdx] || { x:0, y:0, scale:1 };
  const img = document.getElementById('homePhoto');
  if (img) {
    img.onload = () => applyPhotoTransform();
    img.src = photoUrls[currentPhotoIdx];
    if (img.complete) applyPhotoTransform();
  }
  updateSlideDots();
  startSlideTimer();
}
function nextPhoto() { goToPhoto(currentPhotoIdx + 1); }
function prevPhoto() { goToPhoto(currentPhotoIdx - 1); }
function startSlideTimer() {
  stopSlideTimer();
  if (photoUrls.length > 1 && photoInterval > 0) {
    _slideTimer = setTimeout(() => { nextPhoto(); }, photoInterval * 1000);
  }
}
function stopSlideTimer() {
  if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
}
function updateSlideDots() {
  document.querySelectorAll('.slide-dot').forEach((d, i) => {
    d.classList.toggle('active', i === currentPhotoIdx);
  });
}
function initPhotoDrag() {
  const wrap = document.getElementById('homePhotoWrap');
  if (!wrap || wrap._photoDragInit) return;
  wrap._photoDragInit = true;
  let pd = { active: false, startX: 0, startY: 0, startTX: 0, startTY: 0 };
  // 마우스 드래그
  wrap.addEventListener('mousedown', e => {
    if (e.target.closest('button')) return;
    if (!isAdmin || !photoUrls.length) return;
    pd = { active: true, startX: e.clientX, startY: e.clientY, startTX: photoTransform.x, startTY: photoTransform.y };
    wrap.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!pd.active) return;
    photoTransform.x = pd.startTX + (e.clientX - pd.startX);
    photoTransform.y = pd.startTY + (e.clientY - pd.startY);
    applyPhotoTransform();
  });
  document.addEventListener('mouseup', () => {
    if (!pd.active) return;
    pd.active = false;
    const w = document.getElementById('homePhotoWrap');
    if (w) w.style.cursor = '';
    savePhotoTransform();
  });
  // 터치 드래그
  let pinchDist0 = 0, pinchScale0 = 1;
  wrap.addEventListener('touchstart', e => {
    if (!isAdmin || !photoUrls.length) return;
    if (e.touches.length === 1) {
      const t = e.touches[0];
      pd = { active: true, startX: t.clientX, startY: t.clientY, startTX: photoTransform.x, startTY: photoTransform.y };
    } else if (e.touches.length === 2) {
      pd.active = false;
      pinchDist0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      pinchScale0 = photoTransform.scale;
    }
  }, { passive: true });
  wrap.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && pd.active) {
      const t = e.touches[0];
      photoTransform.x = pd.startTX + (t.clientX - pd.startX);
      photoTransform.y = pd.startTY + (t.clientY - pd.startY);
      applyPhotoTransform();
      e.preventDefault();
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      photoTransform.scale = Math.max(PHOTO_SCALE_MIN, Math.min(PHOTO_SCALE_MAX, pinchScale0 * (dist / pinchDist0)));
      applyPhotoTransform();
      e.preventDefault();
    }
  }, { passive: false });
  wrap.addEventListener('touchend', () => {
    if (pd.active) { pd.active = false; savePhotoTransform(); }
    else savePhotoTransform();
  });
  // 마우스 휠 줌
  wrap.addEventListener('wheel', e => {
    if (!isAdmin || !photoUrls.length) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    photoTransform.scale = Math.max(PHOTO_SCALE_MIN, Math.min(PHOTO_SCALE_MAX, photoTransform.scale + delta));
    applyPhotoTransform();
    savePhotoTransform();
  }, { passive: false });
  let _photoResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_photoResizeTimer);
    _photoResizeTimer = setTimeout(() => {
      if (!photoUrls.length) return;
      applyPhotoTransform();
    }, 80);
  });
}
function renderHome() {
  const nameEl = document.getElementById('homeTeamName');
  if (nameEl) nameEl.textContent = myTeamName || '우리 FC';
  const img = document.getElementById('homePhoto');
  const ph  = document.getElementById('homePhotoPlaceholder');
  const wrap = document.getElementById('homePhotoWrap');
  const currentUrl = photoUrls[currentPhotoIdx] || '';
  if (img && ph) {
    if (currentUrl) {
      img.draggable = false;
      img.style.display = 'block';
      ph.style.display = 'none';
      img.onerror = () => { img.style.display = 'none'; ph.style.display = 'flex'; };
      img.onload = () => applyPhotoTransform();
      img.src = currentUrl;
      if (img.complete) applyPhotoTransform();
    } else {
      img.style.display = 'none';
      img.removeAttribute('src');
      ph.style.display = 'flex';
    }
  }
  initPhotoDrag();
  // 초기화 버튼
  let resetBtn = document.getElementById('photoResetBtn');
  if (wrap && currentUrl) {
    if (!resetBtn) {
      resetBtn = document.createElement('button');
      resetBtn.id = 'photoResetBtn';
      resetBtn.type = 'button';
      resetBtn.className = 'btn-photo-reset';
      resetBtn.title = '사진 위치/크기 초기화';
      resetBtn.textContent = '↺';
      resetBtn.onclick = resetPhotoTransform;
      wrap.appendChild(resetBtn);
    }
    resetBtn.style.display = 'block';
  } else if (resetBtn) {
    resetBtn.style.display = 'none';
  }
  // 슬라이드 UI (prev/next/dots) 재생성
  if (wrap) {
    wrap.querySelectorAll('.slide-prev,.slide-next,.slide-dots').forEach(el => el.remove());
    if (photoUrls.length > 1) {
      const prev = document.createElement('button');
      prev.type = 'button'; prev.className = 'slide-prev'; prev.innerHTML = '&#x2039;';
      prev.onclick = e => { e.stopPropagation(); prevPhoto(); };
      wrap.appendChild(prev);
      const next = document.createElement('button');
      next.type = 'button'; next.className = 'slide-next'; next.innerHTML = '&#x203A;';
      next.onclick = e => { e.stopPropagation(); nextPhoto(); };
      wrap.appendChild(next);
      const dots = document.createElement('div');
      dots.className = 'slide-dots';
      photoUrls.forEach((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'slide-dot' + (i === currentPhotoIdx ? ' active' : '');
        d.onclick = e => { e.stopPropagation(); goToPhoto(i); };
        dots.appendChild(d);
      });
      wrap.appendChild(dots);
    }
  }
  // 타이머 재시작
  stopSlideTimer();
  if (photoUrls.length > 1) startSlideTimer();
  // 클럽원 그리드
  const members    = players.filter(p => !p.isMercenary);
  const mercenaries = players.filter(p => p.isMercenary);
  const countEl = document.getElementById('homeMemberCount');
  if (countEl) countEl.textContent = `(${members.length}명)`;
  const grid = document.getElementById('homeMemberGrid');
  if (grid) {
    const sortFn = (a, b) => {
      if (a.jersey == null && b.jersey == null) return 0;
      if (a.jersey == null) return 1;
      if (b.jersey == null) return -1;
      return a.jersey - b.jersey;
    };
    const sortedMembers = [...members].sort(sortFn);
    const sortedMercs   = [...mercenaries].sort(sortFn);
    const memberChips = sortedMembers.map(p =>
      `<div class="home-member-chip">${p.jersey != null ? `<span class="home-member-no">${p.jersey}</span>` : ''}${p.name}</div>`
    ).join('');
    const mercChips = sortedMercs.map(p =>
      `<div class="home-member-chip mercenary">${p.jersey != null ? `<span class="home-member-no">${p.jersey}</span>` : ''}${p.name}</div>`
    ).join('');
    const mercSection = sortedMercs.length
      ? `<div class="home-section-divider">\uC6A9\uBCD1 (${sortedMercs.length}\uBA85)</div>${mercChips}`
      : '';
    grid.innerHTML = (sortedMembers.length || sortedMercs.length)
      ? memberChips + mercSection
      : '<div style="font-size:12px;color:var(--text3)">\uBA85\uB2E8 \uD0ED\uC5D0\uC11C \uC120\uC218\uB97C \uCD94\uAC00\uD574\uC8FC\uC138\uC694</div>';
  }
}
function refreshHomeIfVisible() {
  if (document.getElementById('tab-home')?.classList.contains('active')) renderHome();
}

// ── 경기 일정 ──
async function persistSchedules() {
  await apiSavePartial({ schedules });
  localStorage.setItem('fc_schedules', JSON.stringify(schedules));
}
function openScheduleModal() {
  renderScheduleModalContent();
  document.getElementById('scheduleModal').classList.add('open');
}
function closeScheduleModal() {
  document.getElementById('scheduleModal').classList.remove('open');
}
function renderScheduleModalContent() {
  const el = document.getElementById('scheduleModalBody');
  if (!el) return;
  const sorted = schedules.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = sorted.filter(s => (s.date || '') >= today);
  const cards = (upcoming.length ? upcoming : sorted).map(s => `
    <div class="home-schedule-card">
      <div class="home-schedule-date">${formatDateDisplay(s.date)}${s.time ? ' ' + formatTimeDisplay(s.time) : ''}</div>
      <div class="home-schedule-opp">vs ${s.opponent || '-'}</div>
      ${s.note ? `<div class="home-schedule-note">${s.note}</div>` : ''}
      ${isAdmin ? `<div class="home-schedule-admin">
        <button class="tr-btn-sm" onclick="editSchedule(${s.id})">\uC218\uC815</button>
        <button class="tr-btn-sm danger" onclick="deleteSchedule(${s.id})">\uC0AD\uC81C</button>
      </div>` : ''}
    </div>`).join('');
  el.innerHTML = cards || '<div class="tr-empty">\uB4F1\uB85D\uB41C \uACBD\uAE30 \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
  const addBtn = document.getElementById('scheduleAddBtn');
  if (addBtn) addBtn.style.display = isAdmin ? '' : 'none';
}
let editingScheduleId = null;
function openScheduleEditModal(id) {
  editingScheduleId = id || null;
  const s = id ? schedules.find(x => x.id == id) : null;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('schedDate').value = normalizeDate(s?.date) || today;
  document.getElementById('schedTime').value = normalizeTime(s?.time) || '';
  document.getElementById('schedOpponent').value = s?.opponent || '';
  document.getElementById('schedNote').value = s?.note || '';
  document.getElementById('scheduleEditModal').classList.add('open');
}
function editSchedule(id) { openScheduleEditModal(id); }
function closeScheduleEditModal() {
  document.getElementById('scheduleEditModal').classList.remove('open');
}
function saveScheduleItem() {
  const date = normalizeDate(document.getElementById('schedDate').value);
  const time = normalizeTime(document.getElementById('schedTime').value.trim());
  const opponent = document.getElementById('schedOpponent').value.trim();
  const note = document.getElementById('schedNote').value.trim();
  if (!date || !opponent) { alert('\uB0A0\uC9DC\uC640 \uC0C1\uB300 \uD300\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
  const item = { date, time, opponent, note };
  if (editingScheduleId) {
    const idx = schedules.findIndex(x => x.id == editingScheduleId);
    if (idx >= 0) schedules[idx] = { ...schedules[idx], ...item };
  } else {
    schedules.push({ id: Date.now(), ...item });
  }
  closeScheduleEditModal();
  persistSchedules().catch(handleSaveError);
  renderScheduleModalContent();
}
function deleteSchedule(id) {
  if (!confirm('\uC774 \uACBD\uAE30 \uC77C\uC815\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
  schedules = schedules.filter(s => s.id != id);
  persistSchedules().catch(handleSaveError);
  renderScheduleModalContent();
}

// ── 공지사항 ──
let openNoticeId = null;
async function persistNotices() {
  await apiSavePartial({ notices });
  localStorage.setItem('fc_notices', JSON.stringify(notices));
}
function openNoticeModal() {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem('fc_notice_opened_date', today);
  renderNoticeModalContent();
  document.getElementById('noticeModal').classList.add('open');
}
function closeNoticeModal() {
  document.getElementById('noticeModal').classList.remove('open');
}
function renderNoticeModalContent() {
  const el = document.getElementById('noticeModalBody');
  if (!el) return;
  el.innerHTML = notices.map((n, i) => {
    const open = openNoticeId == n.id;
    const reorder = isAdmin ? `<div class="home-notice-reorder">
        <button type="button" class="btn-num" onclick="moveNotice(${n.id},-1)" ${i === 0 ? 'disabled' : ''} title="\uC704\uB85C">\u25B2</button>
        <button type="button" class="btn-num" onclick="moveNotice(${n.id},1)" ${i === notices.length - 1 ? 'disabled' : ''} title="\uC544\uB798\uB85C">\u25BC</button>
      </div>` : '';
    return `<div class="home-notice-item ${open ? 'open' : ''}">
      <div class="home-notice-head-row">
        ${reorder}
        <button type="button" class="home-notice-head" onclick="toggleNoticeItem(${n.id})">
          <span class="home-notice-title">${n.title || '\uC81C\uBAA9 \uC5C6\uC74C'}</span>
          <span class="home-notice-date">${formatDateDisplay(n.date)}</span>
        </button>
      </div>
      ${open ? `<div class="home-notice-body">${(n.body || '').replace(/\n/g, '<br>')}</div>` : ''}
      ${isAdmin ? `<div class="home-notice-admin">
        <button class="tr-btn-sm" onclick="editNotice(${n.id})">\uC218\uC815</button>
        <button class="tr-btn-sm danger" onclick="deleteNotice(${n.id})">\uC0AD\uC81C</button>
      </div>` : ''}
    </div>`;
  }).join('') || '<div class="tr-empty">\uB4F1\uB85D\uB41C \uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
  const addBtn = document.getElementById('noticeAddBtn');
  if (addBtn) addBtn.style.display = isAdmin ? '' : 'none';
}
function moveNotice(id, dir) {
  const idx = notices.findIndex(n => n.id == id);
  const ni = idx + dir;
  if (idx < 0 || ni < 0 || ni >= notices.length) return;
  [notices[idx], notices[ni]] = [notices[ni], notices[idx]];
  persistNotices().catch(handleSaveError);
  renderNoticeModalContent();
}
function toggleNoticeItem(id) {
  openNoticeId = openNoticeId == id ? null : id;
  renderNoticeModalContent();
}
let editingNoticeId = null;
function openNoticeEditModal(id) {
  editingNoticeId = id || null;
  const n = id ? notices.find(x => x.id == id) : null;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('noticeEditTitle').value = n?.title || '';
  document.getElementById('noticeEditBody').value = n?.body || '';
  document.getElementById('noticeEditDate').value = normalizeDate(n?.date) || today;
  document.getElementById('noticeEditModal').classList.add('open');
}
function editNotice(id) { openNoticeEditModal(id); }
function closeNoticeEditModal() {
  document.getElementById('noticeEditModal').classList.remove('open');
}
function saveNoticeItem() {
  const title = document.getElementById('noticeEditTitle').value.trim();
  const body = document.getElementById('noticeEditBody').value.trim();
  const date = normalizeDate(document.getElementById('noticeEditDate').value);
  if (!title || !body || !date) { alert('\uC81C\uBAA9\u00B7\uB0B4\uC6A9\u00B7\uB0A0\uC9DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4'); return; }
  const item = { title, body, date, createdAt: date };
  if (editingNoticeId) {
    const idx = notices.findIndex(x => x.id == editingNoticeId);
    if (idx >= 0) notices[idx] = { ...notices[idx], ...item };
  } else {
    notices.push({ id: Date.now(), ...item });
  }
  closeNoticeEditModal();
  persistNotices().catch(handleSaveError);
  renderNoticeModalContent();
}
function deleteNotice(id) {
  if (!confirm('\uC774 \uAE00\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
  notices = notices.filter(n => n.id != id);
  if (openNoticeId == id) openNoticeId = null;
  persistNotices().catch(handleSaveError);
  renderNoticeModalContent();
}
function checkNewNoticeAlert() {
  if (isAdmin) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('fc_notice_opened_date') === today) return;
  const count = notices.filter(n => normalizeDate(n.date) === today).length;
  if (count > 0) {
    alert(`\uC624\uB298 \uC0C8 \uAE00\uC774 ${count}\uAC74 \uC788\uC2B5\uB2C8\uB2E4.\n\u300C\uD68C\uCE59 \uBC0F \uC0AC\uC774\uD2B8 \uC18C\uAC1C\u300D\uC5D0\uC11C \uD655\uC778\uD574 \uC8FC\uC138\uC694.`);
  }
}
function openPhotoUrlModal() {
  photoEditSlots = photoUrls.map((url, i) => ({
    url,
    storagePath: typeof apiStoragePathFromPublicUrl === 'function' ? apiStoragePathFromPublicUrl(url) : null,
    pendingFile: null,
    previewUrl: null,
    transform: { ...(photoTransforms[i] || { x: 0, y: 0, scale: 1 }) },
  }));
  if (!photoEditSlots.length) {
    photoEditSlots.push({ url: '', storagePath: null, pendingFile: null, previewUrl: null, transform: { x: 0, y: 0, scale: 1 } });
  }
  const intEl = document.getElementById('photoIntervalInput');
  if (intEl) intEl.value = photoInterval;
  renderPhotoModalSlots();
  document.getElementById('photoUrlModal').classList.add('open');
}
function closePhotoUrlModal() {
  photoEditSlots.forEach(s => { if (s.previewUrl) URL.revokeObjectURL(s.previewUrl); });
  photoEditSlots = [];
  document.getElementById('photoUrlModal')?.classList.remove('open');
}
function renderPhotoModalSlots() {
  const el = document.getElementById('photoSlotsList');
  if (!el) return;
  el.innerHTML = photoEditSlots.map((slot, i) => {
    const preview = slot.previewUrl || slot.url;
    const previewHtml = preview
      ? `<div class="photo-slot-preview"><img src="${preview.replace(/"/g, '&quot;')}" alt=""></div>`
      : '';
    const nameHint = slot.pendingFile ? slot.pendingFile.name : (slot.url ? '\uD30C\uC77C \uC800\uC7A5\uB428' : '');
    return `<div class="photo-slot">
      <div class="photo-slot-head">
        <span class="photo-slot-label">\uC0AC\uC9C4 ${i + 1}</span>
        <button type="button" class="tr-btn-sm danger" onclick="removePhotoSlot(${i})" ${photoEditSlots.length <= 1 ? 'disabled' : ''}>\uD398\uC774\uC9C0 \uC0AD\uC81C</button>
      </div>
      ${previewHtml}
      <div class="photo-slot-file">
        <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" id="photoFile${i}" onchange="onPhotoFileSelected(${i}, this)">
        ${nameHint ? `<span class="photo-slot-fname">${nameHint.replace(/</g, '&lt;')}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}
function addPhotoSlot() {
  if (photoEditSlots.length >= PHOTO_MAX_SLOTS) {
    alert(`\uCD5C\uB300 ${PHOTO_MAX_SLOTS}\uC7A5\uAE4C\uC9C0 \uCD94\uAC00\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`);
    return;
  }
  photoEditSlots.push({ url: '', storagePath: null, pendingFile: null, previewUrl: null, transform: { x: 0, y: 0, scale: 1 } });
  renderPhotoModalSlots();
}
function removePhotoSlot(idx) {
  if (photoEditSlots.length <= 1) return;
  const slot = photoEditSlots[idx];
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
  photoEditSlots.splice(idx, 1);
  renderPhotoModalSlots();
}
function onPhotoFileSelected(idx, input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    alert('\uC774\uBBF8\uC9C0 \uD30C\uC77C\uB9CC \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
    input.value = '';
    return;
  }
  if (file.size > PHOTO_MAX_BYTES) {
    alert('\uD30C\uC77C \uD06C\uAE30\uB294 5MB \uC774\uD558\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.');
    input.value = '';
    return;
  }
  const slot = photoEditSlots[idx];
  if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
  slot.pendingFile = file;
  slot.previewUrl = URL.createObjectURL(file);
  renderPhotoModalSlots();
}
async function saveTeamPhotos() {
  const btn = document.getElementById('photoSaveBtn');
  if (btn) { btn.disabled = true; btn.textContent = '\uC800\uC7A5 \uC911\u2026'; }
  try {
    const intVal = Math.max(3, parseInt(document.getElementById('photoIntervalInput')?.value, 10) || 10);
    const pathsToDelete = new Set();
    const oldPaths = photoUrls.map(u => apiStoragePathFromPublicUrl(u)).filter(Boolean);

    for (let i = 0; i < photoEditSlots.length; i++) {
      const slot = photoEditSlots[i];
      if (slot.pendingFile) {
        const prevPath = slot.storagePath;
        const { url, storagePath } = await apiUploadTeamPhoto(slot.pendingFile);
        if (prevPath && prevPath !== storagePath) pathsToDelete.add(prevPath);
        slot.url = url;
        slot.storagePath = storagePath;
        slot.pendingFile = null;
        if (slot.previewUrl) { URL.revokeObjectURL(slot.previewUrl); slot.previewUrl = null; }
      }
    }

    const kept = photoEditSlots.filter(s => s.url || s.pendingFile);
    const newUrls = kept.map(s => s.url).filter(Boolean);
    const newPaths = new Set(newUrls.map(u => apiStoragePathFromPublicUrl(u)).filter(Boolean));
    oldPaths.forEach(p => { if (!newPaths.has(p)) pathsToDelete.add(p); });

    for (const p of pathsToDelete) {
      await apiDeleteTeamPhoto(p).catch(err => console.warn('[photo delete]', err));
    }

    photoUrls = newUrls;
    photoInterval = intVal;
    photoTransforms = kept.filter(s => s.url).map(s => s.transform || { x: 0, y: 0, scale: 1 });
    currentPhotoIdx = 0;
    photoTransform = photoTransforms[0] || { x: 0, y: 0, scale: 1 };

    await persistMeta();
    closePhotoUrlModal();
    renderHome();
  } catch (e) {
    handleSaveError(e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '\uC800\uC7A5'; }
  }
}
function saveTeamPhotoUrl() { saveTeamPhotos(); }
async function clearTeamPhoto() {
  const hasAny = photoEditSlots.some(s => s.url || s.pendingFile) || photoUrls.length;
  if (!hasAny) { closePhotoUrlModal(); return; }
  if (!confirm('\uBAA8\uB4E0 \uD300 \uC0AC\uC9C4\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?')) return;
  const paths = photoUrls.map(u => apiStoragePathFromPublicUrl(u)).filter(Boolean);
  photoUrls = [];
  photoTransforms = [];
  currentPhotoIdx = 0;
  photoTransform = { x: 0, y: 0, scale: 1 };
  try {
    for (const p of paths) await apiDeleteTeamPhoto(p).catch(err => console.warn('[photo delete]', err));
    await persistMeta();
    closePhotoUrlModal();
    renderHome();
  } catch (e) {
    handleSaveError(e);
  }
}
function editTeamName() {
  const name = prompt('팀 이름', myTeamName || '우리 FC');
  if (name === null) return;
  const newName = name.trim() || '우리 FC';
  if (newName === myTeamName) return;
  myTeamName = newName;
  const matchesChanged = syncAllMatchTeamNames(newName);
  const tasks = [persistMeta()];
  if (matchesChanged) tasks.push(persistMatches());
  Promise.all(tasks).then(() => {
    renderHome();
    renderRecords();
  }).catch(handleSaveError);
}

// ── 선수 데이터 ──
function savePlayers() { persistPlayers().catch(handleSaveError); }
function nextId() { return players.length ? Math.max(...players.map(p=>p.id))+1 : 1; }

function playerLayerRange(positions) {
  if (!positions.length) return {min:3,max:3};
  const layers = positions.map(p => POS_LAYER[p]??3);
  return {min:Math.min(...layers), max:Math.max(...layers)};
}
function overlapSortKey(p) {
  const {min,max} = playerLayerRange(p.positions);
  return min===max ? min*10 : min*10+5;
}
function sortByPosition() { players.sort((a,b)=>overlapSortKey(a)-overlapSortKey(b)); savePlayers(); renderRoster(); }

// ── 명단 렌더 ──
function renderRoster() {
  const el = document.getElementById('playerList');
  if (!players.length) { el.innerHTML='<div class="empty-state">선수가 없습니다</div>'; return; }
  el.innerHTML = players.map((p,i) => {
    const bestOvr = getBestOvr(p);
    const bonus = p.formBonus || 0;
    const effectiveOvr = bestOvr != null ? bestOvr + bonus : null;
    const bonusBadge = bonus !== 0 ? `<span class="form-bonus-badge ${bonus>0?'plus':'minus'}" style="font-size:11px;margin-left:3px">${bonus>0?'+':''}${bonus}</span>` : '';
    const ovrText = effectiveOvr!=null ? `<span class="ovr-badge">${effectiveOvr}</span>${bonusBadge}${ovrStars(effectiveOvr)}` : '';
    const posOvrTags = p.positions.map(pos => {
      const ov = p.ovr?p.ovr[pos]:null;
      return `<span class="ovr-pos-item">${pos}${ov!=null?' '+ov:''}</span>`;
    }).join('');
    const jersey = p.jersey != null ? p.jersey : '—';
    const wage = p.isMercenary ? 0 : computePlayerTotalWage(p.id);
    const valueStr = (!p.isMercenary && wage > 0) ? formatPlayerValue(wage) : null;
    const mercenaryBadge = p.isMercenary ? '<span class="mercenary-badge">용병</span>' : '';
    return `<div class="player-card">
      ${isAdmin ? `<div class="num-ctrl">
        <button class="btn-num" onclick="movePlayerNum(${p.id},-1)" ${i===0?'disabled':''}>▲</button>
        <button class="btn-num" onclick="movePlayerNum(${p.id},1)" ${i===players.length-1?'disabled':''}>▼</button>
      </div>` : ''}
      <div class="player-jersey" style="background:${primaryPosColor(p)}22;color:${primaryPosColor(p)};border:1px solid ${primaryPosColor(p)}44">${jersey}</div>
      <div class="player-info">
        <div class="player-name-row"><span class="player-name">${p.name}</span>${mercenaryBadge}${ovrText}</div>
        <div class="ovr-pos-list">${posOvrTags||'<span style="font-size:11px;color:var(--text3)">포지션 없음</span>'}</div>
        ${valueStr ? `<div class="player-value-badge">선수 가치 : ${valueStr}원</div>` : ''}
      </div>
      ${isAdmin ? `
      <button class="btn-icon" onclick="openEditModal(${p.id})"><i class="ti ti-edit"></i></button>
      <button class="btn-icon danger" onclick="deletePlayer(${p.id})"><i class="ti ti-trash"></i></button>` : ''}
    </div>`;
  }).join('');
}
function movePlayerNum(id,dir) {
  const idx=players.findIndex(p=>p.id===id), ni=idx+dir;
  if (ni<0||ni>=players.length) return;
  [players[idx],players[ni]]=[players[ni],players[idx]];
  savePlayers(); renderRoster();
}

// ── 선수 모달 ──
function buildPosCheckboxes() {
  document.getElementById('posCheckboxes').innerHTML = ALL_POS.map(p=>`
    <input type="checkbox" class="pos-cb" id="pcb_${p}" value="${p}" onchange="updateOvrInputs()">
    <label class="pos-cb-label" for="pcb_${p}">${p}</label>`).join('');
}
function ovrRowHtml(pos, v) {
  return `<div class="ovr-row">
    <span class="pos-label">${pos}</span>
    <input type="range" class="ovr-range" data-pos="${pos}" min="1" max="100" step="1" value="${v}"
      oninput="syncOvrFromRange(this)">
    <input type="number" class="ovr-number-input" data-pos="${pos}" min="0" max="100" step="1" value="${v}"
      oninput="syncOvrFromNumber(this)">
    <span class="ovr-star-preview">${ovrStars(parseInt(v))}</span>
  </div>`;
}
function syncOvrFromRange(el) {
  const row = el.closest('.ovr-row');
  row.querySelector('.ovr-number-input').value = el.value;
  row.querySelector('.ovr-star-preview').innerHTML = ovrStars(parseInt(el.value, 10));
}
function syncOvrFromNumber(el) {
  const row = el.closest('.ovr-row');
  const preview = row.querySelector('.ovr-star-preview');
  const range = row.querySelector('.ovr-range');
  const raw = el.value.trim();
  if (raw === '') {
    preview.innerHTML = '';
    return;
  }
  const v = parseInt(raw, 10);
  if (Number.isNaN(v)) return;
  if (v >= 1 && v <= 100) {
    range.value = v;
    preview.innerHTML = ovrStars(v);
  } else {
    preview.innerHTML = v === 0 ? '' : '';
  }
}
function validatePlayerOvrInputs() {
  const inputs = document.getElementById('ovrInputs').querySelectorAll('.ovr-number-input');
  for (const inp of inputs) {
    const pos = inp.dataset.pos;
    const raw = inp.value.trim();
    const v = parseInt(raw, 10);
    if (raw === '' || Number.isNaN(v) || v < 1 || v > 100) {
      alert(`${pos} OVR은 1~100 사이로 입력해주세요.`);
      inp.focus();
      inp.select();
      return false;
    }
  }
  return true;
}
function updateOvrInputs() {
  const selected = ALL_POS.filter(p=>document.getElementById('pcb_'+p)?.checked);
  const sec=document.getElementById('ovrSection'), inp=document.getElementById('ovrInputs');
  sec.style.display = selected.length?'block':'none';
  const curVals={};
  inp.querySelectorAll('.ovr-range').forEach(r=>{curVals[r.dataset.pos]=r.value;});
  inp.innerHTML = selected.map(pos => ovrRowHtml(pos, curVals[pos]??'50')).join('');
}
function updateFormBonusPreview() {
  const v = parseInt(document.getElementById('inputFormBonus').value) || 0;
  const el = document.getElementById('formBonusPreview');
  if (v === 0) { el.textContent = ''; return; }
  el.textContent = v > 0 ? `+${v} 폼 상승` : `${v} 폼 하락`;
  el.style.color = v > 0 ? '#4ade80' : '#f87171';
}
function openAddModal() {
  editingId=null;
  document.getElementById('modalTitle').textContent='선수 추가';
  document.getElementById('inputName').value='';
  document.getElementById('inputJersey').value='';
  document.getElementById('inputFormBonus').value='0';
  document.getElementById('formBonusPreview').textContent='';
  buildPosCheckboxes();
  document.getElementById('ovrSection').style.display='none';
  document.getElementById('ovrInputs').innerHTML='';
  document.getElementById('inputMercenary').checked=false;
  document.getElementById('playerModal').classList.add('open');
  setTimeout(()=>document.getElementById('inputName').focus(),100);
}
function openEditModal(id) {
  const p=players.find(x=>x.id===id); if(!p) return;
  editingId=id;
  document.getElementById('modalTitle').textContent='선수 편집';
  document.getElementById('inputName').value=p.name;
  document.getElementById('inputJersey').value=p.jersey||'';
  document.getElementById('inputFormBonus').value=p.formBonus||0;
  updateFormBonusPreview();
  buildPosCheckboxes();
  p.positions.forEach(pos=>{const cb=document.getElementById('pcb_'+pos); if(cb)cb.checked=true;});
  const inp=document.getElementById('ovrInputs');
  document.getElementById('ovrSection').style.display=p.positions.length?'block':'none';
  inp.innerHTML=p.positions.map(pos=>{
    const v=(p.ovr&&p.ovr[pos]!=null)?p.ovr[pos]:50;
    return ovrRowHtml(pos, v);
  }).join('');
  document.getElementById('inputMercenary').checked=!!(p.isMercenary);
  document.getElementById('playerModal').classList.add('open');
}
function closeModal() { document.getElementById('playerModal').classList.remove('open'); }
function savePlayer() {
  const name=document.getElementById('inputName').value.trim();
  if(!name){alert('이름을 입력해주세요');return;}
  const jersey=parseInt(document.getElementById('inputJersey').value)||null;
  const positions=ALL_POS.filter(p=>document.getElementById('pcb_'+p)?.checked);
  if (positions.length && !validatePlayerOvrInputs()) return;
  const ovr={};
  document.getElementById('ovrInputs').querySelectorAll('.ovr-number-input').forEach(r=>{
    ovr[r.dataset.pos] = parseInt(r.value.trim(), 10);
  });
  const formBonus=parseInt(document.getElementById('inputFormBonus').value)||0;
  const isMercenary=!!(document.getElementById('inputMercenary')?.checked);
  if(editingId){
    const idx=players.findIndex(x=>x.id===editingId);
    if(idx>=0) players[idx]=normalizePlayerOvr({...players[idx],name,jersey,positions,ovr,formBonus,isMercenary});
  } else {
    players.push(normalizePlayerOvr({id:nextId(),name,jersey,positions,ovr,formBonus,isMercenary}));
  }
  savePlayers(); closeModal(); renderRoster(); renderField(); refreshHomeIfVisible();
}
function deletePlayer(id) {
  if(!confirm('삭제하시겠습니까?')) return;
  players=players.filter(p=>p.id!==id);
  fieldTokens=fieldTokens.filter(t=>t.pid!==id);
  saveFieldState(); savePlayers(); renderRoster(); renderField(); refreshHomeIfVisible();
}
document.getElementById('playerModal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ── 통합 팝업 (포지션 변경 + 선수 변경) ──
function renderPosPopupGrid(pid) {
  const p = players.find(x => x.id === pid);
  const ft = fieldTokens.find(t => t.pid === pid);
  if (!p) return '';
  const curPos = ft?.pos || p.positions[0] || '';
  if (!isFormationSelected()) {
    return '<div class="pos-popup-hint">포메이션을 먼저 선택해주세요.</div>';
  }
  return ALL_POS.map(pos =>
    `<button class="pos-popup-btn ${pos === curPos ? 'active' : ''}" onclick="selectPosFromPopup('${pos}')">${pos}</button>`
  ).join('');
}
function hidePosPopupExtras() {
  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = 'none';
}
function findBestEmptySlotForPlayer(p) {
  const labels = getLabels();
  let bestIdx = -1;
  let bestScore = -1;
  for (let i = 0; i < labels.length; i++) {
    if (tokenAtSlot(i, null)) continue;
    const label = labels[i];
    const matching = p.positions?.length
      ? p.positions.filter(pos => slotAcceptsPos(label, pos))
      : [];
    let score;
    if (matching.length) {
      score = Math.max(...matching.map(pos => getOvr(p, pos) ?? 0));
    } else if (!p.positions?.length) {
      score = 0;
    } else {
      continue;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
function autoPlaceFromBench(pid) {
  if (!isFormationSelected()) return false;
  if (fieldTokens.length >= MAX_FIELD) return false; // 알림은 handlePlayerTap에서 처리
  if (fieldTokens.find(t => t.pid === pid)) return false;
  const p = players.find(x => x.id === pid);
  if (!p) return false;
  const slots = getSlots();
  const labels = getLabels();
  const slotIdx = findBestEmptySlotForPlayer(p);
  if (slotIdx < 0) return false;
  const pos = labels[slotIdx];
  // findBestEmptySlotForPlayer가 이미 빈 슬롯만 반환하므로 추가 용량 체크 불필요
  fieldTokens.push({
    pid,
    slotIdx,
    freeX: slots[slotIdx][0],
    freeY: slots[slotIdx][1],
    pos,
  });
  saveFieldState();
  renderField();
  return true;
}
function openBenchPosMenu(pid, anchorEl) {
  popupMode = 'bench-pos';
  popupTargetPid = pid;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  document.getElementById('posPopupTitle').textContent =
    `${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name} · 포지션 선택`;
  const grid = document.getElementById('posPopupGrid');
  grid.className = 'pos-popup-grid';
  grid.innerHTML = renderPosPopupGrid(pid);
  hidePosPopupExtras();
  _showPopupAt(anchorEl);
}
function openFieldActionMenu(pid, anchorEl) {
  popupMode = 'swap';
  popupTargetPid = pid;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  anchorEl = anchorEl || document.querySelector(`.player-token[data-pid="${pid}"]`);
  document.getElementById('posPopup').classList.remove('wide');
  document.getElementById('posPopupTitle').textContent =
    `${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name} — 교체`;

  const onFieldIds = new Set(fieldTokens.map(t => t.pid));
  const benchPlayers = players.filter(x => x.id !== pid && !onFieldIds.has(x.id));

  // 벤치 선수 목록만 (자리 교체 섹션 제거)
  const benchRows = benchPlayers.map(x => {
    const ovr = getBestOvr(x);
    const eff = ovr != null ? ovr + (x.formBonus || 0) : null;
    return `<button class="pos-popup-btn" onclick="benchReplaceWith(${x.id},${pid})"
      style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px;width:100%;text-align:left;background:rgba(34,197,94,0.08)">
      <span style="font-weight:600;flex:1">${x.jersey != null ? '#' + x.jersey + ' ' : ''}${x.name}</span>
      <span style="font-size:10px;color:#4ade80">&#x2191;&#xC785;</span>
      ${eff != null ? `<span style="font-size:10px;color:var(--text3)">${eff}</span>` : ''}
    </button>`;
  }).join('');

  const grid = document.getElementById('posPopupGrid');
  grid.className = 'pos-popup-grid';
  let html = '<div style="width:100%;max-height:200px;overflow-y:auto">';
  if (benchRows) {
    html += `<div style="font-size:10px;color:var(--text3);padding:2px 0 4px;font-weight:600">&#x2191; &#xBC24;&#xCE58; &#x2192; &#xAD50;&#xCCB4; &#xD22C;&#xC785;</div>${benchRows}`;
  } else {
    html += '<div style="font-size:11px;color:var(--text3);padding:4px 0">&#xAD50;&#xCCB4; &#xAC00;&#xB2A5;&#xD55C; &#xBC88;&#xCE58; &#xC120;&#xC218;&#xAC00; &#xC5C6;&#xC2B5;&#xB2C8;&#xB2E4;</div>';
  }
  html += '</div>';
  grid.innerHTML = html;

  document.getElementById('posPopupSwapBtn').style.display = 'none';

  // 교체 예정 버튼: 이미 등록된 경우 해제 텍스트로
  const ft2 = fieldTokens.find(t => t.pid === pid);
  const subBtn = document.getElementById('posPopupSubBtn');
  subBtn.style.display = 'block';
  if (ft2?.subPid) {
    subBtn.textContent = '교체 예정 해제';
    subBtn.onclick = clearSubPlayer;
  } else {
    subBtn.textContent = '🔄 교체 예정 등록';
    subBtn.onclick = () => openSubPopup(pid);
  }

  const benchBtn = document.getElementById('posPopupBenchBtn');
  benchBtn.textContent = '벤치로 보내기';
  benchBtn.onclick = sendToBenchFromPopup;
  benchBtn.style.display = 'block';

  _showPopupAt(anchorEl);
}
function openFieldPosGrid(pid) {
  popupMode = 'pos';
  popupTargetPid = pid;
  const p = players.find(x => x.id === pid);
  if (!p) return;
  document.getElementById('posPopupTitle').textContent = `포지션 변경 · ${p.name}`;
  const grid = document.getElementById('posPopupGrid');
  grid.className = 'pos-popup-grid pos-popup-grid-wide';
  grid.innerHTML =
    `<button type="button" class="pos-popup-back" onclick="event.stopPropagation();openFieldActionMenu(${pid}, null)">← 메뉴로</button>
     <div class="pos-popup-grid-inner">${renderPosPopupGrid(pid)}</div>`;
  hidePosPopupExtras();
  document.getElementById('posPopupSubBtn').style.display = 'block';
  document.getElementById('posPopup').classList.add('wide');
  const anchorEl = document.querySelector(`.player-token[data-pid="${pid}"]`);
  _showPopupAt(anchorEl);
}
function handlePlayerTap(pid, anchorEl, fromBench) {
  if (!isAdmin) return;
  if (fromBench) {
    if (!isFormationSelected()) { alertFormationRequired(); return; }
    // 필드 꽉 찼으면 → 교체 팝업 (포지션 팝업 X)
    if (fieldTokens.length >= MAX_FIELD) {
      openBenchReplace(pid);
      return;
    }
    if (autoPlaceFromBench(pid)) return;
    const p = players.find(x => x.id === pid);
    if (p && findBestEmptySlotForPlayer(p) < 0) {
      alert('맞는 빈 자리가 없습니다. 포지션을 직접 선택해주세요.');
    }
    openBenchPosMenu(pid, anchorEl);
    return;
  }
  if (fieldTokens.find(t => t.pid === pid)) {
    openFieldActionMenu(pid, anchorEl);
  } else {
    openBenchPosMenu(pid, anchorEl);
  }
}

function openSubPopup(pid) {
  popupMode = 'sub';
  popupTargetPid = pid;
  const p = players.find(x=>x.id===pid); if(!p) return;
  const ft = fieldTokens.find(t=>t.pid===pid);
  const anchorEl = document.querySelector(`.player-token[data-pid="${pid}"]`);

  document.getElementById('posPopupTitle').textContent = `🔄 ${p.name} — 후반 교체 예정`;

  const onField = new Set(fieldTokens.map(t=>t.pid));
  const bench = players.filter(x=>x.id!==pid&&!onField.has(x.id));
  const rows = bench.map(x => {
    const isSub = ft?.subPid === x.id;
    const ovr = getBestOvr(x);
    const eff = ovr != null ? ovr + (x.formBonus || 0) : null;
    return `<button class="pos-popup-btn sub-player-btn ${isSub?'active':''}" onclick="selectSubPlayer(${x.id})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey!=null?'#'+x.jersey+' ':''}${x.name}</span>
      ${eff!=null?`<span style="font-size:10px;color:var(--text3)">${eff}</span>`:''}
      <span style="font-size:9px;background:var(--bg2);color:var(--text3);padding:1px 5px;border-radius:6px">벤치</span>
    </button>`;
  }).join('');

  const subGrid = document.getElementById('posPopupGrid');
  subGrid.className = 'pos-popup-grid';
  subGrid.innerHTML = bench.length
    ? `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`
    : '<div style="font-size:11px;color:var(--text3)">벤치에 교체 가능한 선수가 없습니다</div>';

  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  const bb = document.getElementById('posPopupBenchBtn');
  bb.style.display = ft?.subPid ? 'block' : 'none';
  bb.textContent = '교체 예정 해제';
  bb.onclick = clearSubPlayer;

  _showPopupAt(anchorEl);
}

function openSwapPopup(pid) {
  popupMode = 'swap';
  popupTargetPid = pid;
  const p = players.find(x=>x.id===pid); if(!p) return;
  const anchorEl = document.querySelector(`.player-token[data-pid="${pid}"]`);

  document.getElementById('posPopupTitle').textContent = `↔️ ${p.name} — 즉시 교체`;

  const others = fieldTokens.filter(t=>t.pid!==pid);
  const rows = others.map(t => {
    const x = players.find(pl=>pl.id===t.pid); if(!x) return '';
    const ovr = getOvr(x, t.pos);
    const eff = ovr != null ? ovr + (x.formBonus || 0) : null;
    return `<button class="pos-popup-btn" onclick="selectSwapPlayer(${t.pid})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey!=null?'#'+x.jersey+' ':''}${x.name}</span>
      <span style="font-size:10px;color:var(--text3)">${t.pos||''}</span>
      ${eff!=null?`<span style="font-size:10px;color:var(--text3)">${eff}</span>`:''}
    </button>`;
  }).join('');

  const swapGrid = document.getElementById('posPopupGrid');
  swapGrid.className = 'pos-popup-grid';
  swapGrid.innerHTML = others.length
    ? `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`
    : '<div style="font-size:11px;color:var(--text3)">교체할 필드 선수가 없습니다</div>';

  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = 'none';

  _showPopupAt(anchorEl);
}

function openBenchReplace(benchPid) {
  popupMode = 'bench-replace';
  popupTargetPid = benchPid;
  const p = players.find(x=>x.id===benchPid); if(!p) return;

  document.getElementById('posPopupTitle').textContent = `🔄 ${p.name} — 누구와 교체?`;

  const rows = fieldTokens.map(t => {
    const x = players.find(pl=>pl.id===t.pid); if(!x) return '';
    return `<button class="pos-popup-btn" onclick="benchReplaceWith(${benchPid},${t.pid})" style="width:100%;text-align:left;display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:var(--radius);margin-bottom:3px">
      <span style="font-weight:600;flex:1">${x.jersey!=null?'#'+x.jersey+' ':''}${x.name}</span>
      <span style="font-size:10px;color:var(--text3)">${t.pos||''}</span>
    </button>`;
  }).join('');

  const brGrid = document.getElementById('posPopupGrid');
  brGrid.className = 'pos-popup-grid';
  brGrid.innerHTML = fieldTokens.length
    ? `<div style="width:100%;max-height:200px;overflow-y:auto">${rows}</div>`
    : '<div style="font-size:11px;color:var(--text3)">필드에 교체할 선수가 없습니다</div>';

  document.getElementById('posPopupSwapBtn').style.display = 'none';
  document.getElementById('posPopupSubBtn').style.display = 'none';
  document.getElementById('posPopupBenchBtn').style.display = 'none';

  const anchorEl = document.querySelector(`.btn-bench-swap[data-pid="${benchPid}"]`);
  _showPopupAt(anchorEl);
}

function _showPopupAt(anchorEl) {
  const rect = anchorEl ? anchorEl.getBoundingClientRect() : {left:window.innerWidth/2-115, bottom:window.innerHeight/2, top:window.innerHeight/2-200, right:0};
  const pw=240, ph=300;
  let left=rect.left, top=rect.bottom+6;
  if(left+pw>window.innerWidth) left=window.innerWidth-pw-8;
  if(top+ph>window.innerHeight) top=rect.top-ph-6;
  if(top<0) top=8;
  const popup=document.getElementById('posPopup');
  popup.style.left=left+'px'; popup.style.top=top+'px';
  popup.classList.add('open');
  document.getElementById('popupOverlay').style.display='block';
}

function closePosPopup() {
  document.getElementById('posPopup').classList.remove('open', 'wide');
  document.getElementById('popupOverlay').style.display='none';
  popupTargetPid = null;
  popupMode = 'pos';
  const grid = document.getElementById('posPopupGrid');
  if (grid) grid.className = 'pos-popup-grid';
  const bb = document.getElementById('posPopupBenchBtn');
  bb.textContent = '벤치로 보내기';
  bb.onclick = sendToBenchFromPopup;
  hidePosPopupExtras();
}

function sendToBenchFromPopup() {
  if(!popupTargetPid) return;
  fieldTokens=fieldTokens.filter(t=>t.pid!==popupTargetPid);
  saveFieldState(); closePosPopup(); renderField();
}

function selectPosFromPopup(pos) {
  if(!popupTargetPid) return;
  if (!isFormationSelected()) { alertFormationRequired(); closePosPopup(); return; }
  const pid=popupTargetPid;
  const p=players.find(x=>x.id===pid); if(!p) return;

  const slots=getSlots(), labels=getLabels();
  const ft=fieldTokens.find(t=>t.pid===pid);

  if(!ft) {
    // 벤치 → 필드: 인원·용량 체크 필요
    if(fieldTokens.length>=MAX_FIELD){alert(`최대 ${MAX_FIELD}명까지만 출전 가능합니다.`);closePosPopup();return;}
    const err = checkSlotCapacity(pos, null);
    if(err) { alert(err); return; }
  }
  // 필드 선수 포지션 변경: 체크 없음 (자리만 바뀌므로 총 인원 변동 없음)

  // 포지션 목록 맨 앞으로
  if(!p.positions.includes(pos)) p.positions.unshift(pos);
  else { p.positions=p.positions.filter(x=>x!==pos); p.positions.unshift(pos); }
  savePlayers(); renderRoster();

  if(ft) {
    // 1차: 빈 슬롯 탐색
    let slotIdx=findBestSlot(pos, slots, labels, pid);
    // 2차: 빈 슬롯 없으면 이미 차 있는 슬롯도 허용 (swap)
    if(slotIdx<0) {
      for(let i=0;i<labels.length;i++){
        if(i!==ft.slotIdx && slotAcceptsPos(labels[i],pos)){slotIdx=i;break;}
      }
    }
    if(slotIdx>=0) {
      const other=tokenAtSlot(slotIdx,pid);
      // 현재 위치 먼저 저장 (덮어쓰기 전에)
      const prevSlot=ft.slotIdx, prevX=ft.freeX, prevY=ft.freeY, prevPos=ft.pos;
      // ft를 새 슬롯으로 이동
      ft.slotIdx=slotIdx; ft.freeX=slots[slotIdx][0]; ft.freeY=slots[slotIdx][1]; ft.pos=pos;
      if(other) {
        // other를 ft가 있던 자리로 swap
        other.slotIdx=prevSlot;
        other.freeX=prevSlot>=0?(slots[prevSlot]?.[0]??prevX):prevX;
        other.freeY=prevSlot>=0?(slots[prevSlot]?.[1]??prevY):prevY;
        other.pos=prevSlot>=0&&labels[prevSlot]?labels[prevSlot]:prevPos;
      }
    } else {
      ft.pos=pos; // 맞는 슬롯 자체가 없는 포메이션일 때 pos만 변경
    }
  } else {
    const slotIdx=findBestSlot(pos, slots, labels, null);
    if(slotIdx<0){alert(`${pos} 에 배치할 수 있는 빈 자리가 없습니다.`);closePosPopup();return;}
    fieldTokens.push({pid, slotIdx, freeX:slots[slotIdx][0], freeY:slots[slotIdx][1], pos});
  }
  saveFieldState(); closePosPopup(); renderField();
}

// ── 교체 예정 (벤치만) ──
function selectSubPlayer(targetPid) {
  if(!popupTargetPid) return;
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid); if(!ft) return;
  ft.subPid=targetPid;
  saveFieldState(); closePosPopup(); renderField();
}
// ── 즉시 교체 (필드↔필드) ──
function selectSwapPlayer(targetPid) {
  if(!popupTargetPid) return;
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid);
  const targetFt=fieldTokens.find(t=>t.pid===targetPid);
  if(!ft||!targetFt) return;
  const tmp={slotIdx:ft.slotIdx,freeX:ft.freeX,freeY:ft.freeY,pos:ft.pos};
  ft.slotIdx=targetFt.slotIdx; ft.freeX=targetFt.freeX; ft.freeY=targetFt.freeY; ft.pos=targetFt.pos;
  targetFt.slotIdx=tmp.slotIdx; targetFt.freeX=tmp.freeX; targetFt.freeY=tmp.freeY; targetFt.pos=tmp.pos;
  ft.subPid=null; targetFt.subPid=null;
  saveFieldState(); closePosPopup(); renderField();
}
// ── 벤치 → 필드 즉시 교체 ──
function benchReplaceWith(benchPid, fieldPid) {
  const ft=fieldTokens.find(t=>t.pid===fieldPid);
  const benchP=players.find(p=>p.id===benchPid);
  if(!ft||!benchP) return;
  const newToken={pid:benchPid,slotIdx:ft.slotIdx,freeX:ft.freeX,freeY:ft.freeY,pos:ft.pos||benchP.positions[0]||'',subPid:null};
  fieldTokens=fieldTokens.map(t=>t.pid===fieldPid?newToken:t);
  saveFieldState(); closePosPopup(); renderField();
}
function clearSubPlayer() {
  const ft=fieldTokens.find(t=>t.pid===popupTargetPid); if(!ft) return;
  ft.subPid=null;
  saveFieldState(); closePosPopup(); renderField();
}

// 팝업 닫기는 오버레이(#popupOverlay) onclick으로 처리

// ── 슬롯 탐색 ──
function slotAcceptsPos(slotLabel, pos) { return (SLOT_LABEL_MATCH[slotLabel]||[slotLabel]).includes(pos); }
function findBestSlot(pos, slots, labels, excludePid) {
  for(let i=0;i<labels.length;i++){
    if(!tokenAtSlot(i,excludePid)&&slotAcceptsPos(labels[i],pos)) return i;
  }
  // fallback 제거: 포지션 맞는 슬롯 없으면 -1 반환 (빈 슬롯으로 밀어넣기 금지)
  return -1;
}

// ── 필드 캔버스 ──
function fieldPad(W) { return Math.max(8, Math.round(W * 16 / 400)); }
function getCanvasRect() { return document.getElementById('fieldCanvas').getBoundingClientRect(); }
function pointerToNorm(clientX, clientY) {
  const cr = getCanvasRect();
  const pad = fieldPad(cr.width);
  const nx = (clientX - cr.left - pad) / (cr.width - 2 * pad);
  const ny = (clientY - cr.top - pad) / (cr.height - 2 * pad);
  return {
    x: Math.max(0.02, Math.min(0.98, nx)),
    y: Math.max(0.02, Math.min(0.98, ny)),
  };
}
/** 포메이션 기본 좌표(0~1, 플레이 영역) → 캔버스 픽셀 — 슬롯 마커·선수 공통 */
function normToCanvasPx(nx, ny, W, H) {
  const pad = fieldPad(W);
  return { x: pad + nx * (W - 2 * pad), y: pad + ny * (H - 2 * pad) };
}
/** 포메이션 슬롯을 필드 캔버스에 직접 그림 — 선수와 무관한 고정 자리 */
function drawFormationSlots(ctx, W, H, nearSlot) {
  if (!document.getElementById('tab-formation')?.classList.contains('active')) return;
  const slots = getSlots(), labels = getLabels();
  const occupied = new Set(fieldTokens.map(t => t.slotIdx).filter(i => i >= 0));
  const sc = W / 420;
  const rBase = Math.max(10, 14 * sc);
  const rNear = Math.max(14, 20 * sc);
  slots.forEach((sl, i) => {
    const { x, y } = normToCanvasPx(sl[0], sl[1], W, H);
    const isNear = i === nearSlot;
    const isOccupied = occupied.has(i);
    const r = isNear ? rNear : rBase;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = isNear ? 'rgba(255,255,255,0.38)' : isOccupied ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.24)';
    ctx.fill();
    ctx.strokeStyle = isNear ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.32)';
    ctx.lineWidth = isNear ? 2 : 1;
    ctx.stroke();
    if (labels[i]) {
      ctx.fillStyle = isNear ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.52)';
      ctx.font = `bold ${isNear ? Math.max(9, Math.round(11 * sc)) : Math.max(8, Math.round(9 * sc))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, y);
    }
  });
}
function drawFieldCanvas(highlightSlot) {
  if (highlightSlot !== undefined) slotHighlight = highlightSlot;
  const canvas=document.getElementById('fieldCanvas');
  const wrap=document.getElementById('fieldWrap');
  const RATIO=1.45;
  const vpH = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const vpW = window.visualViewport ? window.visualViewport.width : window.innerWidth;

  let W, H;
  if (presentMode) {
    // 발표 모드: 좌/우 패널(PC 각 210px) 고려해서 필드 너비 계산
    const panelW = vpW >= 600 ? 210 : 0;
    const presentBarH = 36;
    const benchH = 64;
    const availH = vpH - presentBarH - benchH - 12;
    const availW = vpW - 24 - panelW * 2;
    H = Math.min(availH, Math.round(availW * RATIO));
    W = Math.round(H / RATIO);
    if (W > availW) { W = availW; H = Math.round(W * RATIO); }
    W = Math.max(240, W);
    H = Math.round(W * RATIO);
  } else {
    // 일반 모드
    const appW = document.getElementById('app')?.clientWidth || vpW;
    const rawW = wrap.clientWidth || appW;
    const maxW = rawW - 24;
    const wrapH = wrap.clientHeight > 60 ? wrap.clientHeight : vpH * 0.65;
    const maxH = Math.min(wrapH - 8, vpH * 0.58);
    W = maxW;
    H = Math.round(W * RATIO);
    if (maxH > 120 && H > maxH) { H = maxH; W = Math.round(H / RATIO); }
    W = Math.max(200, W);
    H = Math.round(W * RATIO);
  }

  canvas.width=W; canvas.height=H;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  fieldSize={w:W,h:H};

  // 토큰 UI 스케일: 340px 기준, 발표 모드에서는 상한 없이 확대 허용 + 스케일 조절 반영
  const baseScale = presentMode ? Math.max(0.6, W / 340) : Math.min(1, Math.max(0.6, W / 340));
  const tkScale = presentMode ? baseScale * (presentScales.token || 1) : baseScale;
  document.documentElement.style.setProperty('--tk', tkScale.toFixed(3));
  drawGrass(canvas);
  drawFormationSlots(canvas.getContext('2d'), W, H, slotHighlight);
}
function refreshFieldSlots(highlightSlot) {
  drawFieldCanvas(highlightSlot);
  repositionFieldTokens();
}
function repositionFieldTokens() {
  fieldTokens.forEach(t => {
    const el = document.querySelector(`.player-token[data-pid="${t.pid}"]`);
    if (!el) return;
    const { x, y } = tokenXY(t);
    const { left, top } = tokenPos(x, y);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  });
}
function drawGrass(canvas) {
  const W=canvas.width, H=canvas.height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1e7a43'; ctx.fillRect(0,0,W,H);
  for(let i=0;i<8;i++){if(i%2===0){ctx.fillStyle='rgba(0,0,0,0.06)';ctx.fillRect(0,i*H/8,W,H/8);}}
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=1.5;
  const pad=fieldPad(W);
  ctx.strokeRect(pad,pad,W-pad*2,H-pad*2);
  const mx=W/2, my=H/2;
  ctx.beginPath();ctx.moveTo(pad,my);ctx.lineTo(W-pad,my);ctx.stroke();
  ctx.beginPath();ctx.arc(mx,my,W*0.12,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(mx,my,3,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.85)';ctx.fill();
  const bw=W*0.5, bh=H*0.12;
  ctx.strokeRect((W-bw)/2,pad,bw,bh); ctx.strokeRect((W-bw)/2,H-pad-bh,bw,bh);
  const pw=W*0.28, ph=H*0.055;
  ctx.strokeRect((W-pw)/2,pad,pw,ph); ctx.strokeRect((W-pw)/2,H-pad-ph,pw,ph);
  const cr=H*0.038;
  [[pad,pad],[W-pad,pad],[pad,H-pad],[W-pad,H-pad]].forEach(([cx,cy])=>{
    const a=(cx===pad?(cy===pad?0:270):(cy===pad?90:180))*Math.PI/180;
    ctx.beginPath();ctx.arc(cx,cy,cr,a,a+Math.PI/2);ctx.stroke();
  });
}
function canvasRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
function exportStarFill(tier) {
  if (tier === 'tier-5' || tier === 'tier-4') return '#ffd700';
  if (tier === 'tier-3') return '#c9a227';
  if (tier === 'tier-2') return '#d8dce6';
  return '#b8bcc4';
}
function exportOvrValColor(tier) {
  if (tier === 'tier-5') return '#ffd700';
  if (tier === 'tier-4') return '#ffd700';
  if (tier === 'tier-3') return '#f5e6a8';
  return '#fff';
}
function exportOvrPillBorder(tier) {
  if (tier === 'tier-5') return 'rgba(255,215,0,0.65)';
  if (tier === 'tier-4') return 'rgba(255,215,0,0.5)';
  if (tier === 'tier-3') return 'rgba(201,162,39,0.45)';
  return 'rgba(255,255,255,0.18)';
}
/** PNG용 토큰 — 화면 `buildTokenInnerHtml` 레이아웃·스타일과 동일 (cx,cy = 토큰 중심) */
function drawExportToken(ctx, p, t, cx, cy, tk) {
  const pos = resolveTokenPos(t, p);
  const ovr = getOvr(p, pos);
  const bonus = p.formBonus || 0;
  const effectiveOvr = ovr != null ? ovr + bonus : null;
  const starTier = effectiveOvr != null ? ovrStarTier(effectiveOvr) : '';
  const pillTier = effectiveOvr != null ? ovrStarTier(effectiveOvr) : 'tier-1';
  const color = posColor(pos ? [pos] : p.positions);
  const circleR = 18 * tk;
  const wrapH = 36 * tk;
  const wrapMt = 10 * tk;
  const pillMt = 2 * tk;
  const pillPadY = 2 * tk;
  const pillPadX = 7 * tk;
  const labelFs = 7 * tk;
  const valFs = 10 * tk;
  const bonusFs = 8 * tk;
  const subFs = 9 * tk;
  const subMt = 3 * tk;
  const subPadX = 5 * tk;
  const subPadY = 1 * tk;
  const subP = t.subPid ? players.find(x => x.id === t.subPid) : null;
  const subText = subP ? `\uD83D\uDD04 ${subP.jersey != null ? subP.jersey + ' ' : ''}${subP.name}` : '';
  let pillW = 0;
  let pillH = 0;
  if (ovr != null) {
    ctx.font = `700 ${labelFs}px sans-serif`;
    const lw = ctx.measureText('OVR+').width;
    ctx.font = `800 ${valFs}px sans-serif`;
    const vw = ctx.measureText(String(Math.round(ovr))).width;
    let bw = 0;
    if (bonus !== 0) {
      ctx.font = `800 ${bonusFs}px sans-serif`;
      bw = ctx.measureText(`${bonus > 0 ? '+' : ''}${bonus}`).width + 8 * tk;
    }
    pillW = pillPadX * 2 + lw + 3 * tk + vw + (bw ? 3 * tk + bw : 0);
    pillH = pillPadY * 2 + valFs;
  }
  let subW = 0;
  let subH = 0;
  if (subText) {
    ctx.font = `600 ${subFs}px sans-serif`;
    subW = Math.min(ctx.measureText(subText).width + subPadX * 2, 64 * tk);
    subH = subFs + subPadY * 2;
  }
  const totalH = wrapMt + wrapH + (ovr != null ? pillMt + pillH : 0) + (subText ? subMt + subH : 0);
  const wrapTop = cy - totalH / 2 + wrapMt;
  const circleCy = wrapTop + wrapH / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const STAR_ARC_TOP = 17; // style.css .token-star-arc top과 동일 (12+5)

  // 1) 원 — 화면과 같이 뱃지·별보다 아래 레이어
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6 * tk;
  ctx.shadowOffsetY = 2 * tk;
  ctx.beginPath();
  ctx.arc(cx, circleCy, circleR, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, circleCy, circleR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2 * tk;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${12 * tk}px sans-serif`;
  ctx.fillText(p.name.slice(0, 2), cx, circleCy);

  // 2) 포지션 뱃지 — 원 위에 겹침 (z-index 2와 동일)
  if (pos) {
    ctx.font = `700 ${8 * tk}px sans-serif`;
    const bw = Math.max(ctx.measureText(pos).width + 10 * tk, 22 * tk);
    const bh = 12 * tk;
    const bx = cx - bw / 2;
    const badgeTop = circleCy - circleR - 9 * tk;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    canvasRoundRect(ctx, bx, badgeTop, bw, bh, 4 * tk);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(pos, cx, badgeTop + bh / 2);
  }

  // 3) 별 아치 — 최상단
  if (effectiveOvr != null) {
    const n = ovrStarCount(effectiveOvr);
    const pts = STAR_ARC_LAYOUT[n] || STAR_ARC_LAYOUT[1];
    const arcW = 54 * tk;
    const arcTop = wrapTop - STAR_ARC_TOP * tk;
    const arcH = 20 * tk;
    ctx.font = `${9 * tk}px sans-serif`;
    ctx.fillStyle = exportStarFill(starTier);
    if (starTier === 'tier-4' || starTier === 'tier-5') {
      ctx.shadowColor = 'rgba(255,215,0,0.75)';
      ctx.shadowBlur = 4 * tk;
    }
    pts.forEach(([l, tv]) => {
      const ax = cx - arcW / 2 + (l / 100) * arcW;
      const ay = arcTop + (tv / 100) * arcH;
      ctx.fillText('\u2605', ax, ay);
    });
    ctx.shadowBlur = 0;
  }

  if (ovr != null) {
    const pillTop = wrapTop + wrapH + pillMt;
    const pillLeft = cx - pillW / 2;
    ctx.fillStyle = pillTier === 'tier-5' ? 'rgba(10,10,10,0.72)' : 'rgba(0,0,0,0.58)';
    canvasRoundRect(ctx, pillLeft, pillTop, pillW, pillH, 6 * tk);
    ctx.fill();
    ctx.strokeStyle = exportOvrPillBorder(pillTier);
    ctx.lineWidth = 1 * tk;
    canvasRoundRect(ctx, pillLeft, pillTop, pillW, pillH, 6 * tk);
    ctx.stroke();
    const pillCy = pillTop + pillH / 2;
    let px = pillLeft + pillPadX;
    ctx.textAlign = 'left';
    ctx.font = `700 ${labelFs}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('OVR+', px, pillCy);
    px += ctx.measureText('OVR+').width + 3 * tk;
    ctx.font = `800 ${valFs}px sans-serif`;
    ctx.fillStyle = exportOvrValColor(pillTier);
    ctx.fillText(String(Math.round(ovr)), px, pillCy);
    px += ctx.measureText(String(Math.round(ovr))).width;
    if (bonus !== 0) {
      px += 3 * tk;
      const bonusText = `${bonus > 0 ? '+' : ''}${bonus}`;
      ctx.font = `800 ${bonusFs}px sans-serif`;
      const bw = ctx.measureText(bonusText).width + 8 * tk;
      const bh = bonusFs + 2 * tk;
      const by = pillCy - bh / 2;
      ctx.fillStyle = bonus > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)';
      canvasRoundRect(ctx, px, by, bw, bh, 4 * tk);
      ctx.fill();
      ctx.fillStyle = bonus > 0 ? '#4ade80' : '#f87171';
      ctx.fillText(bonusText, px + 4 * tk, pillCy);
    }
  }

  if (subText) {
    const subTop = wrapTop + wrapH + (ovr != null ? pillMt + pillH : 0) + subMt;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    canvasRoundRect(ctx, cx - subW / 2, subTop, subW, subH, 5 * tk);
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = `600 ${subFs}px sans-serif`;
    ctx.fillText(subText, cx, subTop + subH / 2, subW - subPadX * 2);
  }

  ctx.restore();
}
function getBenchPlayers() {
  const onField = new Set(fieldTokens.map(t => t.pid));
  fieldTokens.forEach(t => { if (t.subPid) onField.add(t.subPid); });
  return players.filter(p => !onField.has(p.id));
}
function downloadPngBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
function getQuarterExportSnapshot(q) {
  const qd = q === activeQuarter
    ? { formation: getFormation(), tokens: fieldTokens }
    : (quarterData[q] || { formation: '', tokens: [] });
  return {
    formation: qd.formation || '',
    tokens: qd.tokens || [],
    labels: FORMATION_POS_LABELS[qd.formation] || [],
    slots: FORMATIONS[qd.formation] || [],
  };
}
function tokenXYForExport(t, slots) {
  if (t.freeX != null && t.freeY != null) return { x: t.freeX, y: t.freeY };
  if (t.slotIdx >= 0 && slots[t.slotIdx]) return { x: slots[t.slotIdx][0], y: slots[t.slotIdx][1] };
  return { x: 0.5, y: 0.5 };
}
function formationExportFilename(q, formation) {
  const now = new Date();
  const dateSlug = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
  return `[${q}Q]${dateSlug}(${formation}).png`;
}
function renderFormationExportCanvas(q) {
  const { formation, tokens, labels, slots } = getQuarterExportSnapshot(q);
  if (!formation || !FORMATIONS[formation] || !tokens.length) return null;
  const sc = 2;
  const exportTk = sc * Math.min(1, Math.max(0.6, 420 / 340));
  const fieldW = 420 * sc;
  const fieldH = Math.round(fieldW * 1.45);
  const pad = 14 * sc;
  const headerH = 48 * sc;
  const canvas = document.createElement('canvas');
  canvas.width = fieldW + pad * 2;
  canvas.height = headerH + fieldH + pad * 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141412';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const team = myTeamName || '우리 FC';
  const qLabel = `${q}Q`;
  const dateStr = new Date().toLocaleDateString('ko-KR');
  ctx.fillStyle = '#f0f0ee';
  ctx.font = `bold ${15 * sc}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`⚽ ${team}`, pad, headerH / 2 - 8 * sc);
  ctx.fillStyle = '#60a5fa';
  ctx.font = `bold ${13 * sc}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(qLabel, canvas.width - pad, headerH / 2 - 8 * sc);
  ctx.fillStyle = '#a0a09d';
  ctx.font = `${11 * sc}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(`${qLabel} · ${formation} · ${tokens.length}/${MAX_FIELD}명 · ${dateStr}`, pad, headerH / 2 + 10 * sc);
  const fieldCanvas = document.createElement('canvas');
  fieldCanvas.width = fieldW;
  fieldCanvas.height = fieldH;
  drawGrass(fieldCanvas);
  const fieldY = headerH + pad;
  ctx.drawImage(fieldCanvas, pad, fieldY, fieldW, fieldH);
  const cornerR = 12 * sc;
  ctx.save();
  canvasRoundRect(ctx, pad, fieldY, fieldW, fieldH, cornerR);
  ctx.clip();
  tokens.forEach(t => {
    const p = players.find(x => x.id === t.pid);
    if (!p) return;
    const slotLabel = (t.slotIdx >= 0 && labels[t.slotIdx]) ? labels[t.slotIdx] : '';
    const pos = t.pos || slotLabel || p.positions[0] || '';
    const exportToken = pos !== t.pos ? { ...t, pos } : t;
    const { x, y } = tokenXYForExport(t, slots);
    const { x: px, y: py } = normToCanvasPx(x, y, fieldW, fieldH);
    drawExportToken(ctx, p, exportToken, pad + px, fieldY + py, exportTk);
  });
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1 * sc;
  canvasRoundRect(ctx, pad, fieldY, fieldW, fieldH, cornerR);
  ctx.stroke();
  return { canvas, formation };
}
function downloadFormationCanvas(canvas, q, formation) {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { alert('이미지 생성에 실패했습니다'); resolve(false); return; }
      downloadPngBlob(blob, formationExportFilename(q, formation));
      resolve(true);
    }, 'image/png');
  });
}
async function exportFormationImageForQuarter(q) {
  const rendered = renderFormationExportCanvas(q);
  if (!rendered) return false;
  return downloadFormationCanvas(rendered.canvas, q, rendered.formation);
}
async function exportFormationImage() {
  if (!isFormationSelected()) { alertFormationRequired(); return; }
  if (!fieldTokens.length) { alert('배치된 선수가 없습니다'); return; }
  await exportFormationImageForQuarter(activeQuarter);
}
/** 4쿼터 일괄 — 배치된 쿼터 PNG를 1Q→4Q 순으로 연속 다운로드 */
async function exportAllQuarterImages() {
  const quarters = [1, 2, 3, 4].filter(q => getQuarterExportSnapshot(q).tokens.length > 0);
  if (!quarters.length) { alert('배치된 선수가 없습니다'); return; }
  for (let i = 0; i < quarters.length; i++) {
    await exportFormationImageForQuarter(quarters[i]);
    if (i < quarters.length - 1) await new Promise(r => setTimeout(r, 450));
  }
}
function findNearestSlot(excludePid,nx,ny){
  const slots=getSlots();
  let best=-1, bd=SNAP_RADIUS;
  slots.forEach((sl,i)=>{const d=Math.hypot(sl[0]-nx,sl[1]-ny);if(d<bd){bd=d;best=i;}});
  return best;
}
/** 슬롯에 스냅 — 슬롯 정중앙으로 고정, 교체 처리 포함
 *  드래그는 용량 체크 없음 (팝업 포지션 선택에서만 체크)
 */
function applySlotSnap(ft, nearSlot, pid, wasFromBench, origSlotIdx, origFreeX, origFreeY) {
  const labels = getLabels();
  const slots = getSlots();
  const slotPos = labels[nearSlot] || '';
  const other = tokenAtSlot(nearSlot, pid);
  const snapX = slots[nearSlot][0];
  const snapY = slots[nearSlot][1];

  if (other) {
    // proximity로 찾은 경우 slotIdx를 nearSlot으로 먼저 동기화
    other.slotIdx = nearSlot;
    if (wasFromBench) {
      // 벤치→필드: 기존 선수 벤치로 내보내기
      fieldTokens = fieldTokens.filter(t => t.pid !== other.pid);
    } else {
      // 필드→필드 swap: 드래그 전 원래 슬롯 정보 사용 (onGlobalMove가 -1로 리셋하기 전 값)
      const prevSlot = (origSlotIdx != null && origSlotIdx >= 0) ? origSlotIdx : ft.slotIdx;
      const prevX = (origSlotIdx != null && origSlotIdx >= 0) ? (slots[origSlotIdx]?.[0] ?? origFreeX) : (origFreeX ?? ft.freeX);
      const prevY = (origSlotIdx != null && origSlotIdx >= 0) ? (slots[origSlotIdx]?.[1] ?? origFreeY) : (origFreeY ?? ft.freeY);
      other.slotIdx = prevSlot;
      other.freeX = prevX;
      other.freeY = prevY;
      if (prevSlot >= 0 && labels[prevSlot]) other.pos = labels[prevSlot];
    }
  }
  // 드래그는 빈 슬롯 용량 체크 없이 무조건 허용

  ft.slotIdx = nearSlot;
  ft.freeX = snapX;
  ft.freeY = snapY;
  if (slotPos) ft.pos = slotPos;
  return true;
}
function tokenPos(nx, ny) {
  const cr = getCanvasRect();
  const inner = document.getElementById('fieldInner').getBoundingClientRect();
  const { x, y } = normToCanvasPx(nx, ny, cr.width, cr.height);
  return { left: cr.left - inner.left + x, top: cr.top - inner.top + y };
}

// ── 필드 렌더 ──
function renderField() {
  if (document.getElementById('tab-formation')?.classList.contains('active')) {
    // 캔버스 크기는 이미 결정된 fieldSize 기준으로만 슬롯 마커 재그림
    // (벤치 높이 변화에 의한 크기 재계산 방지 → 경기장 흔들림 없음)
    if (fieldSize.w && fieldSize.h) {
      const canvas = document.getElementById('fieldCanvas');
      drawGrass(canvas);
      drawFormationSlots(canvas.getContext('2d'), fieldSize.w, fieldSize.h, slotHighlight);
    } else {
      drawFieldCanvas(slotHighlight);
    }
  }
  const td=document.getElementById('tokens');
  td.innerHTML='';
  document.getElementById('slotInfo').textContent=fieldTokens.length+'/'+MAX_FIELD;
  fieldTokens.forEach(t=>{
    const p=players.find(x=>x.id===t.pid); if(!p) return;
    // t.pos 우선 (사용자가 명시적으로 지정한 포지션)
    // t.pos 없으면 슬롯 라벨로 채움 (초기 로드·자동배치 등)
    const labels=getLabels();
    const slotLabel=(t.slotIdx>=0&&labels[t.slotIdx])?labels[t.slotIdx]:'';
    if(!t.pos&&slotLabel) t.pos=slotLabel; // 비어있을 때만 슬롯 라벨로 채움
    const pos=resolveTokenPos(t,p);
    const ovr=getOvr(p,pos);
    const {x,y}=tokenXY(t);
    const {left,top}=tokenPos(x,y);
    const el=document.createElement('div');
    el.className='player-token';
    el.style.left=left+'px'; el.style.top=top+'px';
    el.dataset.pid=t.pid;

    el.innerHTML = buildTokenInnerHtml(p, pos, ovr, t.subPid);
    el.addEventListener('mousedown',onTokenMouseDown);
    el.addEventListener('touchstart',onTokenTouchStart,{passive:false});
    td.appendChild(el);
  });
  renderBench();
  updateQuarterCopyBtns();
}

// ── 전역 드래그 ──
let drag={active:false,pid:null,fromBench:false,origFromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
const LONG_PRESS=200, MOVE_THRESH=6;
function onTokenMouseDown(e){e.preventDefault();startDrag(parseInt(this.dataset.pid),false,e.clientX,e.clientY,this);}
function onTokenTouchStart(e){e.preventDefault();startDrag(parseInt(this.dataset.pid),false,e.touches[0].clientX,e.touches[0].clientY,this);}
function startDrag(pid,fromBench,ex,ey,el){
  if(!isAdmin) return;
  if(drag.longPressTimer){clearTimeout(drag.longPressTimer);drag.longPressTimer=null;}
  if(drag.el)drag.el.classList.remove('dragging','snapping');
  const origToken = fieldTokens.find(t => t.pid === pid);
  drag={active:false,pid,fromBench,origFromBench:fromBench,
    origSlotIdx: origToken?.slotIdx ?? -1,
    origFreeX: origToken?.freeX ?? 0.5,
    origFreeY: origToken?.freeY ?? 0.5,
    startX:ex,startY:ey,moved:false,longPressTimer:null,el};
  drag.longPressTimer=setTimeout(()=>{
    drag.active=true;drag.el.classList.add('dragging');
    const { x, y } = tokenXY(fieldTokens.find(t => t.pid === pid) || { slotIdx: -1, freeX: 0.5, freeY: 0.5 });
    refreshFieldSlots(findNearestSlot(pid, x, y));
  },LONG_PRESS);
}
document.addEventListener('mousemove',onGlobalMove);
document.addEventListener('mouseup',onGlobalUp);
document.addEventListener('touchmove',e=>{if(drag.pid!==null){e.preventDefault();onGlobalMove(e.touches[0]);}},{passive:false});
document.addEventListener('touchend',e=>{if(drag.pid!==null)onGlobalUp(e.changedTouches[0]);});

function onGlobalMove(e){
  if(drag.pid===null)return;
  const ex=e.clientX, ey=e.clientY;
  if(!drag.active){
    if(Math.sqrt((ex-drag.startX)**2+(ey-drag.startY)**2)<MOVE_THRESH)return;
    drag.moved=true;
    clearTimeout(drag.longPressTimer);drag.longPressTimer=null;
    drag.active=true;
    if(drag.fromBench&&!fieldTokens.find(t=>t.pid===drag.pid)){
      if (!isFormationSelected()) {
        drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
        alertFormationRequired(); return;
      }
      // MAX_FIELD 체크는 onGlobalUp(드롭 시점)에서 수행 — 교체 의도 판단 후 차단
      // 드래그 중엔 renderField 호출 안 함 — 토큰 DOM만 직접 생성
      fieldTokens.push({pid:drag.pid,slotIdx:-1,freeX:0.5,freeY:0.5,pos:''});
      drag.fromBench=false;
      const p=players.find(x=>x.id===drag.pid);
      if(p){
        const td=document.getElementById('tokens');
        const newEl=document.createElement('div');
        newEl.className='player-token dragging';
        newEl.dataset.pid=drag.pid;
        newEl.style.left='0px';newEl.style.top='0px';
        const pos=p.positions[0]||''; // 드래그 시작 시 아직 슬롯 미정이므로 등록 포지션 기본값
        const ovr=getOvr(p,pos);
        newEl.innerHTML = buildTokenInnerHtml(p, pos, ovr, null);
        newEl.addEventListener('mousedown',onTokenMouseDown);
        newEl.addEventListener('touchstart',onTokenTouchStart,{passive:false});
        td.appendChild(newEl);
        drag.el=newEl;
      }
    }
    if(drag.el)drag.el.classList.add('dragging');
  }
  const { x: nx, y: ny } = pointerToNorm(ex, ey);
  const ft=fieldTokens.find(t=>t.pid===drag.pid);
  if(ft){ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny;}
  if(drag.el){
    const {left,top}=tokenPos(nx,ny);
    drag.el.style.left=left+'px';drag.el.style.top=top+'px';
    drag.el.classList.toggle('snapping',findNearestSlot(drag.pid,nx,ny)>=0);
  }
  refreshFieldSlots(findNearestSlot(drag.pid, nx, ny));
}

function onGlobalUp(e){
  if(drag.pid===null)return;
  clearTimeout(drag.longPressTimer);drag.longPressTimer=null;
  const ex=e.clientX, ey=e.clientY;
  const pid=drag.pid,wasActive=drag.active,wasMoved=drag.moved,wasFromBench=drag.origFromBench,origSlotIdx=drag.origSlotIdx,origFreeX=drag.origFreeX,origFreeY=drag.origFreeY,el=drag.el;
  drag={active:false,pid:null,fromBench:false,startX:0,startY:0,moved:false,longPressTimer:null,el:null};
  if(el)el.classList.remove('dragging','snapping');
  slotHighlight = -1;

  if(!wasActive&&!wasMoved){handlePlayerTap(pid,el,wasFromBench);refreshFieldSlots(-1);return;}

  if(wasActive){
    // 벤치로 드래그
    const benchRect=document.querySelector('.bench-section').getBoundingClientRect();
    if(ey>=benchRect.top&&ex>=benchRect.left&&ex<=benchRect.right){
      fieldTokens=fieldTokens.filter(t=>t.pid!==pid);
      saveFieldState();renderField();return;
    }
    const { x: nx, y: ny } = pointerToNorm(ex, ey);
    const ft=fieldTokens.find(t=>t.pid===pid);
    if(!ft){saveFieldState();renderField();return;}

    const nearSlot=findNearestSlot(pid,nx,ny);
    if(nearSlot>=0){
      if (!applySlotSnap(ft, nearSlot, pid, wasFromBench, origSlotIdx, origFreeX, origFreeY)) {
        ft.slotIdx=-1; ft.freeX=nx; ft.freeY=ny;
      }
    } else {
      ft.slotIdx=-1;ft.freeX=nx;ft.freeY=ny;
    }
    // 벤치→필드 드래그였는데 교체 없이 추가된 경우 MAX_FIELD 초과 차단
    if (wasFromBench && fieldTokens.length > MAX_FIELD) {
      fieldTokens = fieldTokens.filter(t => t.pid !== pid);
      alert(`최대 ${MAX_FIELD}명까지만 출전 가능합니다.`);
      saveFieldState(); renderField(); return;
    }
    saveFieldState();renderField();
    checkSuspensionWarning(pid);
  } else {
    refreshFieldSlots(-1);
  }
}

function formatBenchPosTag(p) {
  if (!p.positions?.length) return '';
  const primary = primaryPos(p) || '';
  const secondary = p.positions.filter(pos => pos !== primary).join(',');
  const label = secondary ? `${primary} \u00B7 ${secondary}` : primary;
  return `<span class="bench-pos-tag">${label}</span>`;
}

function renderBench(){
  const onField=fieldTokens.map(t=>t.pid);
  const bench=players.filter(p=>{
    if(onField.includes(p.id)) return false;
    if(sessionAvailablePids !== null && !sessionAvailablePids.has(String(p.id))) return false;
    return true;
  });
  // 프레젠테이션 모드: 좌측 패널 사용, 일반 모드: 기존 benchList 사용
  const targetId = presentMode ? 'presentBenchList' : 'benchList';
  const altId = presentMode ? 'benchList' : 'presentBenchList';
  const altEl = document.getElementById(altId);
  if (altEl) altEl.innerHTML = '';
  const el=document.getElementById(targetId);
  if(!el) return;
  if(!bench.length){el.innerHTML='<span style="font-size:12px;color:var(--text3)">\uC804\uC6D0 \uCD9C\uC804 \uC911</span>';return;}
  el.innerHTML='';
  bench.forEach(p=>{
    const ovr=getBestOvr(p);
    const eff=ovr!=null?ovr+(p.formBonus||0):null;
    const wrap=document.createElement('div');
    wrap.className='bench-item';
    const div=document.createElement('div');
    div.className='bench-player';div.dataset.pid=p.id;
    const posTag = presentMode ? formatBenchPosTag(p) : '';
    div.innerHTML=`<div class="dot" style="background:${primaryPosColor(p)}"></div>${p.jersey!=null?'#'+p.jersey+' ':''}${p.name}${posTag}${eff!=null?`<span class="bench-player-ovr">${eff}</span>`:''}`;
    div.addEventListener('mousedown',function(e){if(!isAdmin)return;e.preventDefault();startDrag(p.id,true,e.clientX,e.clientY,this);});
    div.addEventListener('touchstart',function(e){if(!isAdmin)return;e.preventDefault();startDrag(p.id,true,e.touches[0].clientX,e.touches[0].clientY,this);},{passive:false});
    wrap.appendChild(div);
    if(isAdmin){
      const swapBtn=document.createElement('button');
      swapBtn.className='btn-bench-swap';swapBtn.dataset.pid=p.id;
      swapBtn.textContent='🔄';
      swapBtn.title='출전 교체';
      swapBtn.onclick=function(e){e.stopPropagation();openBenchReplace(p.id);};
      wrap.appendChild(swapBtn);
    }
    el.appendChild(wrap);
  });
}

function getOvrForSlot(p, slotLabel) {
  const matching=p.positions.filter(pos=>slotAcceptsPos(slotLabel,pos));
  if(!matching.length) return getBestOvr(p);
  return Math.max(...matching.map(pos=>getOvr(p,pos)??0));
}
function bestPosForSlot(p, slotLabel) {
  const matching=p.positions.filter(pos=>slotAcceptsPos(slotLabel,pos));
  if(!matching.length) return slotLabel;
  return matching.sort((a,b)=>(getOvr(p,b)??0)-(getOvr(p,a)??0))[0];
}
function pickBestPlayerForSlot(slotLabel, used) {
  // 오늘 멤버 필터가 활성화된 경우 가용 선수만 대상
  const avail = p => sessionAvailablePids === null || sessionAvailablePids.has(String(p.id));
  let candidates=players.filter(p=>!used.has(p.id)&&avail(p)&&p.positions.some(pos=>slotAcceptsPos(slotLabel,pos)));
  if(!candidates.length&&slotLabel==='GK') candidates=players.filter(p=>!used.has(p.id)&&avail(p)&&p.positions.includes('GK'));
  if(!candidates.length) return null;
  candidates.sort((a,b)=>getOvrForSlot(b,slotLabel)-getOvrForSlot(a,slotLabel));
  return candidates[0];
}

function applyFormation(){
  if (!isFormationSelected()) { alertFormationRequired(); return; }
  const f=getFormation(), slots=FORMATIONS[f]; if(!slots)return;
  const labels=FORMATION_POS_LABELS[f]||[];
  const used=new Set();
  fieldTokens=[];
  for(let i=0;i<slots.length;i++){
    const label=labels[i]||'';
    const p=pickBestPlayerForSlot(label,used);
    if(!p) continue;
    used.add(p.id);
    const def=slotDefaultXY(i);
    fieldTokens.push({pid:p.id,slotIdx:i,freeX:def.x,freeY:def.y,pos:label||bestPosForSlot(p,label)});
  }
  // 크기 먼저 확정하고 렌더 (자동배치 후 경기장 크기 재계산 방지)
  drawFieldCanvas(slotHighlight);
  saveFieldState();renderField();
}
function clearField(){
  fieldTokens=[];
  quarterData[activeQuarter] = getFormation() ? { formation: getFormation(), tokens: [] } : null;
  saveFieldState();renderField();
}
function saveFieldState(){ persistField().catch(handleSaveError); }

// ── 오늘 멤버 필터 (세션 전용) ──
function toggleAvailFilter() {
  if (sessionAvailablePids === null) {
    // 필터 ON: 1~4쿼터 전체 필드 비우고, 빈 Set으로 시작
    fieldTokens = [];
    for (let q = 1; q <= 4; q++) {
      quarterData[q] = { ...(quarterData[q] || {}), formation: quarterData[q]?.formation || '', tokens: [] };
    }
    saveFieldState();
    drawFieldCanvas(slotHighlight);
    renderField();
    sessionAvailablePids = new Set();
  } else {
    // 필터 OFF: 전체 해제
    sessionAvailablePids = null;
  }
  renderAvailPanel();
  renderBench();
  updateAvailBtn();
}
function toggleAvailPlayer(pid) {
  if (!sessionAvailablePids) return;
  const key = String(pid);
  if (sessionAvailablePids.has(key)) {
    sessionAvailablePids.delete(key);
    // 필드에 배치돼 있으면 함께 제거
    const onField = fieldTokens.some(t => String(t.pid) === key);
    if (onField) {
      fieldTokens = fieldTokens.filter(t => String(t.pid) !== key);
      quarterData[activeQuarter] = { ...(quarterData[activeQuarter] || {}), formation: getFormation(), tokens: [...fieldTokens] };
      saveFieldState();
      drawFieldCanvas(slotHighlight);
      renderField();
    }
  } else {
    sessionAvailablePids.add(key);
  }
  renderAvailPanel();
  renderBench();
  updateAvailBtn();
}
function renderAvailPanel() {
  // 프레젠테이션 모드: 좌측 패널 내 presentAvailArea 사용
  if (presentMode) {
    const area = document.getElementById('presentAvailArea');
    if (!area) return;
    if (sessionAvailablePids === null) {
      area.innerHTML = '<div class="pp-avail-inactive">\uD544\uD130 \uBE44\uD65C\uC131 &middot; \uC804\uC6D0 \uCD9C\uC804 \uAC00\uB2A5</div>';
    } else {
      area.innerHTML =
        '<div class="avail-chips">'
        + players.map(p =>
            `<button type="button" class="avail-chip ${sessionAvailablePids.has(String(p.id))?'on':'off'}" onclick="toggleAvailPlayer(${p.id})">${p.jersey!=null?'#'+p.jersey+' ':''}${p.name}</button>`
          ).join('')
        + '</div>';
    }
    // 일반 availPanel은 비움
    const oldPanel = document.getElementById('availPanel');
    if (oldPanel) { oldPanel.style.display = 'none'; oldPanel.innerHTML = ''; }
    return;
  }
  // 일반 모드
  const panel = document.getElementById('availPanel');
  if (!panel) return;
  if (sessionAvailablePids === null) { panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  panel.innerHTML =
    `<div class="avail-panel-header">
       <span>\uC624\uB298 \uCC38\uC804 \uBA64\uBC84 (\uBCA4\uCE58\uC5D0\uB9CC \uBC18\uC601)</span>
     </div>`
    + '<div class="avail-chips">'
    + players.map(p =>
        `<button type="button" class="avail-chip ${sessionAvailablePids.has(String(p.id))?'on':'off'}" onclick="toggleAvailPlayer(${p.id})">${p.jersey!=null?'#'+p.jersey+' ':''}${p.name}</button>`
      ).join('')
    + '</div>';
}
function updateAvailBtn() {
  const btn = document.getElementById('btnAvail');
  if (btn) {
    if (sessionAvailablePids === null) {
      btn.innerHTML = '&#x1F465; \uC624\uB298 \uBA64\uBC84';
      btn.classList.remove('active');
    } else {
      btn.innerHTML = '&#x2714; \uC624\uB298 \uBA64\uBC84 ON &middot; ' + sessionAvailablePids.size + '\uBA85';
      btn.classList.add('active');
    }
  }
  // 좌측 패널 내 버튼도 업데이트
  const pbtn = document.getElementById('btnAvailPresent');
  if (pbtn) {
    if (sessionAvailablePids === null) {
      pbtn.textContent = '\uD544\uD130 OFF';
      pbtn.classList.remove('active');
    } else {
      pbtn.textContent = '\uD544\uD130 ON \u00B7 ' + sessionAvailablePids.size + '\uBA85';
      pbtn.classList.add('active');
    }
  }
}
function loadFieldState(){
  const migrateTokenPos = t => ({...t, pos: migratePos(t.pos || '')});
  // 1. 쿼터 형식 우선 시도
  const qRaw = localStorage.getItem('fc_field_quarters');
  if (qRaw) {
    try {
      const o = JSON.parse(qRaw);
      quarterData = o.quarterData || {1:null,2:null,3:null,4:null};
      activeQuarter = o.activeQuarter || 1;
      // 각 쿼터 토큰 마이그레이션 + 빈 쿼터는 null
      for (let q = 1; q <= 4; q++) {
        const qd = quarterData[q];
        if (!qd) { quarterData[q] = null; continue; }
        const tokens = normalizeFieldTokens(qd.tokens || []).map(migrateTokenPos);
        const formation = qd.formation || '';
        quarterData[q] = (!tokens.length && !formation) ? null : { formation, tokens };
      }
      const qd = quarterData[activeQuarter];
      if (qd) {
        fieldTokens = qd.tokens || [];
        const formation = resolveFormation(qd.formation, fieldTokens);
        if (formation) { saveFormationLocal(formation); setFormationSelect(formation); }
        if (formation) reconcileFieldTokensToFormation();
      }
      updateQuarterButtons();
      return;
    } catch (e) { /* fall through */ }
  }
  // 2. 구 형식 fc_field_full
  const full = localStorage.getItem('fc_field_full');
  if (full) {
    try {
      const o = JSON.parse(full);
      fieldTokens = normalizeFieldTokens(o.tokens).map(migrateTokenPos);
      const formation = resolveFormation(o.formation, fieldTokens);
      if (formation) { saveFormationLocal(formation); setFormationSelect(formation); }
      if (formation) reconcileFieldTokensToFormation();
      quarterData[1] = { formation: getFormation(), tokens: JSON.parse(JSON.stringify(fieldTokens)) };
      updateQuarterButtons();
      return;
    } catch (e) { /* fall through */ }
  }
  // 3. 구 형식 fc_field
  const s = localStorage.getItem('fc_field');
  if (!s) return;
  fieldTokens = normalizeFieldTokens(JSON.parse(s)).map(migrateTokenPos);
  const formation = resolveFormation(localStorage.getItem('fc_formation'), fieldTokens);
  if (formation) { saveFormationLocal(formation); setFormationSelect(formation); }
  if (formation) reconcileFieldTokensToFormation();
  quarterData[1] = { formation: getFormation(), tokens: JSON.parse(JSON.stringify(fieldTokens)) };
  updateQuarterButtons();
}

// ── 포메이션 저장 ──
function saveFormation(){
  document.getElementById('fsaveNameInput').value='';
  document.getElementById('fsaveModal').classList.add('open');
  setTimeout(()=>document.getElementById('fsaveNameInput').focus(),100);
}
function closeFsaveModal(){document.getElementById('fsaveModal').classList.remove('open');}
function confirmSaveFormation(){
  const name=document.getElementById('fsaveNameInput').value.trim();
  if(!name){alert('이름을 입력해주세요');return;}
  // 현재 쿼터 동기화
  quarterData[activeQuarter]={formation:getFormation(),tokens:JSON.parse(JSON.stringify(fieldTokens))};
  const save={id:Date.now(),name,date:new Date().toISOString().slice(0,10)};
  for(let q=1;q<=4;q++){
    const qd=quarterData[q]||{};
    save['q'+q+'formation']=qd.formation||'';
    save['q'+q+'tokens']=JSON.parse(JSON.stringify(qd.tokens||[]));
  }
  // 하위 호환
  save.formation=save.q1formation||'';
  save.tokens=save.q1tokens||[];
  formationSaves.unshift(save);
  persistSaves().then(()=>{closeFsaveModal();renderFormationSaves();alert('저장되었습니다!');}).catch(handleSaveError);
}
document.getElementById('fsaveModal')?.addEventListener('click',function(e){if(e.target===this)closeFsaveModal();});
function loadSave(id){
  const s=formationSaves.find(x=>x.id===id); if(!s)return;
  const migrateT=t=>({...t,pos:migratePos(t.pos||'')});
  if(s.q1tokens!==undefined){
    // 신규 4쿼터 형식
    for(let q=1;q<=4;q++){
      const tokens=normalizeFieldTokens(s['q'+q+'tokens']||[]).map(migrateT);
      quarterData[q]={formation:s['q'+q+'formation']||'',tokens};
    }
  } else {
    // 구형식: q1만 채우기
    const tokens=normalizeFieldTokens(s.tokens||[]).map(migrateT);
    quarterData[1]={formation:s.formation||'',tokens};
    for(let q=2;q<=4;q++) quarterData[q]=null;
  }
  activeQuarter=1;
  const qd=quarterData[1]||{formation:'',tokens:[]};
  fieldTokens=qd.tokens;
  setFormationSelect(qd.formation||'');
  if(qd.formation) reconcileFieldTokensToFormation();
  updateQuarterButtons();
  drawFieldCanvas();renderField();renderBench();renderFormationSaves();
  persistField().catch(handleSaveError);
}
function deleteSave(id){
  if(!confirm('삭제하시겠습니까?'))return;
  formationSaves=formationSaves.filter(s=>s.id!==id);
  persistSaves().then(renderFormationSaves).catch(handleSaveError);
}
function renderFormationSaves(){
  const panel=document.getElementById('formationSavesPanel');
  const list=document.getElementById('formationSavesList');
  panel.style.display=formationSaves.length?'block':'none';
  list.innerHTML=formationSaves.map(s=>{
    const mainFormation=s.q1formation||s.formation||'';
    const totalPlayers=[1,2,3,4].reduce((acc,q)=>{
      const tok=s['q'+q+'tokens']||s.tokens||[];
      tok.forEach(t=>acc.add(t.pid));return acc;
    },new Set()).size;
    const hasMultiQ=[2,3,4].some(q=>(s['q'+q+'tokens']||[]).length>0);
    return `<div class="fsave-item">
      <div class="fsave-info">
        <div class="fsave-name">${s.name}</div>
        <div class="fsave-meta">${mainFormation} · ${totalPlayers}명 · ${formatDateDisplay(s.date)}${hasMultiQ?' · 4Q':''}</div>
      </div>
      <button class="btn-fsave-load" onclick="loadSave(${s.id})">불러오기</button>
      <button class="btn-fsave-del" onclick="deleteSave(${s.id})">✕</button>
    </div>`;
  }).join('');
}

// ── 경기 기록 ──
function participantEntry(pid, pos, type, pairedWith) {
  const p=players.find(x=>x.id===pid); if(!p) return null;
  const usePos=pos||p.positions[0]||'';
  return {pid,name:p.name,pos:usePos,ovr:getOvr(p,usePos),type:type||'starter',pairedWith:pairedWith||null};
}
function buildParticipantsFromField() {
  // 현재 쿼터 상태 동기화
  quarterData[activeQuarter] = {
    formation: getFormation(),
    tokens: JSON.parse(JSON.stringify(fieldTokens))
  };
  const pidMap = {}; // pid -> {type, entry, quarters: Set}
  for (let q = 1; q <= 4; q++) {
    const qd = quarterData[q];
    if (!qd || !qd.tokens || !qd.tokens.length) continue;
    qd.tokens.forEach(t => {
      if (players.find(x => x.id === t.pid)) {
        if (!pidMap[t.pid]) {
          pidMap[t.pid] = { type:'starter', entry:participantEntry(t.pid,t.pos,'starter'), quarters:new Set() };
        } else if (pidMap[t.pid].type === 'sub') {
          pidMap[t.pid].type = 'starter'; // 교체후보에서 승격
        }
        pidMap[t.pid].quarters.add(q);
      }
      if (t.subPid && players.find(x => x.id === t.subPid)) {
        if (!pidMap[t.subPid]) {
          pidMap[t.subPid] = { type:'sub', entry:participantEntry(t.subPid,t.pos,'sub',t.pid), quarters:new Set() };
        }
        pidMap[t.subPid].quarters.add(q);
      }
    });
  }
  return Object.values(pidMap).map(({type,entry,quarters}) => ({
    ...entry, type, quarters:[...quarters].sort()
  }));
}
function buildParticipantsFromMatch(em) {
  const list=[];
  (em.lineup||[]).forEach(l=>list.push({...l,type:'starter'}));
  (em.subs||[]).forEach(s=>list.push({...s,type:'sub'}));
  return list;
}
function renderMatchLineupPreview() {
  const el=document.getElementById('matchLineupPreview');
  if(!matchParticipants.length){el.innerHTML='<span style="color:var(--text3)">포메 탭에서 필드에 선수를 배치한 뒤 경기 기록을 열어주세요.<br><small style="font-size:10px">용병은 명단에서 임시 추가 후 필드에 배치하면 됩니다.</small></span>';return;}
  const starters=matchParticipants.filter(x=>x.type!=='sub');
  const subs=matchParticipants.filter(x=>x.type==='sub');
  const activeQs = [1,2,3,4].filter(q => {const qd=q===activeQuarter?{tokens:fieldTokens}:quarterData[q]; return qd?.tokens?.length>0;});
  const qSummary = activeQs.length > 1 ? `<span style="font-size:10px;color:var(--text3);margin-left:4px">(${activeQs.length}쿼터 집계)</span>` : '';
  el.innerHTML=`총 ${matchParticipants.length}명 (선발 ${starters.length}${subs.length?' · 교체후보 '+subs.length:''})${qSummary}`+
    `<div style="margin-top:4px;font-size:11px">${starters.map(x=>x.name+quarterLabel(x.quarters)).join(', ')}`+
    (subs.length?`<br>🔄 ${subs.map(x=>x.name+quarterLabel(x.quarters)).join(', ')}`:'')+`</div>`;
}
function renderMatchModalEvents(em) {
  const list=document.getElementById('matchEventList');
  if(!matchParticipants.length){
    list.innerHTML='<div style="font-size:13px;color:var(--text3)">포메 탭에서 필드에 선수를 배치한 뒤 「포메이션에서 불러오기」를 눌러주세요.<br><small style="font-size:10px">용병은 명단에서 임시 추가 → 필드 배치 → 불러오기</small></div>';
    document.getElementById('momSelectWrap').innerHTML='';
    renderMatchLineupPreview();
    return;
  }
  matchEvents=Object.fromEntries(matchParticipants.map(x=>[x.pid,{
    goals:em?.scorers?.find(s=>s.pid===x.pid)?.goals||0,
    assists:em?.scorers?.find(s=>s.pid===x.pid)?.assists||0
  }]));
  list.innerHTML=`<div class="match-event-table">
    <div class="match-event-row match-event-head-row">
      <div class="match-event-namecol">선수</div>
      <div class="match-event-stat match-event-stat-h" title="골">⚽</div>
      <div class="match-event-stat match-event-stat-h" title="어시스트">🅰️</div>
    </div>
    ${matchParticipants.map(x=>{
    const subTag=x.type==='sub'?' · 🔄교체':'';
    const qTag=x.quarters?.length?quarterLabel(x.quarters):'';
    const meta=[qTag,x.pos].filter(Boolean).join(' · ')+subTag;
    return `<div class="match-event-row">
      <div class="match-event-namecol">
        <span class="match-event-name">${x.name}</span>
        <span class="match-event-meta">${meta||x.pos||''}</span>
      </div>
      <div class="match-event-stat">
        <div class="event-count">
          <button class="btn-event" onclick="changeEvent(${x.pid},'goals',-1)">−</button>
          <span class="event-num" id="g_${x.pid}">${matchEvents[x.pid].goals}</span>
          <button class="btn-event" onclick="changeEvent(${x.pid},'goals',1)">+</button>
        </div>
      </div>
      <div class="match-event-stat">
        <div class="event-count">
          <button class="btn-event" onclick="changeEvent(${x.pid},'assists',-1)">−</button>
          <span class="event-num" id="a_${x.pid}">${matchEvents[x.pid].assists}</span>
          <button class="btn-event" onclick="changeEvent(${x.pid},'assists',1)">+</button>
        </div>
      </div>
    </div>`;
  }).join('')}
  </div>`;
  document.getElementById('momSelectWrap').innerHTML=`
  <div class="mom-select-label">&#x1F3C6; MOM (${wageRates.mom}&#xC6D0;)</div>
  <div class="mom-select" id="momBtns">
    ${matchParticipants.map(x=>`<button class="mom-btn ${matchMom===x.pid?'active':''}" onclick="selectMom(${x.pid})" id="mom_${x.pid}">${x.name}${x.type==='sub'?' 🔄':''}</button>`).join('')}
  </div>
  <div class="mom-select-label" style="margin-top:8px">&#x1F6E1;&#xFE0F; &#xBCA0;&#xC2A4;&#xD2B8; &#xC218;&#xBE44; (${wageRates.bestDef}&#xC6D0;)</div>
  <div class="mom-select" id="bestDefBtns">
    <button class="mom-btn ${matchBestDef===null?'active':''}" onclick="selectBestDef(null)" id="bd_none">&#xC5C6;&#xC74C;</button>
    ${matchParticipants.map(x=>`<button class="mom-btn ${matchBestDef===x.pid?'active':''}" onclick="selectBestDef(${x.pid})" id="bd_${x.pid}">${x.name}${x.type==='sub'?' 🔄':''}</button>`).join('')}
  </div>
  <div class="mom-select-label" style="margin-top:8px">&#x1F6E1;&#xFE0F; &#xC218;&#xBE44; &#xACF5;&#xD5CC; &#xC218;&#xB2F9; (${wageRates.bestDef2}&#xC6D0;)</div>
  <div class="mom-select" id="bestDef2Btns">
    <button class="mom-btn ${matchBestDef2===null?'active':''}" onclick="selectBestDef2(null)" id="bd2_none">&#xC5C6;&#xC74C;</button>
    ${matchParticipants.map(x=>`<button class="mom-btn ${matchBestDef2===x.pid?'active':''}" onclick="selectBestDef2(${x.pid})" id="bd2_${x.pid}">${x.name}${x.type==='sub'?' 🔄':''}</button>`).join('')}
  </div>`;
  renderMatchLineupPreview();
}
function syncMatchFromFormation(){
  const em=editingMatchId?matches.find(m=>m.id===editingMatchId):null;
  matchParticipants=buildParticipantsFromField();
  renderMatchModalEvents(em);
}
function openMatchModal(editId){
  matchEvents={};matchMom=null;matchBestDef=null;matchBestDef2=null;editingMatchId=editId||null;
  const em=editId?matches.find(m=>m.id===editId):null;
  document.getElementById('matchMyTeam').value=myTeamName||'';
  document.getElementById('matchOppTeam').value=em?.oppTeam||'';
  document.getElementById('matchDate').value=normalizeDate(em?.date)||new Date().toISOString().slice(0,10);
  document.getElementById('matchScoreUs').value=em?.scoreUs??0;
  document.getElementById('matchScoreOpp').value=em?.scoreOpp??0;
  const oppOgEl=document.getElementById('matchOppOwnGoals');
  if(oppOgEl) oppOgEl.value=em?.oppOwnGoals??0;
  matchMom=em?.mom||null;
  matchBestDef=em?.bestDef||null;
  matchBestDef2=em?.bestDef2||null;
  if(em) matchParticipants=buildParticipantsFromMatch(em);
  else matchParticipants=buildParticipantsFromField();
  renderMatchModalEvents(em);
  document.getElementById('matchModal').classList.add('open');
}
function selectMom(pid){
  matchMom=(matchMom===pid)?null:pid;
  document.querySelectorAll('#momBtns .mom-btn').forEach(b=>b.classList.remove('active'));
  const active=document.getElementById(pid===null?'mom_none':'mom_'+matchMom);
  if(active)active.classList.add('active');
  if(!matchMom){const b=document.getElementById('mom_none');if(b)b.classList.add('active');}
}
function selectBestDef(pid){
  matchBestDef=pid;
  document.querySelectorAll('#bestDefBtns .mom-btn').forEach(b=>b.classList.remove('active'));
  const id=pid===null?'bd_none':'bd_'+pid;
  const b=document.getElementById(id);if(b)b.classList.add('active');
}
function selectBestDef2(pid){
  matchBestDef2=pid;
  document.querySelectorAll('#bestDef2Btns .mom-btn').forEach(b=>b.classList.remove('active'));
  const id=pid===null?'bd2_none':'bd2_'+pid;
  const b=document.getElementById(id);if(b)b.classList.add('active');
}
function changeEvent(pid,type,delta){
  if(!matchEvents[pid])matchEvents[pid]={goals:0,assists:0};
  matchEvents[pid][type]=Math.max(0,matchEvents[pid][type]+delta);
  const idMap={goals:'g_',assists:'a_'};
  const el=document.getElementById((idMap[type]||'g_')+pid);
  if(el) el.textContent=matchEvents[pid][type];
}
function closeMatchModal(){document.getElementById('matchModal').classList.remove('open');}
function saveMatch(){
  if(!matchParticipants.length){alert('출전 선수가 없습니다');return;}
  const myTeam=document.getElementById('matchMyTeam').value.trim()||'우리 FC';
  const oppTeam=document.getElementById('matchOppTeam').value.trim()||'상대 FC';
  const date=normalizeDate(document.getElementById('matchDate').value);
  const scoreUs=parseInt(document.getElementById('matchScoreUs').value)||0;
  const scoreOpp=parseInt(document.getElementById('matchScoreOpp').value)||0;
  const oppOwnGoals=parseInt(document.getElementById('matchOppOwnGoals')?.value,10)||0;
  const homeAway=null; // 홈/어웨이 미사용 (하위호환용 null 유지)
  const totalGoals=matchParticipants.reduce((s,x)=>s+(matchEvents[x.pid]?.goals||0),0);
  if(totalGoals+oppOwnGoals!==scoreUs){
    alert(`선수 골(${totalGoals}) + 상대 자책(${oppOwnGoals}) = ${totalGoals+oppOwnGoals}, 우리 팀 득점(${scoreUs})과 일치하지 않습니다.`);
    return;
  }
  myTeamName=myTeam;
  const em=editingMatchId?matches.find(m=>m.id===editingMatchId):null;
  const scorers=matchParticipants.map(x=>{
    const ev=matchEvents[x.pid]||{goals:0,assists:0};
    return{pid:x.pid,name:x.name,pos:x.pos,ovr:x.ovr,goals:ev.goals,assists:ev.assists};
  }).filter(x=>x.goals>0||x.assists>0);
  const lineup=matchParticipants.filter(x=>x.type!=='sub').map(({pid,name,pos,ovr,quarters})=>({pid,name,pos,ovr,...(quarters?.length?{quarters}:{})}));
  const subs=matchParticipants.filter(x=>x.type==='sub').map(({pid,name,pos,ovr,pairedWith,quarters})=>({pid,name,pos,ovr,pairedWith,...(quarters?.length?{quarters}:{})}));
  const momPlayer=matchMom?players.find(p=>p.id===matchMom):null;
  const matchData={
    id:editingMatchId||Date.now(),myTeam,oppTeam,date,homeAway,scoreUs,scoreOpp,
    oppOwnGoals,
    formation:em?.formation||getFormation(),lineup,subs,scorers,
    mom:matchMom||null,momName:momPlayer?.name||null,
    bestDef:matchBestDef||null,bestDef2:matchBestDef2||null
  };
  if(editingMatchId){const idx=matches.findIndex(m=>m.id===editingMatchId);if(idx>=0)matches[idx]=matchData;else matches.unshift(matchData);}
  else matches.unshift(matchData);
  Promise.all([persistMatches(), persistMeta()]).then(()=>{
    closeMatchModal();renderRecords();refreshStatsIfVisible();
  }).catch(handleSaveError);
}
function deleteMatch(id){
  if(!confirm('삭제하시겠습니까?'))return;
  matches=matches.filter(m=>m.id!==id);
  persistMatches().then(()=>{renderRecords();refreshStatsIfVisible();}).catch(handleSaveError);
}
function renderRecords(){
  const el=document.getElementById('recordsContent');
  if(!matches.length){el.innerHTML='<div class="empty-state">기록된 경기가 없습니다</div>';return;}
  el.innerHTML=matches.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(m=>{
    const res=m.scoreUs>m.scoreOpp?'🏆 승':m.scoreUs===m.scoreOpp?'🤝 무':'💔 패';
    const cardCls=m.scoreUs>m.scoreOpp?'win':m.scoreUs===m.scoreOpp?'draw':'lose';

    const scorerRows=(m.scorers||[]).map(s=>{
      const parts=[];
      if(s.goals) parts.push(`골 ${s.goals}`);
      if(s.assists>0) parts.push(`어시 ${s.assists}`);
      return `
      <div class="match-scorer-row">
        <span class="match-scorer-icon">⚽</span>
        <span class="match-scorer-name">${s.name}</span>
        <span class="match-scorer-pos">${s.pos}</span>
        <span class="match-scorer-ovr">${s.ovr!=null?s.ovr+' '+ovrStarsText(s.ovr):''}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--text2)">${parts.join(' · ')||'—'}</span>
      </div>`;
    }).join('');
    const lineupTags=(m.lineup||[]).map(l=>{
      const qb=l.quarters&&l.quarters.length<4?`<span style="font-size:9px;opacity:.7">${quarterLabel(l.quarters)}</span>`:'';
      return `<span class="match-lineup-tag">${l.name}${qb}</span>`;
    }).join('');
    const subTags=(m.subs||[]).map(s=>{
      const qb=s.quarters&&s.quarters.length<4?`<span style="font-size:9px;opacity:.7">${quarterLabel(s.quarters)}</span>`:'';
      return `<span class="match-lineup-tag sub">🔄${s.name}${qb}</span>`;
    }).join('');
    const momBadge=m.momName?`<span class="match-mom">🏅 MOM ${m.momName}</span>`:'';
    const bdName=m.bestDef?players.find(p=>p.id==m.bestDef)?.name||'':null;
    const bd2Name=m.bestDef2?players.find(p=>p.id==m.bestDef2)?.name||'':null;
    const defBadges=(bdName?`<span class="match-mom">&#x1F6E1;&#xFE0F; &#xBCA0;&#xC218; ${bdName}</span>`:'')+(bd2Name?`<span class="match-mom">&#x1F6E1;&#xFE0F; &#xACF5;&#xD5CC; ${bd2Name}</span>`:'');
    // 수당 요약
    const wages=computeMatchWages(m);
    const wageRows=Object.entries(wages).map(([pid,w])=>{
      const p=players.find(pl=>pl.id==pid);if(!p||!w.total)return'';
      const tags=w.items.map(i=>`<span class="wage-tag">${i.label} +${i.amount}</span>`).join('');
      return `<div class="wage-row"><span class="wage-name">${p.name}</span><span class="wage-tags">${tags}</span><span class="wage-total">+${w.total}&#xC6D0;</span></div>`;
    }).filter(Boolean).join('');
    const wageTotal=Object.values(wages).reduce((s,w)=>s+w.total,0);
    const wageSection=wageRows?`<div class="match-wages" id="wages_${m.id}" style="display:none">${wageRows}</div>
      <button class="btn-wage-toggle" onclick="toggleWageSection(${m.id})">&#x1F4B0; &#xC218;&#xB2F9; &#xD655;&#xC778; (+${wageTotal}&#xC6D0;)</button>`:'';
    const ogHint=(m.oppOwnGoals||0)>0?`<span class="match-og-tag">상대 자책 ${m.oppOwnGoals}</span>`:'';
    return `<div class="match-card ${cardCls}">
      <div class="match-score-row">
        <span class="match-team" style="text-align:right">${getDisplayMyTeam(m)}</span>
        <span class="match-score">${m.scoreUs} : ${m.scoreOpp}</span>
        <span class="match-team">${m.oppTeam}</span>
      </div>
      <div class="match-meta">${formatDateDisplay(m.date)} · ${res}${ogHint}<span class="match-formation-badge">${m.formation}</span>${momBadge}${defBadges}</div>
      ${(m.lineup||[]).length?`<div class="match-lineup"><div class="match-lineup-title">&#xCD9C;&#xC804;</div><div class="match-lineup-tags">${lineupTags}${subTags}</div></div>`:''}
      ${scorerRows?`<div class="match-scorers">${scorerRows}</div>`:''}
      ${wageSection}
      ${isAdmin ? `<div class="match-card-btns">
        <button class="btn-match-edit" onclick="openMatchModal(${m.id})"><i class="ti ti-edit"></i> &#xC218;&#xC815;</button>
        <button class="btn-match-del" onclick="deleteMatch(${m.id})"><i class="ti ti-trash"></i></button>
      </div>` : ''}
    </div>`;
  }).join('');
}

function toggleWageSection(mid) {
  const el=document.getElementById('wages_'+mid);
  if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

// ── 통계 ──
function switchStatsSub(sub) {
  statsSubTab = sub;
  document.querySelectorAll('.stats-sub-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sub === sub);
  });
  const toolbar = document.getElementById('statsToolbar');
  if (toolbar) toolbar.style.display = sub === 'personal' ? 'flex' : 'none';
  renderStats();
}
function populateStatsYearFilter() {
  const sel = document.getElementById('statsYearFilter');
  if (!sel) return;
  const prev = sel.value;
  const years = getMatchYears(matches);
  sel.innerHTML = `<option value="ALL">전체 기간</option>${years.map(y => `<option value="${y}">${y}년</option>`).join('')}`;
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}
function refreshStatsIfVisible() {
  if (document.getElementById('tab-stats')?.classList.contains('active')) renderStats();
}
function formatStreakPeriod(s) {
  if (!s.count) return '기록 없음';
  const from = formatDateDisplay(s.from);
  const to = formatDateDisplay(s.to);
  if (from === to) return from;
  return `${from} ~ ${to}`;
}
function renderPersonalStats(filtered) {
  const sortKey = document.getElementById('statsSortKey')?.value || 'total';
  const base = computePlayerStats(filtered, players)
    .filter(s => s.attendance > 0 || s.goals > 0 || s.assists > 0 || s.mom > 0)
    .map(r => ({
      ...r,
      total: (r.goals||0) + (r.assists||0) + (r.attendance||0) + (r.mom||0),
      wage: computePlayerTotalWage(r.pid)
    }));
  const rows = [...base].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  if (!filtered.length) return '<div class="empty-state">경기 기록이 없습니다</div>';
  if (!rows.length) return '<div class="empty-state">출전·기록 데이터가 없습니다</div>';
  // 메달: 동점자는 같은 순위 공유
  const sortedVals = [...new Set(rows.map(r => r[sortKey]))].sort((a,b) => b-a);
  const v1 = sortedVals[0] ?? -1, v2 = sortedVals[1] ?? -1, v3 = sortedVals[2] ?? -1;
  const medal = val => {
    if (val <= 0) return '';
    if (val === v1) return '<span class="stat-medal stat-medal-1">1</span>';
    if (val === v2) return '<span class="stat-medal stat-medal-2">2</span>';
    if (val === v3) return '<span class="stat-medal stat-medal-3">3</span>';
    return '';
  };
  const top = rows[0];
  const totalGoals = rows.reduce((s, r) => s + r.goals, 0);
  const summary = `<div class="stats-summary">
    <div class="stats-card"><div class="stats-card-val">${filtered.length}</div><div class="stats-card-label">경기</div></div>
    <div class="stats-card"><div class="stats-card-val">${totalGoals}</div><div class="stats-card-label">팀 골</div></div>
    <div class="stats-card"><div class="stats-card-val">${top.goals}</div><div class="stats-card-label">득점 1위 ${top.name}</div></div>
  </div>`;
  const tableRows = rows.map(r => {
    const gCls = r.goals > 0 ? 'stat-click' : 'stat-click zero';
    const aCls = r.assists > 0 ? 'stat-click' : 'stat-click zero';
    const discCount = getDisciplinesForPlayer(r.pid).length;
    const hasValueHistory = r.wage > 0 || discCount > 0;
    const wageCls = hasValueHistory ? 'stat-click stat-wage' : 'stat-click zero';
    const wageDisplay = hasValueHistory
      ? `<span class="${wageCls}" onclick="openValueHistory(${r.pid})">${r.wage > 0 ? r.wage.toLocaleString() + '&#xC6D0;' : '0&#xC6D0;'}</span>`
      : '—';
    const discBtn = isAdmin ? `<button class="stats-discipline-btn" onclick="openDisciplineModal(${r.pid})" title="\uD328\uB110\uD2F0 \uB4F1\uB85D">\u26A0</button>` : '';
    const discBadge = discCount ? `<span class="discipline-count-badge">${discCount}</span>` : '';
    const discActions = (discBtn || discBadge) ? `<span class="stat-discipline-actions">${discBtn}${discBadge}</span>` : '';
    const discCol = discCount > 0 ? discCount : '\u2014';
    return `<tr>
      <td><span class="stat-rank-cell">${medal(r[sortKey])}<span class="stat-name">${r.name}</span></span>${r.jersey != null ? `<span class="stat-jersey">#${r.jersey}</span>` : ''}${discActions}</td>
      <td>${r.attendance}</td>
      <td><span class="${gCls}" onclick="openStatHistory(${r.pid},'goals')">${r.goals}</span></td>
      <td><span class="${aCls}" onclick="openStatHistory(${r.pid},'assists')">${r.assists}</span></td>
      <td>${r.mom || '\u2014'}</td>
      <td class="stat-discipline-col">${discCol}</td>
      <td>${wageDisplay}</td>
    </tr>`;
  }).join('');
  const disciplineSection = isAdmin ? renderDisciplineAdminList() : '';
  return summary + `<table class="stats-table">
    <thead><tr><th>&#xC120;&#xC218;</th><th>&#xCD9C;&#xC11D;</th><th>&#xACE8;</th><th>&#xC5B4;&#xC2DC;</th><th>MOM</th><th>&#xC9D5;&#xACC4;&#xC218;</th><th>&#x1F4B0; &#xC120;&#xC218; &#xAC00;&#xCE58;</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div style="font-size:10px;color:var(--text3)">&#xACE8;&#xB7;&#xC5B4;&#xC2DC; &#xC22B;&#xC790; &#xD074;&#xB9AD; &rarr; &#xACBD;&#xAE30;&#xBCC4; &#xD788;&#xC2A4;&#xD1A0;&#xB9AC; &middot; &#xAC00;&#xCE58; &#xD074;&#xB9AD; &rarr; &#xC218;&#xB2F9;/&#xC9D5;&#xACC4; &#xB0B4;&#xC5ED; &middot; &#xAC00;&#xCE58; = &#xC218;&#xB2F9; &#xD569; &minus; &#xC9D5;&#xACC4;</div>
  ${disciplineSection}`;
}
function renderTeamStats(filtered) {
  if (!filtered.length) {
    return '<div class="empty-state">경기 기록이 없습니다</div>';
  }
  const overall = computeTeamStats(filtered);
  const tableRows = `<tr>
    <td>전체</td>
    <td>${overall.played}</td>
    <td>${overall.w}</td>
    <td>${overall.d}</td>
    <td>${overall.l}</td>
    <td>${overall.gf}</td>
    <td>${overall.ga}</td>
    <td>${overall.winRate}%</td>
  </tr>`;
  const streaks = computeStreaks(filtered);
  const total = overall.w + overall.d + overall.l || 1;
  const wPct = Math.round(overall.w / total * 100);
  const dPct = Math.round(overall.d / total * 100);
  const lPct = 100 - wPct - dPct;
  const cards = `<div class="stats-summary">
    <div class="stats-card"><div class="stats-card-val">${overall.winRate}%</div><div class="stats-card-label">승률</div></div>
    <div class="stats-card"><div class="stats-card-val">${overall.gpg}</div><div class="stats-card-label">경기당 득점</div></div>
    <div class="stats-card"><div class="stats-card-val">${overall.cpg}</div><div class="stats-card-label">경기당 실점</div></div>
  </div>`;
  const bar = `<div class="wdl-bar">
    <div class="wdl-seg win" style="width:${wPct}%"></div>
    <div class="wdl-seg draw" style="width:${dPct}%"></div>
    <div class="wdl-seg lose" style="width:${lPct}%"></div>
  </div>
  <div class="wdl-legend">
    <span class="lg-win">승 ${overall.w}</span>
    <span class="lg-draw">무 ${overall.d}</span>
    <span class="lg-lose">패 ${overall.l}</span>
  </div>`;
  const table = `<div class="team-table-wrap"><table class="team-record-table">
    <thead><tr><th>구분</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득</th><th>실</th><th>승률</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>`;
  const streakHtml = `<div class="streak-cards">
    <div class="streak-card"><div class="streak-card-title">최다 연승</div><div class="streak-card-val">${streaks.win.count}경기</div><div class="streak-card-period">${formatStreakPeriod(streaks.win)}</div></div>
    <div class="streak-card"><div class="streak-card-title">최다 무패</div><div class="streak-card-val">${streaks.unbeaten.count}경기</div><div class="streak-card-period">${formatStreakPeriod(streaks.unbeaten)}</div></div>
    <div class="streak-card"><div class="streak-card-title">최다 연패</div><div class="streak-card-val">${streaks.lose.count}경기</div><div class="streak-card-period">${formatStreakPeriod(streaks.lose)}</div></div>
  </div>`;
  return cards + bar + table + streakHtml;
}
function renderStats() {
  populateStatsYearFilter();
  const year = document.getElementById('statsYearFilter')?.value || 'ALL';
  const filtered = filterMatchesByYear(matches, year);
  const el = document.getElementById('statsContent');
  if (!el) return;
  el.innerHTML = statsSubTab === 'team' ? renderTeamStats(filtered) : renderPersonalStats(filtered);
}
function openStatHistory(pid, type) {
  const p = players.find(x => x.id === pid);
  const year = document.getElementById('statsYearFilter')?.value || 'ALL';
  const filtered = filterMatchesByYear(matches, year);
  const history = getPlayerStatHistory(filtered, pid, type);
  if (!history.length) return;
  const label = type === 'goals' ? '골' : '어시스트';
  document.getElementById('statHistoryTitle').textContent = `${p?.name || ''} — ${label} 히스토리`;
  document.getElementById('statHistoryList').innerHTML = history.map(h =>
    `<div class="stat-history-row">
      <span class="stat-history-date">${formatDateDisplay(h.date)}</span>
      <span class="stat-history-score">${h.scoreUs}:${h.scoreOpp}</span>
      <span class="stat-history-opp">vs ${h.oppTeam || '상대'}</span>
      <span class="stat-history-count">${label} ${h.count}</span>
    </div>`
  ).join('');
  document.getElementById('statHistoryModal').classList.add('open');
}
function closeStatHistory() {
  document.getElementById('statHistoryModal').classList.remove('open');
}

function renderDisciplineAdminList() {
  const sorted = [...disciplines].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!sorted.length) return '';
  const rows = sorted.map(d => {
    const p = players.find(pl => pl.id == d.pid);
    const name = p ? (p.jersey != null ? '#' + p.jersey + ' ' : '') + p.name : '#' + d.pid;
    const settled = d.settlementGroupId ? '<span class="discipline-settled-tag">\uC815\uC0B0\uBC18\uC601</span>' : '';
    return `<div class="discipline-admin-row">
      <span class="discipline-admin-date">${formatDateDisplay(d.date)}</span>
      <span class="discipline-admin-name">${name}</span>
      <span class="discipline-admin-level">${disciplineLevelLabel(d.level)}</span>
      <span class="discipline-admin-amount">-${(d.amount || 0).toLocaleString()}\uC6D0</span>
      <span class="discipline-admin-reason">${disciplineReasonLabel(d.reason)}</span>
      ${settled}
      <button class="discipline-del-btn" onclick="deleteDiscipline(${d.id})">\uC0AD\uC81C</button>
    </div>`;
  }).join('');
  return `<div class="discipline-admin-section">
    <div class="discipline-admin-title">\uC9D5\uACC4 \uAE30\uB85D (\uAD00\uB9AC\uC790)</div>
    <div class="discipline-admin-list">${rows}</div>
  </div>`;
}

function openValueHistory(pid) {
  const p = players.find(x => x.id === pid);
  if (!p) return;
  const year = document.getElementById('statsYearFilter')?.value || 'ALL';
  const filtered = filterMatchesByYear(matches, year);
  const rows = [];
  filtered.forEach(m => {
    const w = computeMatchWages(m);
    const total = w[pid]?.total || 0;
    if (!total) return;
    const tags = (w[pid].items || []).map(i => i.label).join(' ');
    rows.push({ sortKey: m.date, date: m.date, type: 'wage', amount: total, detail: `vs ${m.oppTeam || '상대'} ${tags}` });
  });
  const yearDisc = disciplines.filter(d => {
    if (d.pid != pid) return false;
    if (year === 'ALL') return true;
    return (d.date || '').startsWith(year);
  });
  yearDisc.forEach(d => {
    rows.push({
      sortKey: d.date,
      date: d.date,
      type: 'discipline',
      amount: -(d.amount || 0),
      detail: `${disciplineLevelLabel(d.level)} \u00B7 ${disciplineReasonLabel(d.reason)}${d.note ? ' \u00B7 ' + d.note : ''}`,
    });
  });
  rows.sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''));
  const gross = rows.filter(r => r.type === 'wage').reduce((s, r) => s + r.amount, 0);
  const disc = rows.filter(r => r.type === 'discipline').reduce((s, r) => s + Math.abs(r.amount), 0);
  const net = Math.max(0, gross - disc);
  document.getElementById('statHistoryTitle').textContent = `${p.name} \u2014 \uC120\uC218 \uAC00\uCE58 \uB0B4\uC5ED`;
  if (!rows.length) {
    document.getElementById('statHistoryList').innerHTML = '<div class="stat-history-empty">\uB0B4\uC5ED \uC5C6\uC74C</div>';
  } else {
    document.getElementById('statHistoryList').innerHTML = rows.map(r =>
      `<div class="stat-history-row ${r.type === 'discipline' ? 'stat-history-discipline' : ''}">
        <span class="stat-history-date">${formatDateDisplay(r.date)}</span>
        <span class="stat-history-detail">${r.detail}</span>
        <span class="stat-history-count ${r.amount < 0 ? 'stat-history-minus' : ''}">${r.amount > 0 ? '+' : ''}${r.amount.toLocaleString()}\uC6D0</span>
      </div>`
    ).join('') + `<div class="value-history-total">\uD569\uACC4 <strong>${net.toLocaleString()}\uC6D0</strong> <span class="value-history-sub">(\uC218\uB2F9 ${gross.toLocaleString()} \u2212 \uC9D5\uACC4 ${disc.toLocaleString()})</span></div>`;
  }
  document.getElementById('statHistoryModal').classList.add('open');
}

function updateDisciplineFormHint() {
  const sel = document.getElementById('disciplinePlayer');
  const hint = document.getElementById('disciplineHint');
  const levelSel = document.getElementById('disciplineLevel');
  if (!sel || !hint) return;
  const pid = parseInt(sel.value, 10);
  if (!pid) { hint.textContent = ''; return; }
  const count = getConflictDisciplineCount(pid);
  const suggested = getSuggestedDisciplineLevel(pid);
  hint.textContent = `\uBD88\uD654\u00B7\uB9C8\uCC30 \uC774\uB825 ${count}\uAC74 \u2192 \uAD8C\uC7A5: ${suggested}\uCC28 (-${DISCIPLINE_AMOUNTS[suggested].toLocaleString()}\uC6D0)`;
  if (levelSel && !levelSel.dataset.userPicked) levelSel.value = String(suggested);
}
function openDisciplineModal(pid) {
  if (!isAdmin) return;
  const sel = document.getElementById('disciplinePlayer');
  const levelSel = document.getElementById('disciplineLevel');
  const dateInp = document.getElementById('disciplineDate');
  const reasonSel = document.getElementById('disciplineReason');
  const noteInp = document.getElementById('disciplineNote');
  if (!sel) return;
  const regular = players.filter(p => !p.isMercenary).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  sel.innerHTML = regular.map(p =>
    `<option value="${p.id}">${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name}</option>`
  ).join('');
  if (pid) sel.value = String(pid);
  if (levelSel) { levelSel.dataset.userPicked = ''; levelSel.value = '1'; }
  if (dateInp) dateInp.value = new Date().toISOString().slice(0, 10);
  if (reasonSel) reasonSel.value = 'internal';
  if (noteInp) noteInp.value = '';
  updateDisciplineFormHint();
  document.getElementById('disciplineModal')?.classList.add('open');
}
function closeDisciplineModal() {
  document.getElementById('disciplineModal')?.classList.remove('open');
}
function saveDiscipline() {
  if (!isAdmin) return;
  const pid = parseInt(document.getElementById('disciplinePlayer')?.value, 10);
  const level = parseInt(document.getElementById('disciplineLevel')?.value, 10);
  const date = normalizeDate(document.getElementById('disciplineDate')?.value);
  const reason = document.getElementById('disciplineReason')?.value || 'other';
  const note = (document.getElementById('disciplineNote')?.value || '').trim();
  if (!pid || !date || !level) { alert('\uC120\uC218, \uB0A0\uC9DC, \uAE08\uC561 \uBC0F \uD56D\uBAA9\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
  const amount = DISCIPLINE_AMOUNTS[level];
  if (amount == null) { alert('\uC720\uD6A8\uD558\uC9C0 \uC54A\uC740 \uD56D\uBAA9\uC785\uB2C8\uB2E4'); return; }
  const matchOnDate = matches.find(m => normalizeDate(m.date) === date);
  disciplines.push({
    id: Date.now(),
    pid,
    level,
    amount,
    date,
    matchId: matchOnDate?.id ?? null,
    reason,
    note,
    settlementGroupId: null,
    createdAt: new Date().toISOString(),
  });
  closeDisciplineModal();
  persistDisciplines().catch(handleSaveError);
  renderStats();
  renderRoster();
  refreshStatsIfVisible();
}
function deleteDiscipline(id) {
  if (!isAdmin) return;
  const d = disciplines.find(x => x.id == id);
  if (!d) return;
  let msg = '\uC774 \uC9D5\uACC4 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?';
  if (d.settlementGroupId) msg = '\uC774\uBBF8 \uB9AC\uC6CC\uB4DC \uC815\uC0B0\uC5D0 \uBC18\uC601\uB41C \uC9D5\uACC4\uC785\uB2C8\uB2E4. \uC0AD\uC81C\uD558\uBA74 \uC815\uC0B0 \uAE08\uC561\uACFC \uB2E4\uB984\uC9C0\uB9CC \uACC4\uC18D\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?';
  if (!confirm(msg)) return;
  disciplines = disciplines.filter(x => x.id != id);
  persistDisciplines().catch(handleSaveError);
  renderStats();
  renderRoster();
  if (isTreasurer) renderTreasurer();
}

function openTreasurerDisciplineDetail(pid, from, to) {
  const p = players.find(pl => pl.id == pid);
  const { disciplineItems } = computeUnsettledWageBreakdown(pid, from, to);
  if (!disciplineItems.length) return;
  document.getElementById('disciplineDetailTitle').textContent = `${p?.name || ''} \u2014 \uC9D5\uACC4 \uC0C1\uC138 (${formatDateDisplay(from)} ~ ${formatDateDisplay(to)})`;
  document.getElementById('disciplineDetailList').innerHTML = disciplineItems.map(d =>
    `<div class="discipline-detail-row">
      <span>${formatDateDisplay(d.date)}</span>
      <span>${disciplineLevelLabel(d.level)}</span>
      <span class="discipline-detail-minus">-${(d.amount || 0).toLocaleString()}\uC6D0</span>
      <span>${disciplineReasonLabel(d.reason)}</span>
      ${d.note ? `<span class="discipline-detail-note">${d.note}</span>` : ''}
    </div>`
  ).join('');
  document.getElementById('disciplineDetailModal')?.classList.add('open');
}
function closeDisciplineDetailModal() {
  document.getElementById('disciplineDetailModal')?.classList.remove('open');
}

// ── 탭 ──
function switchTab(tab){
  // 발표 모드 중 다른 탭 전환 시 자동 종료
  if (presentMode && tab !== 'formation') {
    presentMode = false;
    document.body.classList.remove('presentation-mode');
    const btn = document.getElementById('btnPresent');
    if (btn) { btn.classList.remove('active'); btn.textContent = '\uD83D\uDDA5\uFE0F \uBC1C\uD45C'; }
    const ft = document.getElementById('tab-formation');
    if (ft) ft.style.cssText = '';
  }
  const allTabs = ['home','roster','formation','records','stats','treasurer'];
  document.querySelectorAll('.tab-btn').forEach((btn, i) => {
    btn.classList.toggle('active', allTabs[i] === tab);
  });
  allTabs.forEach(t => {
    const el = document.getElementById('tab-'+t);
    if (el) el.classList.toggle('active', t === tab);
  });
  if(tab==='home')renderHome();
  if(tab==='formation'){
    slotHighlight=-1;
    fieldSize={w:0,h:0};
    renderFormationSaves();
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        drawFieldCanvas(-1);
        renderField();
      });
    });
  }
  if(tab==='records')renderRecords();
  if(tab==='stats'){switchStatsSub(statsSubTab);}
  if(tab==='treasurer')renderTreasurer();
}

// ── 30초 자동 갱신 ──
const POLL_INTERVAL = 30000;

function isAnyModalOpen() {
  // .modal-bg.open 또는 posPopup.open 여부 확인
  return !!(document.querySelector('.modal-bg.open') || document.getElementById('posPopup')?.classList.contains('open'));
}

function refreshCurrentTab() {
  const tabIds = ['home','roster','formation','records','stats','treasurer'];
  for (const t of tabIds) {
    if (!document.getElementById('tab-' + t)?.classList.contains('active')) continue;
    if (t === 'home') { renderHome(); }
    else if (t === 'roster') { renderRoster(); }
    else if (t === 'formation') {
      // 포메이션 탭은 캔버스 크기 유지하면서 토큰만 갱신
      renderField();
      renderBench();
      renderFormationSaves();
    }
    else if (t === 'records') { renderRecords(); }
    else if (t === 'stats') { switchStatsSub(statsSubTab); }
    else if (t === 'treasurer') { renderTreasurer(); }
    break;
  }
}

async function pollRefresh() {
  if (isAnyModalOpen() || drag.active) return;
  try {
    const data = await apiLoadAll(true);
    applyRemoteData(data);
    refreshCurrentTab();
    updateSyncBar('ok', '동기화됨');
  } catch(e) {
    // 폴링 실패는 조용히 무시 (사용자에게 alert 없음)
  }
}

function startPolling() {
  setInterval(pollRefresh, POLL_INTERVAL);
}

// ════════════════════════════════════════════════════════
// ── 총무 페이지 ──
// ════════════════════════════════════════════════════════

const DUE_TYPE_PAYMENT = 'payment'; // 유형: 회비 입금
const DUE_TYPE_OTHER   = 'other';   // 유형: 기타 입금

function dueTargetLabel(pid) {
  const p = players.find(pl => pl.id == pid);
  return p ? (p.jersey != null ? '#' + p.jersey + ' ' : '') + p.name : ('\uC120\uC218#' + pid);
}

function dueRecordLabel(d) {
  if (d.type === DUE_TYPE_OTHER || d.pid == 0) return '\uAE30\uD0C0';
  return dueTargetLabel(d.pid);
}

function settlementGroupLabel(items) {
  const active = items.filter(s => s.status === 'done');
  if (!active.length) return '-';
  if (active.length === 1) return '1\uBA85 \u00B7 ' + dueTargetLabel(active[0].pid);
  const names = active.slice(0, 3).map(s => {
    const p = players.find(pl => pl.id == s.pid);
    return p ? p.name : ('#' + s.pid);
  });
  const suffix = active.length > 3 ? ' \uC678 ' + (active.length - 3) + '\uBA85' : '';
  return active.length + '\uBA85 \u00B7 ' + names.join(', ') + suffix;
}

// 고아·취소·중복 정산 지출 정리 (구버전 취소 버그 잔여 데이터 포함)
function cleanupTreasurerData() {
  const beforeS = settlements.length;
  const beforeE = expenses.length;
  settlements = settlements.filter(s => s.status !== 'cancelled');
  expenses = expenses.filter(e => e.status !== 'cancelled');
  const isRewardExpense = e =>
    e.settlementId != null || e.category === '\uB9AC\uC6CC\uB4DC\uC815\uC0B0' || e.category === '\uB9AC\uC6CC\uB4DC \uC815\uC0B0';
  expenses = expenses.filter(e => {
    if (!isRewardExpense(e)) return true;
    if (e.settlementId == null) return false;
    return settlements.some(s => s.groupId == e.settlementId && s.status === 'done');
  });
  const seenGroup = new Set();
  expenses = expenses.filter(e => {
    if (e.settlementId == null) return true;
    const k = String(e.settlementId);
    if (seenGroup.has(k)) return false;
    seenGroup.add(k);
    return true;
  });
  return beforeS !== settlements.length || beforeE !== expenses.length;
}

// persist 함수
async function persistDues()        { await apiSavePartial({ dues });        localStorage.setItem('fc_dues',        JSON.stringify(dues));        }

function nextDueId() {
  const max = dues.reduce((m, d) => Math.max(m, Math.floor(Number(d.id)) || 0), 0);
  return max + 1;
}
async function persistExpenses()    { await apiSavePartial({ expenses });    localStorage.setItem('fc_expenses',    JSON.stringify(expenses));    }
async function persistSettlements() { await apiSavePartial({ settlements }); localStorage.setItem('fc_settlements', JSON.stringify(settlements)); }
async function persistDisciplines() { await apiSavePartial({ disciplines }); localStorage.setItem('fc_disciplines', JSON.stringify(disciplines)); }

// 미정산 리워드 (경기 수당 − 미반영 징계, 최소 0)
function computeUnsettledWage(pid, from, to) {
  return computeUnsettledWageBreakdown(pid, from, to).net;
}

// 대시보드 숫자 포맷
function fmtMoney(n) { return (n||0).toLocaleString() + '\uC6D0'; }

function getTrYearMonth() {
  return trFilterYearMonth || currentYearMonth();
}
function setTrMonthFilter(ym) {
  trFilterYearMonth = ym || currentYearMonth();
  renderTreasurer();
}
function isGkOnlyPlayer(p) {
  return !!(p.positions && p.positions.length === 1 && p.positions[0] === 'GK');
}
function isPlayerExempt(pid, ym) {
  const p = players.find(pl => pl.id == pid);
  if (p && isGkOnlyPlayer(p)) return true;
  return dueExemptions.some(ex => ex.pid == pid && ym >= ex.fromMonth && ym <= ex.toMonth);
}
function getPaymentStatus(pid, ym) {
  if (isPlayerExempt(pid, ym)) return 'exempt';
  const paid = dues.some(d => d.pid == pid && d.type === DUE_TYPE_PAYMENT && yearMonthFromDate(d.date) === ym);
  return paid ? 'paid' : 'unpaid';
}
function getDueMemo(pid, ym) {
  const month = normalizeYearMonth(ym);
  return dueMemos.find(m => m.pid == pid && normalizeYearMonth(m.yearMonth) === month);
}
function paymentStatusLabel(st) {
  if (st === 'paid') return '\uB0A9\uBD80';
  if (st === 'exempt') return '\uBA74\uC81C';
  return '\uBBF8\uB0A9';
}
function filterDuesByMonth(list, ym) {
  return list.filter(d => yearMonthFromDate(d.date) === ym);
}
function filterExpensesByMonth(list, ym) {
  return list.filter(e => yearMonthFromDate(e.date) === ym);
}

async function persistDueExemptions() {
  await apiSavePartial({ dueExemptions });
  localStorage.setItem('fc_due_exemptions', JSON.stringify(dueExemptions));
}
async function persistDueMemos() {
  await apiSavePartial({ dueMemos });
  localStorage.setItem('fc_due_memos', JSON.stringify(dueMemos));
}

function editDueMemo(pid) {
  const ym = getTrYearMonth();
  const existing = getDueMemo(pid, ym);
  const p = players.find(pl => pl.id == pid);
  const name = p ? p.name : ('#' + pid);
  const note = prompt(`${formatYearMonthDisplay(ym)} ${name} \uBA54\uBAA8`, existing?.note || '');
  if (note === null) return;
  const trimmed = note.trim();
  const month = normalizeYearMonth(ym);
  const idx = dueMemos.findIndex(m => m.pid == pid && normalizeYearMonth(m.yearMonth) === month);
  if (!trimmed) {
    if (idx >= 0) dueMemos.splice(idx, 1);
  } else if (idx >= 0) {
    dueMemos[idx].note = trimmed;
    dueMemos[idx].yearMonth = month;
  } else {
    dueMemos.push({ id: Date.now(), pid, yearMonth: month, note: trimmed });
  }
  persistDueMemos().catch(handleSaveError);
  renderTreasurer();
}

// ── 총무 탭 전체 렌더 ──
function renderTreasurer() {
  const wrap = document.getElementById('tab-treasurer');
  if (!wrap) return;
  const prevPage = wrap.querySelector('.tr-page');
  const savedScrollTop = prevPage ? prevPage.scrollTop : 0;

  const ym = getTrYearMonth();
  const monthDues = filterDuesByMonth(dues.filter(d => d.type !== 'refund'), ym);
  const monthExpenses = filterExpensesByMonth(expenses.filter(e => e.status !== 'cancelled'), ym);

  const totalIncome   = monthDues.reduce((s, d) => s + (d.amount || 0), 0);
  const totalExpense  = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const allIncome     = dues.filter(d => d.type !== 'refund').reduce((s, d) => s + (d.amount || 0), 0);
  const allExpense    = expenses.filter(e => e.status !== 'cancelled').reduce((s, e) => s + (e.amount || 0), 0);
  const balance       = allIncome - allExpense;
  const budgetLow     = Math.round(balance * 0.2);
  const budgetHigh    = Math.round(balance * 0.3);

  const duesByPid = {};
  monthDues.forEach(d => {
    if (d.type !== DUE_TYPE_PAYMENT || !d.pid) return;
    if (!duesByPid[d.pid]) duesByPid[d.pid] = { count: 0, total: 0 };
    duesByPid[d.pid].count++;
    duesByPid[d.pid].total += (d.amount || 0);
  });

  const regularPlayers = players.filter(p => !p.isMercenary);

  wrap.innerHTML = `
<div class="tr-page">

  <div class="tr-month-filter">
    <label>\uAE30\uC900 \uB144\uC6D4</label>
    <input type="month" id="trMonthFilter" value="${ym}" onchange="setTrMonthFilter(this.value)">
    <button class="tr-btn-sm" onclick="exportTreasurerReceipt()">\uC601\uC218\uC99D</button>
    <button class="tr-btn-sm" onclick="openBulkDuesModal()">\uC77C\uAD04 \uC785\uAE08</button>
    <button class="tr-btn-sm" onclick="openExemptionModal()">\uBA74\uC81C \uAD00\uB9AC</button>
  </div>

  <!-- ① 요약 대시보드 -->
  <div class="tr-section">
    <div class="tr-section-title">\uD83D\uDCCA \uC694\uC57D \uB300\uC2DC\uBCF4\uB4DC</div>
    <div class="tr-cards tr-cards-vertical">
      <div class="tr-card"><div class="tr-card-label">${formatYearMonthDisplay(ym)} \uC218\uC785</div><div class="tr-card-value income">${fmtMoney(totalIncome)}</div></div>
      <div class="tr-card"><div class="tr-card-label">${formatYearMonthDisplay(ym)} \uC9C0\uCD9C</div><div class="tr-card-value expense">${fmtMoney(totalExpense)}</div></div>
      <div class="tr-card"><div class="tr-card-label">\uD604\uC7AC \uC794\uC561</div><div class="tr-card-value balance">${fmtMoney(balance)}</div></div>
      <div class="tr-card"><div class="tr-card-label">\uC5F0\uB9D0 \uACB0\uC0B0 \uAC00\uB2A5 \uC608\uC0B0</div><div class="tr-card-value budget">${fmtMoney(budgetLow)} ~ ${fmtMoney(budgetHigh)}</div></div>
    </div>
  </div>

  <!-- ② 회비 현황 -->
  <div class="tr-section">
    <div class="tr-section-header">
      <div class="tr-section-title">\uD83D\uDCB4 \uD68C\uBE44 \uD604\uD669</div>
      <button class="tr-btn-add" onclick="openDuesModal()">\uFF0B \uD68C\uBE44 \uC785\uAE08</button>
    </div>
    <div class="tr-table-wrap">
      <table class="tr-table">
        <thead><tr><th>\uC120\uC218</th><th>\uC0C1\uD0DC</th><th>\uD569\uACC4</th><th>\uBA54\uBAA8</th></tr></thead>
        <tbody>
          ${regularPlayers.sort((a,b)=>(a.jersey??99)-(b.jersey??99)).map(p => {
            const d = duesByPid[p.id] || {count:0,total:0};
            const st = getPaymentStatus(p.id, ym);
            const memo = getDueMemo(p.id, ym);
            const rowCls = st === 'paid' ? 'tr-status-paid' : st === 'exempt' ? 'tr-status-exempt' : 'tr-status-unpaid';
            return `<tr class="${rowCls}">
              <td>${p.jersey!=null?'#'+p.jersey+' ':''}${p.name}</td>
              <td>${paymentStatusLabel(st)}</td>
              <td>${fmtMoney(d.total)}</td>
              <td class="tr-memo-cell">${memo ? `<span class="tr-memo-flag" title="${memo.note.replace(/"/g,'&quot;')}" onclick="editDueMemo(${p.id})">\u25E4</span> ${memo.note}` : `<button class="tr-btn-sm" onclick="editDueMemo(${p.id})">+</button>`}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="tr-subsection-header">
      <div class="tr-subsection-title">\uC804\uCCB4 \uC785\uAE08 \uAE30\uB85D</div>
      <button class="tr-btn-sm danger" onclick="deleteSelectedDues()">\uC120\uD0DD \uC0AD\uC81C</button>
    </div>
    <div class="tr-scroll-box" id="trDuesList">
      ${renderDuesList(ym)}
    </div>
  </div>

  <!-- ③ 지출 기록 -->
  <div class="tr-section">
    <div class="tr-section-header">
      <div class="tr-section-title">\uD83D\uDCB8 \uC9C0\uCD9C \uAE30\uB85D</div>
      <button class="tr-btn-add" onclick="openExpenseModal()">\uFF0B \uC9C0\uCD9C \uB4F1\uB85D</button>
    </div>
    <div class="tr-table-wrap tr-expense-scroll">
      <table class="tr-table">
        <thead><tr><th>\uB0A0\uC9DC</th><th>\uC0AC\uC6A9\uCC98</th><th>\uAE08\uC561</th><th>\uBA54\uBAA8</th><th>\uC720\uD615</th><th></th></tr></thead>
        <tbody>
          ${monthExpenses.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(ex => {
            const isSettle = !!ex.settlementId;
            const catLabel = isSettle ? '\uB9AC\uC6CC\uB4DC \uC815\uC0B0' : (ex.category || '');
            const typeLabel = isSettle ? '\uB9AC\uC6CC\uB4DC \uC815\uC0B0' : '\uC9C0\uCD9C';
            return `<tr>
              <td class="tr-nowrap">${formatDateDisplay(ex.date)}</td>
              <td class="tr-nowrap">${catLabel}</td>
              <td class="tr-nowrap">${fmtMoney(ex.amount)}</td>
              <td class="tr-memo-cell">${ex.note || '-'}</td>
              <td><span class="tr-status-badge tr-nowrap ${isSettle?'settled':''}">${typeLabel}</span></td>
              <td>${isSettle?'':`<button class="tr-btn-sm" onclick="deleteExpense('${ex.id}')">\uC0AD\uC81C</button>`}</td>
            </tr>`;
          }).join('') || '<tr><td colspan="6" class="tr-empty">\uC9C0\uCD9C \uAE30\uB85D \uC5C6\uC74C</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>

  <!-- ④ 리워드 정산 -->
  <div class="tr-section">
    <div class="tr-section-title">\uD83C\uDFC6 \uB9AC\uC6CC\uB4DC \uC815\uC0B0</div>
    <div class="tr-settlement-form">
      <div class="tr-date-row">
        <label>\uC815\uC0B0 \uAE30\uAC04</label>
        <input type="date" id="trSettleFrom" class="tr-date-input">
        <span>~</span>
        <input type="date" id="trSettleTo" class="tr-date-input">
        <button class="tr-btn-primary" onclick="previewSettlement()">\uBBF8\uC815\uC0B0 \uC870\uD68C</button>
      </div>
    </div>
    <div id="trSettlementPreview"></div>
    <div class="tr-subsection-title">\uC815\uC0B0 \uAE30\uB85D</div>
    <div class="tr-scroll-box tr-settlement-history">
      <div class="tr-table-wrap">
        <table class="tr-table">
          <thead><tr><th>\uAE30\uAC04</th><th>\uB300\uC0C1</th><th>\uCD1D\uC561</th><th>\uC2E4\uD589\uC77C</th><th></th></tr></thead>
          <tbody>
            ${renderSettlementRows()}
          </tbody>
        </table>
      </div>
    </div>
  </div>

</div>`;

  // 날짜 기본값
  const today = new Date().toISOString().slice(0,10);
  const jan1  = today.slice(0,4)+'-01-01';
  const fromEl = document.getElementById('trSettleFrom');
  const toEl   = document.getElementById('trSettleTo');
  if (fromEl && !fromEl.value) fromEl.value = jan1;
  if (toEl   && !toEl.value)   toEl.value   = today;

  const page = wrap.querySelector('.tr-page');
  if (page && savedScrollTop > 0) {
    page.scrollTop = savedScrollTop;
    requestAnimationFrame(() => { page.scrollTop = savedScrollTop; });
  }
}

function renderDuesList(ym) {
  const rows = filterDuesByMonth(dues, ym || getTrYearMonth()).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!rows.length) return '<div class="tr-empty">\uC785\uAE08 \uAE30\uB85D \uC5C6\uC74C</div>';
  return `<div class="tr-table-wrap">
    <table class="tr-table">
      <thead><tr>
        <th class="tr-check-col"><input type="checkbox" title="\uC804\uCCB4 \uC120\uD0DD" onchange="toggleDuesSelectAll(this.checked)"></th>
        <th>\uB0A0\uC9DC</th><th>\uB300\uC0C1</th><th>\uAE08\uC561</th><th>\uBA54\uBAA8</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.map(d => `<tr>
          <td class="tr-check-col"><input type="checkbox" class="dues-row-cb" value="${d.id}"></td>
          <td>${formatDateDisplay(d.date)}</td>
          <td>${dueRecordLabel(d)}</td>
          <td>${fmtMoney(d.amount)}</td>
          <td class="tr-memo-cell">${d.note || '-'}</td>
          <td><button class="tr-btn-sm" onclick="deleteDue('${d.id}')">\uC0AD\uC81C</button></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>`;
}

function toggleDuesSelectAll(checked) {
  document.querySelectorAll('.dues-row-cb').forEach(cb => { cb.checked = checked; });
}

function deleteSelectedDues() {
  const ids = [...document.querySelectorAll('.dues-row-cb:checked')].map(cb => cb.value);
  if (!ids.length) { alert('\uC0AD\uC81C\uD560 \uC785\uAE08 \uAE30\uB85D\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694'); return; }
  if (!confirm(`\uC120\uD0DD\uD55C ${ids.length}\uAC74\uC758 \uC785\uAE08 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) return;
  const idSet = new Set(ids.map(String));
  dues = dues.filter(d => !idSet.has(String(d.id)));
  persistDues().catch(handleSaveError);
  renderTreasurer();
}

function renderSettlementRows() {
  const activeSettlements = settlements.filter(s => s.status === 'done');
  if (!activeSettlements.length) return '<tr><td colspan="5" class="tr-empty">\uC815\uC0B0 \uAE30\uB85D \uC5C6\uC74C</td></tr>';
  const groups = {};
  activeSettlements.forEach(s => {
    const key = s.groupId ? String(s.groupId) : (s.startDate + '~' + s.endDate + '|' + s.settledAt);
    if (!groups[key]) groups[key] = { startDate: s.startDate, endDate: s.endDate, settledAt: s.settledAt, groupId: s.groupId, items: [] };
    groups[key].items.push(s);
  });
  return Object.entries(groups).sort((a, b) => (b[1].settledAt || '').localeCompare(a[1].settledAt || '')).map(([key, g]) => {
    const total = g.items.reduce((sum, s) => sum + (s.settledAmount || 0), 0);
    const cancelArg = g.groupId ? String(g.groupId) : key;
    return `<tr>
      <td>${formatDateDisplay(g.startDate)} ~ ${formatDateDisplay(g.endDate)}</td>
      <td>${settlementGroupLabel(g.items)}</td>
      <td>${fmtMoney(total)}</td>
      <td>${formatDateDisplay(g.settledAt)}</td>
      <td><button class="tr-btn-sm danger" onclick="cancelSettlement('${cancelArg}')">\uCDE8\uC18C</button></td>
    </tr>`;
  }).join('');
}

// ── 회비 모달 ──
let editingDueId = null;

function updateDueFormMode() {
  const type = document.getElementById('dueType')?.value || DUE_TYPE_PAYMENT;
  const isOther = type === DUE_TYPE_OTHER;
  const playerWrap = document.getElementById('duePlayerField');
  const memoLabel = document.getElementById('dueNoteLabel');
  const memoInput = document.getElementById('dueNote');
  if (playerWrap) playerWrap.style.display = isOther ? 'none' : '';
  if (memoLabel) memoLabel.textContent = isOther ? '\uBA54\uBAA8 (\uD544\uC218)' : '\uBA54\uBAA8 (\uC120\uD0DD)';
  if (memoInput) memoInput.placeholder = isOther
    ? '\uC608: \uD6C4\uC6D0\uAE08, \uC774\uC804 \uD68C\uBE44 \uC794\uC561 (\uC99D\uBE59 \uB0B4\uC6A9)'
    : '\uC608: 3\uC6D4 \uD68C\uBE44';
}

function openDuesModal(id) {
  editingDueId = id || null;
  const d = id ? dues.find(x => x.id == id) : null;
  const today = new Date().toISOString().slice(0, 10);
  const dueType = d?.type === DUE_TYPE_OTHER || d?.pid == 0 ? DUE_TYPE_OTHER : DUE_TYPE_PAYMENT;
  document.getElementById('dueModalTitle').textContent = d ? '\uC785\uAE08 \uC218\uC815' : '\uC785\uAE08 \uB4F1\uB85D';
  document.getElementById('dueType').value   = dueType;
  document.getElementById('dueAmount').value = d?.amount || '';
  document.getElementById('dueDate').value   = normalizeDate(d?.date) || today;
  document.getElementById('dueNote').value   = d?.note   || '';

  const sel = document.getElementById('duePid');
  const selectedPid = d?.pid != null ? String(d.pid) : '';
  sel.innerHTML =
    '<option value="">\uC120\uC218 \uC120\uD0DD</option>' +
    players.filter(p => !p.isMercenary).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99))
      .map(p => `<option value="${p.id}" ${selectedPid === String(p.id) ? 'selected' : ''}>${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name}</option>`).join('');
  if (dueType !== DUE_TYPE_OTHER && selectedPid) sel.value = selectedPid;

  updateDueFormMode();
  document.getElementById('duesModal').classList.add('open');
}
function closeDuesModal() { document.getElementById('duesModal').classList.remove('open'); }
function saveDue() {
  const type   = document.getElementById('dueType').value;
  const amount = parseInt(document.getElementById('dueAmount').value, 10);
  const date   = normalizeDate(document.getElementById('dueDate').value);
  const note   = document.getElementById('dueNote').value.trim();
  let pid = null;

  if (type === DUE_TYPE_PAYMENT) {
    const pidRaw = document.getElementById('duePid').value;
    if (pidRaw === '') { alert('\uC120\uC218\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694'); return; }
    pid = parseInt(pidRaw, 10);
    if (!amount || !date) { alert('\uC120\uC218 \u00B7 \uAE08\uC561 \u00B7 \uB0A0\uC9DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4'); return; }
  } else {
    if (!amount || !date || !note) { alert('\uAE08\uC561 \u00B7 \uB0A0\uC9DC \u00B7 \uBA54\uBAA8(\uC99D\uBE59)\uB294 \uD544\uC218\uC785\uB2C8\uB2E4'); return; }
  }

  const record = { pid, amount, date, note, type };
  if (editingDueId) {
    const idx = dues.findIndex(x => x.id == editingDueId);
    if (idx >= 0) dues[idx] = { ...dues[idx], ...record };
  } else {
    dues.push({ id: Date.now(), ...record });
  }
  closeDuesModal();
  persistDues().catch(handleSaveError);
  renderTreasurer();
}
function deleteDue(id) {
  if (!confirm('\uC774 \uC785\uAE08 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
  dues = dues.filter(d=>d.id!=id);
  persistDues().catch(handleSaveError);
  renderTreasurer();
}

// ── 지출 모달 ──
let editingExpenseId = null;
function openExpenseModal(id) {
  editingExpenseId = id || null;
  const ex = id ? expenses.find(x=>x.id==id) : null;
  const today = new Date().toISOString().slice(0,10);
  document.getElementById('expenseModalTitle').textContent = ex ? '\uC9C0\uCD9C \uC218\uC815' : '\uC9C0\uCD9C \uB4F1\uB85D';
  document.getElementById('expenseDate').value     = normalizeDate(ex?.date) || today;
  document.getElementById('expenseAmount').value   = ex?.amount   || '';
  document.getElementById('expenseCategory').value = ex?.category || '';
  document.getElementById('expenseNote').value     = ex?.note     || '';
  document.getElementById('expenseModal').classList.add('open');
}
function closeExpenseModal() { document.getElementById('expenseModal').classList.remove('open'); }
function saveExpense() {
  const date     = normalizeDate(document.getElementById('expenseDate').value);
  const amount   = parseInt(document.getElementById('expenseAmount').value);
  const category = document.getElementById('expenseCategory').value.trim();
  const note     = document.getElementById('expenseNote').value.trim();
  if (!date || !amount || !category || !note) { alert('\uB0A0\uC9DC \u00B7 \uAE08\uC561 \u00B7 \uC0AC\uC6A9\uCC98 \u00B7 \uBA54\uBAA8(\uC99D\uBE59)\uB294 \uD544\uC218\uC785\uB2C8\uB2E4'); return; }
  if (editingExpenseId) {
    const idx = expenses.findIndex(x=>x.id==editingExpenseId);
    if (idx>=0) expenses[idx] = {...expenses[idx], date, amount, category, note};
  } else {
    expenses.push({ id: Date.now(), date, amount, category, note, status:'active' });
  }
  closeExpenseModal();
  persistExpenses().catch(handleSaveError);
  renderTreasurer();
}
function deleteExpense(id) {
  if (!confirm('\uC774 \uC9C0\uCD9C \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
  expenses = expenses.filter(e=>e.id!=id);
  persistExpenses().catch(handleSaveError);
  renderTreasurer();
}

// ── 리워드 정산 ──
function previewSettlement() {
  const from = document.getElementById('trSettleFrom')?.value;
  const to   = document.getElementById('trSettleTo')?.value;
  if (!from || !to) { alert('\uC815\uC0B0 \uAE30\uAC04\uC744 \uC120\uD0DD\uD574\uC8FC\uC138\uC694'); return; }
  const regularPlayers = players.filter(p => !p.isMercenary);

  const rows = regularPlayers.map(p => {
    const b = computeUnsettledWageBreakdown(p.id, from, to);
    return { p, ...b };
  }).filter(r => r.gross > 0 || r.discipline > 0);

  const preview = document.getElementById('trSettlementPreview');
  if (!preview) return;

  if (!rows.length) {
    preview.innerHTML = '<div class="tr-empty">\uBBF8\uC815\uC0B0 \uB9AC\uC6CC\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
    return;
  }

  const totalAmt = rows.reduce((s, r) => s + r.net, 0);
  const canSettleAny = rows.some(r => r.net > 0 && !settlements.find(s => s.pid == r.p.id && s.startDate === from && s.endDate === to && s.status === 'done'));
  preview.innerHTML = `
    <div class="tr-settlement-preview">
      <div class="tr-preview-header">
        <span>\uBBF8\uC815\uC0B0 \uB9AC\uC6CC\uB4DC \u2014 <strong>${formatDateDisplay(from)} ~ ${formatDateDisplay(to)}</strong> \u00B7 \uC2E4\uC9C0\uAE09 \uCD1D <strong>${fmtMoney(totalAmt)}</strong></span>
        ${canSettleAny ? `<button class="tr-btn-primary" onclick="executeSettlement('${from}','${to}')">\uC804\uCCB4 \uC815\uC0B0 \uC2E4\uD589</button>` : '<span class="tr-warn-badge">\uC774 \uAE30\uAC04 \uC774\uBBF8 \uC815\uC0B0\uB428</span>'}
      </div>
      <table class="tr-table tr-settlement-detail-table">
        <thead><tr><th>\uC120\uC218</th><th>\uACBD\uAE30 \uC218\uB2F9</th><th>\uC9D5\uACC4 \uCC28\uAC10</th><th>\uC2E4\uC9C0\uAE09</th><th>\uC0C1\uD0DC</th><th></th></tr></thead>
        <tbody>
          ${rows.map(r => {
            const existing = settlements.find(s => s.pid == r.p.id && s.startDate === from && s.endDate === to && s.status === 'done');
            const discCell = r.discipline > 0
              ? `<button type="button" class="tr-discipline-link" onclick="openTreasurerDisciplineDetail(${r.p.id},'${from}','${to}')">-${r.discipline.toLocaleString()}\uC6D0 \u24D8</button>`
              : '\u2014';
            return `<tr>
              <td>${r.p.jersey != null ? '#' + r.p.jersey + ' ' : ''}${r.p.name}</td>
              <td>${fmtMoney(r.gross)}</td>
              <td class="tr-discipline-cell">${discCell}</td>
              <td><strong>${fmtMoney(r.net)}</strong></td>
              <td>${existing ? '<span class="tr-status-badge settled">\uC815\uC0B0\uC644\uB8CC</span>' : '<span class="tr-status-badge">\uBBF8\uC815\uC0B0</span>'}</td>
              <td>${existing || r.net <= 0 ? '' : `<button class="tr-btn-sm" onclick="executeSingleSettlement(${r.p.id},'${from}','${to}')">\uC815\uC0B0</button>`}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function runSettlementBatch(from, to, pids) {
  const today = new Date().toISOString().slice(0, 10);
  const settlementGroupId = Date.now();
  const settledItems = [];
  const disciplineNotes = [];
  let linkedDisciplineOnly = false;
  pids.forEach(pid => {
    const breakdown = computeUnsettledWageBreakdown(pid, from, to);
    const { gross, discipline, net } = breakdown;
    if (gross <= 0 && discipline <= 0) return;
    const already = settlements.find(s => s.pid == pid && s.startDate === from && s.endDate === to && s.status === 'done');
    if (already) return;
    if (discipline > 0) {
      linkDisciplinesToSettlement(pid, from, to, settlementGroupId);
      linkedDisciplineOnly = true;
    }
    if (net <= 0) return;
    const p = players.find(pl => pl.id == pid);
    if (discipline > 0) {
      disciplineNotes.push(`${p?.name || pid}: \uC9D5\uACC4 -${discipline.toLocaleString()}\uC6D0 \u2192 \uC2E4\uC9C0\uAE09 ${net.toLocaleString()}\uC6D0`);
    }
    settledItems.push({
      id: Date.now() + Math.random(),
      groupId: settlementGroupId,
      startDate: from,
      endDate: to,
      pid,
      settledAmount: net,
      settledAt: today,
      status: 'done',
    });
  });
  if (!settledItems.length) {
    return linkedDisciplineOnly ? { count: 0, total: 0, disciplineOnly: true } : null;
  }
  const total = settledItems.reduce((s, x) => s + (x.settledAmount || 0), 0);
  const names = settledItems.map(s => {
    const p = players.find(pl => pl.id == s.pid);
    return p ? p.name : ('#' + s.pid);
  }).join(', ');
  let note = `\uB9AC\uC6CC\uB4DC \uC815\uC0B0 ${formatDateDisplay(from)}~${formatDateDisplay(to)} / ${settledItems.length}\uBA85(${names}) / \uCD1D ${fmtMoney(total)}`;
  if (disciplineNotes.length) note += ' / ' + disciplineNotes.join(' ');
  const newExpense = {
    id: Date.now() + 1,
    date: today,
    amount: total,
    category: '\uB9AC\uC6CC\uB4DC \uC815\uC0B0',
    note,
    status: 'active',
    settlementId: settlementGroupId,
  };
  settlements.push(...settledItems);
  expenses.push(newExpense);
  return { count: settledItems.length, total, disciplineOnly: false };
}

function executeSettlement(from, to) {
  const regularPlayers = players.filter(p => !p.isMercenary);
  const result = runSettlementBatch(from, to, regularPlayers.map(p => p.id));
  if (!result) { alert('\uC815\uC0B0\uD560 \uB9AC\uC6CC\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'); return; }
  if (result.disciplineOnly) {
    persistDisciplines().catch(handleSaveError);
    alert('\uC9D5\uACC4\uB9CC \uBC18\uC601\uB418\uC5C8\uC2B5\uB2C8\uB2E4 (\uC9C0\uAE09 \uB9AC\uC6CC\uB4DC \uC5C6\uC74C)');
    renderTreasurer();
    return;
  }
  Promise.all([persistSettlements(), persistExpenses(), persistDisciplines()]).catch(handleSaveError);
  alert(`\uC815\uC0B0 \uC644\uB8CC! ${result.count}\uBA85, \uCD1D ${fmtMoney(result.total)}`);
  renderTreasurer();
}

function executeSingleSettlement(pid, from, to) {
  const result = runSettlementBatch(from, to, [pid]);
  if (!result) { alert('\uC815\uC0B0\uD560 \uB9AC\uC6CC\uB4DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'); return; }
  if (result.disciplineOnly) {
    persistDisciplines().catch(handleSaveError);
    alert('\uC9D5\uACC4\uB9CC \uBC18\uC601\uB418\uC5C8\uC2B5\uB2C8\uB2E4 (\uC9C0\uAE09 \uB9AC\uC6CC\uB4DC \uC5C6\uC74C)');
    renderTreasurer();
    return;
  }
  Promise.all([persistSettlements(), persistExpenses(), persistDisciplines()]).catch(handleSaveError);
  alert(`\uC815\uC0B0 \uC644\uB8CC! ${dueTargetLabel(pid)}, ${fmtMoney(result.total)}`);
  renderTreasurer();
}

// ── 일괄 입금 ──
function openBulkDuesModal() {
  const ym = getTrYearMonth();
  const list = document.getElementById('bulkDuesList');
  if (!list) return;
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('bulkDueDate').value = today;
  document.getElementById('bulkDueAmount').value = document.getElementById('bulkDueAmount').value || '50000';
  const unpaid = players.filter(p => !p.isMercenary && getPaymentStatus(p.id, ym) === 'unpaid')
    .sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99));
  list.innerHTML = unpaid.length
    ? unpaid.map(p => `<label class="bulk-due-row"><input type="checkbox" class="bulk-due-cb" value="${p.id}" checked> ${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name}</label>`).join('')
    : '<div class="tr-empty">\uBBF8\uB0A9 \uC120\uC218\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
  document.getElementById('bulkDuesModal').classList.add('open');
}
function closeBulkDuesModal() {
  document.getElementById('bulkDuesModal')?.classList.remove('open');
}
function toggleBulkDuesAll(checked) {
  document.querySelectorAll('.bulk-due-cb').forEach(cb => { cb.checked = checked; });
}
function saveBulkDues() {
  const amount = parseInt(document.getElementById('bulkDueAmount').value, 10);
  const date = normalizeDate(document.getElementById('bulkDueDate').value);
  const pids = [...document.querySelectorAll('.bulk-due-cb:checked')].map(cb => parseInt(cb.value, 10));
  if (!amount || !date) { alert('\uAE08\uC561\u00B7\uB0A0\uC9DC\uB294 \uD544\uC218\uC785\uB2C8\uB2E4'); return; }
  if (!pids.length) { alert('\uC120\uC218\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694'); return; }
  const ym = getTrYearMonth();
  const note = `${formatYearMonthDisplay(ym)} \uD68C\uBE44`;
  pids.forEach(pid => {
    dues.push({ id: nextDueId(), pid, amount, date, note, type: DUE_TYPE_PAYMENT });
  });
  closeBulkDuesModal();
  persistDues().catch(handleSaveError);
  renderTreasurer();
}

// ── 면제 관리 ──
function openExemptionModal() {
  renderExemptionList();
  document.getElementById('exemptionModal').classList.add('open');
}
function closeExemptionModal() {
  document.getElementById('exemptionModal')?.classList.remove('open');
}
function renderExemptionList() {
  const el = document.getElementById('exemptionList');
  if (!el) return;
  const rows = dueExemptions.slice().sort((a, b) => (b.fromMonth || '').localeCompare(a.fromMonth || ''));
  el.innerHTML = rows.length ? rows.map(ex => {
    const p = players.find(pl => pl.id == ex.pid);
    const name = p ? (p.jersey != null ? '#' + p.jersey + ' ' : '') + p.name : ('#' + ex.pid);
    return `<div class="exemption-row">
      <span>${name} · ${formatYearMonthDisplay(ex.fromMonth)} ~ ${formatYearMonthDisplay(ex.toMonth)}</span>
      <button class="tr-btn-sm danger" onclick="deleteExemption(${ex.id})">\uC0AD\uC81C</button>
    </div>`;
  }).join('') : '<div class="tr-empty">\uB4F1\uB85D\uB41C \uBA74\uC81C \uAE30\uAC04\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. (GK \uB2E8\uC77C \uD3EC\uC9C0\uC158\uB9CC \uC790\uB3D9 \uBA74\uC81C)</div>';
  const sel = document.getElementById('exemptPid');
  if (sel) {
    sel.innerHTML = '<option value="">\uC120\uC218 \uC120\uD0DD</option>' +
      players.filter(p => !p.isMercenary && !isGkOnlyPlayer(p)).sort((a, b) => (a.jersey ?? 99) - (b.jersey ?? 99))
        .map(p => `<option value="${p.id}">${p.jersey != null ? '#' + p.jersey + ' ' : ''}${p.name}</option>`).join('');
  }
}
function saveExemption() {
  const pid = parseInt(document.getElementById('exemptPid').value, 10);
  const fromMonth = document.getElementById('exemptFrom').value;
  const toMonth = document.getElementById('exemptTo').value;
  if (!pid || !fromMonth || !toMonth) { alert('\uC120\uC218\u00B7\uAE30\uAC04\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694'); return; }
  if (fromMonth > toMonth) { alert('\uC2DC\uC791 \uC6D4\uC774 \uC885\uB8CC \uC6D4\uBCF4\uB2E4 \uB192\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4'); return; }
  dueExemptions.push({ id: Date.now(), pid, fromMonth, toMonth });
  document.getElementById('exemptPid').value = '';
  persistDueExemptions().catch(handleSaveError);
  renderExemptionList();
  renderTreasurer();
}
function deleteExemption(id) {
  if (!confirm('\uC774 \uBA74\uC81C \uAE30\uAC04\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;
  dueExemptions = dueExemptions.filter(ex => ex.id != id);
  persistDueExemptions().catch(handleSaveError);
  renderExemptionList();
  renderTreasurer();
}

// ── 지출 영수증 이미지 ──
async function exportTreasurerReceipt() {
  const ym = getTrYearMonth();
  const monthExpenses = filterExpensesByMonth(expenses.filter(e => e.status !== 'cancelled'), ym)
    .slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const totalExpense = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const sc = 2;
  const pad = 16 * sc;
  const lineH = 22 * sc;
  const headerH = 56 * sc;
  const rowH = 20 * sc;
  const tableH = Math.max(rowH, monthExpenses.length * rowH + lineH);
  const canvas = document.createElement('canvas');
  canvas.width = 360 * sc + pad * 2;
  canvas.height = headerH + lineH + tableH + pad * 2 + 24 * sc;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#141412';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const team = myTeamName || '\uC6B0\uB9AC FC';
  ctx.fillStyle = '#f0f0ee';
  ctx.font = `bold ${15 * sc}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`\uD83D\uDCCB ${team} \uC9C0\uCD9C \uC601\uC218\uC99D`, pad, headerH / 2 - 8 * sc);
  ctx.fillStyle = '#a0a09d';
  ctx.font = `${11 * sc}px sans-serif`;
  ctx.fillText(`${formatYearMonthDisplay(ym)} \u00B7 \uCD1D ${fmtMoney(totalExpense)}`, pad, headerH / 2 + 10 * sc);
  let y = headerH + pad;
  ctx.fillStyle = '#888';
  ctx.font = `600 ${9 * sc}px sans-serif`;
  ctx.fillText('\uB0A0\uC9DC', pad, y);
  ctx.fillText('\uC0AC\uC6A9\uCC98', pad + 72 * sc, y);
  ctx.fillText('\uAE08\uC561', pad + 200 * sc, y);
  y += lineH;
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(canvas.width - pad, y); ctx.stroke();
  y += 8 * sc;
  ctx.font = `${10 * sc}px sans-serif`;
  monthExpenses.forEach(ex => {
    const isSettle = !!ex.settlementId;
    const cat = isSettle ? '\uB9AC\uC6CC\uB4DC \uC815\uC0B0' : (ex.category || '-');
    ctx.fillStyle = '#d0d0cd';
    ctx.fillText(formatDateDisplay(ex.date).slice(5), pad, y);
    ctx.fillText(cat.slice(0, 12), pad + 72 * sc, y);
    ctx.fillText(fmtMoney(ex.amount), pad + 200 * sc, y);
    y += rowH;
  });
  if (!monthExpenses.length) {
    ctx.fillStyle = '#666';
    ctx.fillText('\uC9C0\uCD9C \uAE30\uB85D \uC5C6\uC74C', pad, y);
  }
  const filename = `receipt-${ym}-${team.replace(/[^\w가-힣]/g, '').slice(0, 8) || 'FC'}.png`;
  canvas.toBlob(async blob => {
    if (!blob) { alert('\uC774\uBBF8\uC9C0 \uC0DD\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4'); return; }
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${team} ${formatYearMonthDisplay(ym)} \uC9C0\uCD9C` });
        return;
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    downloadPngBlob(blob, filename);
  }, 'image/png');
}

function cancelSettlement(key) {
  if (!confirm('\uC774 \uC815\uC0B0\uC744 \uCDE8\uC18C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C? \uC5F0\uACB0\uB41C \uC9C0\uCD9C \uAE30\uB85D\uB3C4 \uC0AD\uC81C\uB418\uBA70, \uD574\uB2F9 \uB9AC\uC6CC\uB4DC\uB294 \uB2E4\uC2DC \uBBF8\uC815\uC0B0\uC73C\uB85C \uC7A1\uD799\uB2C8\uB2E4.')) return;
  const groupId = /^\d+$/.test(key) ? Number(key) : null;
  if (groupId) {
    settlements = settlements.filter(s => s.groupId !== groupId);
    expenses = expenses.filter(ex => ex.settlementId != groupId);
    disciplines.forEach(d => { if (d.settlementGroupId == groupId) d.settlementGroupId = null; });
  } else {
    const [dateRange, settledAt] = key.split('|');
    const [startDate, endDate] = dateRange.split('~');
    settlements = settlements.filter(s => !(s.startDate === startDate && s.endDate === endDate && s.settledAt === settledAt));
    expenses = expenses.filter(ex => ex.settlementId != settledAt && ex.settlementId !== settledAt);
  }
  Promise.all([persistSettlements(), persistExpenses(), persistDisciplines()]).catch(handleSaveError);
  renderTreasurer();
}

// ── 초기화 ──
document.getElementById('matchModal').addEventListener('click',function(e){if(e.target===this)closeMatchModal();});
document.getElementById('adminModal')?.addEventListener('click',function(e){if(e.target===this)closeAdminModal();});
document.getElementById('adminOptionsModal')?.addEventListener('click',function(e){if(e.target===this)closeAdminOptionsModal();});
document.getElementById('pwChangeModal')?.addEventListener('click',function(e){if(e.target===this)closePwChangeModal();});
document.getElementById('wageRatesModal')?.addEventListener('click',function(e){if(e.target===this)closeWageRatesModal();});
document.getElementById('statHistoryModal')?.addEventListener('click',function(e){if(e.target===this)closeStatHistory();});
document.getElementById('photoUrlModal')?.addEventListener('click',function(e){if(e.target===this)closePhotoUrlModal();});
document.getElementById('scheduleModal')?.addEventListener('click',function(e){if(e.target===this)closeScheduleModal();});
document.getElementById('scheduleEditModal')?.addEventListener('click',function(e){if(e.target===this)closeScheduleEditModal();});
document.getElementById('noticeModal')?.addEventListener('click',function(e){if(e.target===this)closeNoticeModal();});
document.getElementById('noticeEditModal')?.addEventListener('click',function(e){if(e.target===this)closeNoticeEditModal();});
document.getElementById('bulkDuesModal')?.addEventListener('click',function(e){if(e.target===this)closeBulkDuesModal();});
document.getElementById('exemptionModal')?.addEventListener('click',function(e){if(e.target===this)closeExemptionModal();});
document.getElementById('disciplineModal')?.addEventListener('click',function(e){if(e.target===this)closeDisciplineModal();});
document.getElementById('disciplineDetailModal')?.addEventListener('click',function(e){if(e.target===this)closeDisciplineDetailModal();});
document.getElementById('disciplinePlayer')?.addEventListener('change',updateDisciplineFormHint);
document.getElementById('disciplineLevel')?.addEventListener('change',function(){this.dataset.userPicked='1';});
applyPlatformClubBootstrap();
function onFieldResize(){
  if(!document.getElementById('tab-formation').classList.contains('active'))return;
  if(drag.active&&drag.pid!=null){
    const ft=fieldTokens.find(t=>t.pid===drag.pid);
    if(ft){const {x,y}=tokenXY(ft);refreshFieldSlots(findNearestSlot(drag.pid,x,y));}
  } else {
    drawFieldCanvas(-1);renderField();
  }
}
window.addEventListener('resize',onFieldResize);
if(window.visualViewport)window.visualViewport.addEventListener('resize',onFieldResize);
