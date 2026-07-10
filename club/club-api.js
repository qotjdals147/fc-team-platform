/**
 * FC 플랫폼 — 구단 홈 API (team_id 격리)
 * FC 제ero ../api.js 인터페이스 유지: apiLoadAll, apiSavePartial, setSyncHandler
 * config: window.__PLATFORM__ (club-boot.js)
 */

(function () {
  const P = window.__PLATFORM__;
  if (!P?.SUPABASE_URL || !P?.SUPABASE_KEY) {
    console.error('[club-api] __PLATFORM__ 미설정');
  }

  const SUPABASE_URL = P.SUPABASE_URL;
  const SUPABASE_KEY = P.SUPABASE_KEY;
  const TEAM_ID = window.__CLUB__?.teamId ?? window.__CLUB__?.team_id;

  const JSONB_TABLES = new Set([
    'dues',
    'expenses',
    'settlements',
    'schedules',
    'notices',
    'dueExemptions',
    'dueMemos',
    'disciplines',
  ]);

  const META_PRESERVE_IF_EMPTY = new Set(['myTeam', 'teamPhotoUrl', 'teamPhotoUrls']);

  let _syncHandler = null;

  function getAccessToken() {
    try {
      const raw = localStorage.getItem('fc_platform_session_v1');
      return raw ? JSON.parse(raw)?.access_token : null;
    } catch {
      return null;
    }
  }

  function sbHeaders(extra) {
    const token = getAccessToken();
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token || SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...extra,
    };
  }

  function sbUrl(table, query = '') {
    return `${SUPABASE_URL}/rest/v1/${table}${query}`;
  }

  function teamFilter() {
    if (TEAM_ID == null) throw new Error('team_id 없음');
    return `team_id=eq.${TEAM_ID}`;
  }

  function setSyncHandler(fn) {
    _syncHandler = fn;
  }

  function syncUI(state, msg) {
    if (_syncHandler) _syncHandler(state, msg);
  }

  function metaValueString(val) {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  async function sbLoadSafe(label, loader, fallback) {
    try {
      return await loader();
    } catch (e) {
      console.warn(`[club-api] ${label} 로드 실패:`, e);
      return fallback;
    }
  }

  function playerFromDb(r) {
    return {
      id: r.id,
      userId: r.user_id || null,
      name: r.name,
      jersey: r.jersey,
      positions: r.positions || [],
      ovr: r.ovr || {},
      formBonus: r.form_bonus ?? r.formBonus ?? 0,
      isMercenary: r.is_mercenary ?? r.isMercenary ?? false,
    };
  }

  function playerToDb(p) {
    const row = {
      id: p.id,
      team_id: TEAM_ID,
      name: p.name,
      jersey: p.jersey,
      positions: p.positions || [],
      ovr: p.ovr || {},
      form_bonus: p.formBonus || 0,
      is_mercenary: !!p.isMercenary,
      roster_active: true,
    };
    if (p.userId) row.user_id = p.userId;
    return row;
  }

  function unpackJsonbRow(r) {
    const d = r.data && typeof r.data === 'object' ? r.data : {};
    return { id: r.id, ...d };
  }

  function packJsonbRow(obj) {
    const { id, team_id, ...rest } = obj;
    return { id, team_id: TEAM_ID, data: rest };
  }

  function unpackSave(r) {
    const d = r.data && typeof r.data === 'object' ? r.data : {};
    return { id: r.id, name: r.name || d.name || '', ...d };
  }

  function packSave(s) {
    const { id, name, team_id, ...rest } = s;
    return { id, team_id: TEAM_ID, name: name || '', data: rest };
  }

  function unpackMatch(r) {
    const d = r.data && typeof r.data === 'object' ? r.data : {};
    return {
      id: r.id,
      date: r.date ?? d.date,
      opponent: r.opponent ?? d.opponent ?? d.oppTeam,
      lineup: r.lineup ?? d.lineup,
      subs: r.subs ?? d.subs,
      scorers: r.scorers ?? d.scorers,
      ...d,
      ...(r.opponent && !d.oppTeam ? { oppTeam: r.opponent } : {}),
    };
  }

  function packMatch(m) {
    const {
      id,
      date,
      opponent,
      oppTeam,
      lineup,
      subs,
      scorers,
      team_id,
      data,
      ...rest
    } = m;
    return {
      id,
      team_id: TEAM_ID,
      date: date || rest.date || null,
      opponent: opponent || oppTeam || rest.oppTeam || null,
      lineup: lineup ?? rest.lineup ?? null,
      subs: subs ?? rest.subs ?? null,
      scorers: scorers ?? rest.scorers ?? null,
      data: { ...rest, ...(data || {}) },
    };
  }

  async function sbSelect(table) {
    let query = `?${teamFilter()}&select=*`;
    if (table === 'players') {
      query = `?${teamFilter()}&roster_active=eq.true&select=*`;
    }
    const res = await fetch(sbUrl(table, query), {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(`${table} 읽기 실패: ${res.status}`);
    const rows = await res.json();
    if (table === 'players') return rows.map(playerFromDb);
    if (table === 'matches') return rows.map(unpackMatch);
    if (table === 'saves') return rows.map(unpackSave);
    if (JSONB_TABLES.has(table)) return rows.map(unpackJsonbRow);
    return rows;
  }

  async function sbSelectQuoted(table) {
    const res = await fetch(sbUrl(table, `?${teamFilter()}&select=*`), {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error(`${table} 읽기 실패`);
    const rows = await res.json();
    return rows.map(unpackJsonbRow);
  }

  async function sbUpsert(table, rows) {
    if (!rows || !rows.length) {
      console.warn(`[club-api] skip ${table} upsert: empty rows (DELETE 방지)`);
      return;
    }
    const del = await fetch(sbUrl(table, `?${teamFilter()}`), {
      method: 'DELETE',
      headers: sbHeaders(),
    });
    if (!del.ok && del.status !== 404) {
      throw new Error(`${table} 삭제 실패: ${del.status}`);
    }
    if (!rows || !rows.length) return;

    let payload;
    if (table === 'players') payload = rows.map(playerToDb);
    else if (table === 'matches') payload = rows.map(packMatch);
    else if (table === 'saves') payload = rows.map(packSave);
    else if (JSONB_TABLES.has(table)) payload = rows.map(packJsonbRow);
    else payload = rows.map((r) => ({ ...r, team_id: TEAM_ID }));

    const res = await fetch(sbUrl(table), {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${table} 저장 실패: ${await res.text()}`);
  }

  async function sbSelectMeta() {
    const res = await fetch(sbUrl('meta', `?${teamFilter()}&select=key,value`), {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error('meta 읽기 실패');
    const rows = await res.json();
    const meta = {};
    rows.forEach((r) => {
      if (r.key) meta[r.key] = r.value;
    });
    return meta;
  }

  async function sbUpsertMeta(meta) {
    if (!meta) return;
    const existing = await sbSelectMeta();
    const merged = { ...existing };
    for (const [k, v] of Object.entries(meta)) {
      const s = metaValueString(v);
      if (META_PRESERVE_IF_EMPTY.has(k) && !s && existing[k]) continue;
      merged[k] = s;
    }
    const rows = Object.keys(merged).map((k) => ({
      team_id: TEAM_ID,
      key: k,
      value: merged[k],
    }));
    if (!rows.length) return;
    for (const row of rows) {
      const res = await fetch(sbUrl('meta'), {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(row),
      });
      if (!res.ok) throw new Error('meta 저장 실패: ' + (await res.text()));
    }
  }

  const FIELD_DEFAULT = {
    q1formation: '4-3-3',
    q1tokens: [],
    q2formation: '',
    q2tokens: [],
    q3formation: '',
    q3tokens: [],
    q4formation: '',
    q4tokens: [],
    activeQuarter: 1,
  };

  async function sbSelectField() {
    const res = await fetch(sbUrl('field', `?${teamFilter()}&id=eq.1`), {
      headers: sbHeaders(),
    });
    if (!res.ok) throw new Error('field 읽기 실패');
    const rows = await res.json();
    if (!rows.length) return { ...FIELD_DEFAULT };
    const r = rows[0];
    const d = r.data && typeof r.data === 'object' ? r.data : {};
    return {
      q1formation: d.q1formation || r.q1formation || '4-3-3',
      q1tokens: r.q1tokens || d.q1tokens || [],
      q2formation: d.q2formation || r.q2formation || '',
      q2tokens: r.q2tokens || d.q2tokens || [],
      q3formation: d.q3formation || r.q3formation || '',
      q3tokens: r.q3tokens || d.q3tokens || [],
      q4formation: d.q4formation || r.q4formation || '',
      q4tokens: r.q4tokens || d.q4tokens || [],
      activeQuarter: d.activeQuarter || r.activeQuarter || 1,
    };
  }

  async function sbUpsertField(field) {
    if (!field) return;
    const row = {
      team_id: TEAM_ID,
      id: 1,
      q1tokens: field.q1tokens || field.tokens || [],
      q2tokens: field.q2tokens || [],
      q3tokens: field.q3tokens || [],
      q4tokens: field.q4tokens || [],
      data: {
        q1formation: field.q1formation || field.formation || '4-3-3',
        q2formation: field.q2formation || '',
        q3formation: field.q3formation || '',
        q4formation: field.q4formation || '',
        activeQuarter: field.activeQuarter || 1,
      },
    };
    const res = await fetch(sbUrl('field'), {
      method: 'POST',
      headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error('field 저장 실패: ' + (await res.text()));
  }

  async function apiLoadAll(silent = false) {
    if (window.__ensurePlatformSession) await window.__ensurePlatformSession();
    if (!silent) syncUI('loading', '데이터 불러오는 중…');
    const jobs = [
      ['players', () => sbSelect('players'), []],
      ['matches', () => sbSelect('matches'), []],
      ['field', () => sbSelectField(), { ...FIELD_DEFAULT }],
      ['saves', () => sbSelect('saves'), []],
      ['meta', () => sbSelectMeta(), {}],
      ['dues', () => sbSelect('dues'), []],
      ['expenses', () => sbSelect('expenses'), []],
      ['settlements', () => sbSelect('settlements'), []],
      ['schedules', () => sbSelect('schedules'), []],
      ['notices', () => sbSelect('notices'), []],
      ['dueExemptions', () => sbSelectQuoted('dueExemptions'), []],
      ['dueMemos', () => sbSelectQuoted('dueMemos'), []],
      ['disciplines', () => sbSelect('disciplines'), []],
    ];
    const settled = await Promise.allSettled(jobs.map(([, fn]) => fn()));
    const failures = [];
    const out = {};
    jobs.forEach(([name], i) => {
      const r = settled[i];
      if (r.status === 'fulfilled') out[name] = r.value;
      else {
        failures.push(name);
        out[name] = jobs[i][2];
        console.warn(`[club-api] ${name}:`, r.reason);
      }
    });
    if (failures.length === jobs.length) {
      syncUI('error', '불러오기 실패');
      throw new Error('Supabase 전체 로드 실패');
    }
    if (!silent) {
      syncUI(
        'ok',
        failures.length ? `동기화됨 (${failures.length}개 테이블 제외)` : '동기화됨',
      );
    }
    return {
      players: out.players,
      matches: out.matches,
      field: out.field,
      saves: out.saves,
      meta: out.meta,
      dues: out.dues,
      expenses: out.expenses,
      settlements: out.settlements,
      schedules: out.schedules,
      notices: out.notices,
      dueExemptions: out.dueExemptions,
      dueMemos: out.dueMemos,
      disciplines: out.disciplines,
    };
  }

  async function apiSavePartial(data) {
    if (window.__ensurePlatformSession) await window.__ensurePlatformSession();
    syncUI('saving', '저장 중…');
    try {
      const tasks = [];
      if (data.players !== undefined) tasks.push(sbUpsert('players', data.players));
      if (data.matches !== undefined) tasks.push(sbUpsert('matches', data.matches));
      if (data.field !== undefined) tasks.push(sbUpsertField(data.field));
      if (data.saves !== undefined) tasks.push(sbUpsert('saves', data.saves));
      if (data.meta !== undefined) tasks.push(sbUpsertMeta(data.meta));
      if (data.dues !== undefined) tasks.push(sbUpsert('dues', data.dues));
      if (data.expenses !== undefined) tasks.push(sbUpsert('expenses', data.expenses));
      if (data.settlements !== undefined) tasks.push(sbUpsert('settlements', data.settlements));
      if (data.schedules !== undefined) tasks.push(sbUpsert('schedules', data.schedules));
      if (data.notices !== undefined) tasks.push(sbUpsert('notices', data.notices));
      if (data.dueExemptions !== undefined) tasks.push(sbUpsert('dueExemptions', data.dueExemptions));
      if (data.dueMemos !== undefined) tasks.push(sbUpsert('dueMemos', data.dueMemos));
      if (data.disciplines !== undefined) tasks.push(sbUpsert('disciplines', data.disciplines));
      await Promise.all(tasks);
      syncUI('ok', '동기화됨');
    } catch (e) {
      syncUI('error', '저장 실패');
      throw e;
    }
  }

  const clubId = window.__CLUB__?.id;
  const STORAGE_BUCKET = 'team-photos';

  function apiTeamPhotoPublicUrl(storagePath) {
    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
  }

  function apiStoragePathFromPublicUrl(url) {
    if (!url) return null;
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const i = url.indexOf(marker);
    if (i < 0) return null;
    return decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  }

  async function apiUploadTeamPhoto(file) {
    if (!clubId) throw new Error('club_id 없음');
    const extMatch = (file.name || '').match(/\.(jpe?g|png|gif|webp)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
    const path = `${clubId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const token = getAccessToken();
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token || SUPABASE_KEY}`,
        'Content-Type': file.type || 'image/jpeg',
      },
      body: file,
    });
    if (!res.ok) throw new Error(`사진 업로드 실패: ${await res.text()}`);
    return { url: apiTeamPhotoPublicUrl(path), storagePath: path };
  }

  async function apiDeleteTeamPhoto(storagePath) {
    if (!storagePath) return;
    const token = getAccessToken();
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token || SUPABASE_KEY}`,
      },
    });
    if (!res.ok && res.status !== 404) throw new Error(`사진 삭제 실패: ${await res.text()}`);
  }

  async function apiEnsureClubRoster() {
    const clubId = window.__CLUB__?.id;
    if (!clubId) return null;
    if (window.__ensurePlatformSession) await window.__ensurePlatformSession();
    const res = await fetch(sbUrl('rpc/ensure_club_roster'), {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_club_id: clubId }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `ensure_club_roster HTTP ${res.status}`);
    }
    return text ? JSON.parse(text) : null;
  }

  window.setSyncHandler = setSyncHandler;
  window.apiLoadAll = apiLoadAll;
  window.apiSavePartial = apiSavePartial;
  window.apiEnsureClubRoster = apiEnsureClubRoster;
  window.apiUploadTeamPhoto = apiUploadTeamPhoto;
  window.apiDeleteTeamPhoto = apiDeleteTeamPhoto;
  window.apiTeamPhotoPublicUrl = apiTeamPhotoPublicUrl;
  window.apiStoragePathFromPublicUrl = apiStoragePathFromPublicUrl;
})();
