/**
 * MK18/MK20 — 로비 매칭용 저장 포메 선택 (구단 홈에서 저장한 것만 · 편집 없음)
 */

import { apiLoadClubPlayers, apiLoadClubSaves, apiSaveClubField } from './api.js';
import {
  mountLineupFieldPreview,
  destroyLineupFieldPreview,
  firstQuarterWithLineup,
} from './lineup-field-view.js';

/** @typedef {'create'|'apply'} LineupMode */

const HOST_IDS = { create: 'matchLineupPicker', apply: 'matchApplyLineupPicker' };
const CLUB_IDS = { create: 'matchCreateClub', apply: 'matchApplyClub' };

let _mode = 'create';
let _teamId = null;
let _clubSlug = '';
/** @type {Array<Record<string, unknown>>} */
let _saves = [];
/** @type {Map<number, {name:string,jersey?:number}>} */
let _playerMap = new Map();
let _selectedSaveId = null;
let _activeQuarter = 1;
let _loading = false;
let _loadError = '';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function saveHasLineup(save) {
  if (!save) return false;
  for (let q = 1; q <= 4; q += 1) {
    const tokens = save[`q${q}tokens`] || (q === 1 ? save.tokens : null) || [];
    if (tokens.length > 0) return true;
  }
  return false;
}

function saveMetaLine(save) {
  const formation = save.q1formation || save.formation || '—';
  const players = new Set();
  for (let q = 1; q <= 4; q += 1) {
    const tokens = save[`q${q}tokens`] || (q === 1 ? save.tokens : null) || [];
    tokens.forEach((t) => { if (t?.pid != null) players.add(t.pid); });
  }
  const hasMultiQ = [2, 3, 4].some((q) => (save[`q${q}tokens`] || []).length > 0);
  const date = save.date ? ` · ${save.date}` : '';
  return `${formation} · ${players.size}명${hasMultiQ ? ' · 4쿼터' : ''}${date}`;
}

function previewMount(host, save) {
  const previewHost = host.querySelector('#lineupFieldPreviewHost');
  if (!previewHost) return;
  destroyLineupFieldPreview(previewHost);
  if (!save) {
    previewHost.innerHTML = '<p class="page-muted">포메이션을 선택하면 필드 미리보기가 표시됩니다.</p>';
    return;
  }
  mountLineupFieldPreview(previewHost, {
    save,
    playerMap: _playerMap,
    activeQuarter: _activeQuarter,
    onQuarterChange: (q) => { _activeQuarter = q; },
  });
}

function clubHomeLink() {
  if (!_clubSlug) return '';
  return `<a class="btn btn--outline btn--sm" href="club/index.html?slug=${encodeURIComponent(_clubSlug)}" target="_blank" rel="noopener">구단 홈 열기</a>`;
}

function renderSelectorHtml() {
  if (_loading) return '<p class="page-muted">저장된 포메이션 불러오는 중…</p>';
  if (_loadError) return `<p class="page-warn">${escapeHtml(_loadError)}</p>`;

  const usable = _saves.filter(saveHasLineup);
  if (!usable.length) {
    return `
      <div class="lineup-select lineup-select--empty">
        <p class="page-warn">저장된 포메이션이 없습니다.</p>
        <p class="page-muted">구단 홈 → <strong>포메</strong> 탭에서 회의로 라인업을 짠 뒤 <strong>포메이션 저장</strong>을 해 주세요.</p>
        <div class="lineup-picker__actions">${clubHomeLink()}</div>
      </div>`;
  }

  const options = usable.map((s) => {
    const sel = _selectedSaveId === s.id ? 'selected' : '';
    const label = `${s.name || '이름 없음'} (${saveMetaLine(s)})`;
    return `<option value="${s.id}" ${sel}>${escapeHtml(label)}</option>`;
  }).join('');

  const selected = usable.find((s) => s.id === _selectedSaveId) || usable[0];

  return `
    <div class="lineup-select">
      <div class="form-row">
        <label class="form-label">저장된 포메이션</label>
        <select class="form-input" id="lineupSaveSelect">
          ${options}
        </select>
      </div>
      <div id="lineupFieldPreviewHost"><p class="page-muted">미리보기 로딩…</p></div>
      <p class="lineup-picker__count is-ok">선택한 포메가 등록·신청 시 스냅샷으로 잠깁니다. (MK08)</p>
      <p class="page-muted">로비에서는 편집하지 않습니다. 쿼터별 OVR·배치는 구단 홈과 동일하게 표시됩니다.</p>
      <div class="lineup-picker__actions">${clubHomeLink()}</div>
    </div>`;
}

function bindSelectorEvents(host) {
  host.querySelector('#lineupSaveSelect')?.addEventListener('change', (e) => {
    _selectedSaveId = Number(e.target.value) || null;
    const save = getSelectedSave();
    _activeQuarter = save ? firstQuarterWithLineup(save) : 1;
    host.innerHTML = renderSelectorHtml();
    bindSelectorEvents(host);
    previewMount(host, save);
  });
  previewMount(host, getSelectedSave());
}

function fieldPayloadFromSave(save) {
  return {
    q1formation: save.q1formation || save.formation || '',
    q1tokens: save.q1tokens || save.tokens || [],
    q2formation: save.q2formation || '',
    q2tokens: save.q2tokens || [],
    q3formation: save.q3formation || '',
    q3tokens: save.q3tokens || [],
    q4formation: save.q4formation || '',
    q4tokens: save.q4tokens || [],
    activeQuarter: 1,
  };
}

function getSelectedSave() {
  const usable = _saves.filter(saveHasLineup);
  if (_selectedSaveId != null) {
    return usable.find((s) => s.id === _selectedSaveId) || usable[0] || null;
  }
  return usable[0] || null;
}

async function loadClubSavedLineups(teamId, clubSlug) {
  _teamId = teamId;
  _clubSlug = clubSlug || '';
  _loading = true;
  _loadError = '';
  _selectedSaveId = null;
  _activeQuarter = 1;
  try {
    const [players, saves] = await Promise.all([
      apiLoadClubPlayers(teamId),
      apiLoadClubSaves(teamId),
    ]);
    _playerMap = new Map((players || []).map((p) => [p.id, p]));
    _saves = saves || [];
    const usable = _saves.filter(saveHasLineup);
    if (usable.length) {
      _selectedSaveId = usable[0].id;
      _activeQuarter = firstQuarterWithLineup(usable[0]);
    }
  } catch (e) {
    _loadError = e?.message || '저장 포메 불러오기 실패';
    _saves = [];
    _playerMap = new Map();
  }
  _loading = false;
}

async function mountLineupSelector(mode, staff) {
  const prevMode = _mode;
  const prevTeamId = _teamId;
  _mode = mode;
  const host = document.getElementById(HOST_IDS[mode]);
  if (!host) return;

  const clubId = document.getElementById(CLUB_IDS[mode])?.value;
  const club = (staff || []).find((c) => c.id === clubId);
  const teamId = club?.team_id;
  if (!teamId) {
    host.innerHTML = '<p class="page-muted">구단을 선택해 주세요.</p>';
    return;
  }

  if (prevTeamId !== teamId || prevMode !== mode) {
    await loadClubSavedLineups(teamId, club?.slug);
  }

  host.innerHTML = renderSelectorHtml();
  bindSelectorEvents(host);
}

/** @param {Array<{id:string,team_id:number,slug?:string}>} staff */
export async function mountLineupPickerForCreate(staff) {
  await mountLineupSelector('create', staff);
}

/** @param {Array<{id:string,team_id:number,slug?:string}>} staff */
export async function mountLineupPickerForApply(staff) {
  await mountLineupSelector('apply', staff);
}

export function lineupIsReady() {
  return !!getSelectedSave();
}

export function lineupValidationMessage() {
  if (_loading) return '저장된 포메이션을 불러오는 중입니다.';
  if (_loadError) return _loadError;
  const usable = _saves.filter(saveHasLineup);
  if (!usable.length) {
    return '구단 홈에서 포메이션을 저장한 뒤 다시 시도해 주세요.';
  }
  if (!getSelectedSave()) return '등록할 포메이션을 선택해 주세요.';
  return '';
}

export async function saveLineupBeforePost() {
  const save = getSelectedSave();
  if (!_teamId || !save) throw new Error('선택된 포메이션 없음');
  await apiSaveClubField(_teamId, fieldPayloadFromSave(save));
}
