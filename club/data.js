// 최종 포지션: GK / 수비(CB LB RB) / 미드(CDM CAM) / 공격(LW RW ST)
const ALL_POS = ['GK','CB','LB','RB','CDM','CAM','LW','RW','ST'];

const POS_BG = {
  GK:'#b8860b',                               // GK: 어두운 금/노랑
  CB:'#1a5fb4', LB:'#1a5fb4', RB:'#1a5fb4',  // 수비: 파랑
  CDM:'#2e7d32', CAM:'#2e7d32',               // 미드: 초록
  LW:'#c0392b', RW:'#c0392b', ST:'#c0392b',   // 공격: 빨강
  // 구 포지션 하위 호환
  DF:'#1a5fb4', LWB:'#1a5fb4', RWB:'#1a5fb4',
  CM:'#2e7d32', MF:'#2e7d32',
  CF:'#c0392b', FW:'#c0392b', LM:'#c0392b', RM:'#c0392b',
};
const POS_LAYER = {
  GK:0, CB:1, LB:1, RB:1,
  CDM:2, CAM:4,
  LW:5, RW:5, ST:6,
};
function posClass(p) {
  return {GK:'gk',
          CB:'def',LB:'def',RB:'def',DF:'def',LWB:'def',RWB:'def',
          CDM:'mid',CAM:'mid',CM:'mid',MF:'mid',
          LW:'fwd',RW:'fwd',ST:'fwd',CF:'fwd',FW:'fwd',LM:'fwd',RM:'fwd'}[p]||'';
}
function posColor(positions) { return POS_BG[positions&&positions[0]] || '#6b6b68'; }

// 날짜: 시트 Date/ISO → YYYY-MM-DD 저장, 화면은 YYYY.MM.DD
function normalizeDate(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date && !isNaN(val)) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ko = s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (ko) return `${ko[1]}-${String(ko[2]).padStart(2, '0')}-${String(ko[3]).padStart(2, '0')}`;
  const dot = s.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (dot) return `${dot[1]}-${dot[2]}-${dot[3]}`;
  return s.length >= 10 ? s.slice(0, 10) : s;
}
function formatDateDisplay(val) {
  const n = normalizeDate(val);
  if (!n || n.length < 10) return val ? String(val) : '';
  const [y, m, d] = n.split('-');
  return `${y}.${m}.${d}`;
}
// 시간: 시트 Date/ISO(1899-12-30T…) → HH:mm (KST)
function normalizeTime(val) {
  if (val == null || val === '') return '';
  const s = String(val).trim();
  const plain = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (plain) return `${String(plain[1]).padStart(2, '0')}:${plain[2]}`;
  const sheetsIso = s.match(/^1899-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (sheetsIso) {
    let total = parseInt(sheetsIso[1], 10) * 60 + parseInt(sheetsIso[2], 10) + 9 * 60;
    total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  if (val instanceof Date && !isNaN(val)) {
    const h = String(val.getHours()).padStart(2, '0');
    const m = String(val.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d)) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  }
  return '';
}
function formatTimeDisplay(val) {
  return normalizeTime(val);
}
function normalizeMatchDates(list) {
  return (list || []).map(m => ({ ...m, date: normalizeDate(m.date) || m.date }));
}
function normalizeDuesDates(list) {
  return (list || []).map(d => {
    const rec = { ...d, date: normalizeDate(d.date) };
    if (rec.pid == 0 && rec.type !== 'other') rec.type = 'other';
    if (rec.type === 'other') rec.pid = null;
    return rec;
  });
}
function normalizeExpenseDates(list) {
  return (list || []).map(e => ({
    ...e,
    date: normalizeDate(e.date),
    status: e.status || 'active',
  }));
}
function normalizeSettlementDates(list) {
  return (list || []).map(s => ({
    ...s,
    startDate: normalizeDate(s.startDate),
    endDate: normalizeDate(s.endDate),
    settledAt: normalizeDate(s.settledAt),
  }));
}
const DISCIPLINE_AMOUNTS = { 1: 1000, 2: 2000, 3: 3000, 30: 30, 50: 50 };
function normalizeDisciplineDates(list) {
  return (list || []).map(d => {
    const level = Number(d.level) || 1;
    return {
      ...d,
      date: normalizeDate(d.date),
      createdAt: d.createdAt ? String(d.createdAt) : d.createdAt,
      level,
      amount: Number(d.amount) || DISCIPLINE_AMOUNTS[level] || 1000,
      settlementGroupId: d.settlementGroupId != null ? d.settlementGroupId : null,
    };
  });
}
function normalizeScheduleDates(list) {
  return (list || []).map(s => ({
    ...s,
    date: normalizeDate(s.date),
    time: normalizeTime(s.time) || '',
  }));
}
function normalizeNoticeDates(list) {
  return (list || []).map(n => ({ ...n, date: normalizeDate(n.date) }));
}
function normalizeYearMonth(val) {
  if (val == null || val === '') return '';
  if (val instanceof Date && !isNaN(val)) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}`;
  const dot = s.match(/^(\d{4})\.\s*(\d{1,2})/);
  if (dot) return `${dot[1]}-${String(dot[2]).padStart(2, '0')}`;
  return '';
}
function normalizeExemptionMonths(list) {
  return (list || []).map(e => ({
    ...e,
    fromMonth: normalizeYearMonth(e.fromMonth),
    toMonth: normalizeYearMonth(e.toMonth),
  }));
}
function normalizeDueMemos(list) {
  return (list || []).map(m => ({
    ...m,
    yearMonth: normalizeYearMonth(m.yearMonth),
  }));
}
function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
function yearMonthFromDate(dateStr) {
  const d = normalizeDate(dateStr);
  return d ? normalizeYearMonth(d) : '';
}
function formatYearMonthDisplay(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

// OVR 가장 높은 포지션 (= 주포지션) 반환
function primaryPos(p) {
  if (!p || !p.positions || !p.positions.length) return '';
  if (p.positions.length === 1) return p.positions[0];
  return p.positions.reduce((best, pos) => {
    return (getOvr(p, pos) ?? 0) >= (getOvr(p, best) ?? 0) ? pos : best;
  }, p.positions[0]);
}
// 주포지션 기반 색상
function primaryPosColor(p) { return posColor([primaryPos(p)]); }

// ── 포메이션 슬롯 기본 좌표 (자동배치·슬롯 마커용) ──
// x,y = 플레이 영역 0~1 (0=상단 공격, 1=하단 GK). 드래그 후 freeX/freeY로 미세 이동 가능.
const FORMATIONS = {
  '4-3-3':   [[.50,.90],[.18,.70],[.38,.70],[.62,.70],[.82,.70],[.28,.48],[.50,.48],[.72,.48],[.18,.20],[.50,.12],[.82,.20]],
  '4-4-2':   [[.50,.90],[.18,.70],[.38,.70],[.62,.70],[.82,.70],[.18,.48],[.38,.48],[.62,.48],[.82,.48],[.35,.18],[.65,.18]],
  '4-2-3-1': [[.50,.90],[.18,.70],[.38,.70],[.62,.70],[.82,.70],[.35,.52],[.65,.52],[.18,.32],[.50,.34],[.82,.32],[.50,.13]],
  '4-1-4-1': [[.50,.90],[.18,.70],[.38,.70],[.62,.70],[.82,.70],[.50,.56],[.15,.44],[.38,.44],[.62,.44],[.85,.44],[.50,.12]],
  '4-2-1-3': [[.50,.90],[.18,.70],[.38,.70],[.62,.70],[.82,.70],[.35,.52],[.65,.52],[.50,.34],[.18,.16],[.50,.12],[.82,.16]],
  '4-1-2-3': [[.50,.90],[.18,.70],[.38,.70],[.62,.70],[.82,.70],[.50,.58],[.35,.42],[.65,.42],[.18,.16],[.50,.12],[.82,.16]],
  '3-4-3':   [[.50,.90],[.25,.70],[.50,.70],[.75,.70],[.18,.48],[.38,.48],[.62,.48],[.82,.48],[.18,.18],[.50,.12],[.82,.18]],
  '3-5-2':   [[.50,.90],[.25,.70],[.50,.70],[.75,.70],[.12,.48],[.32,.48],[.50,.44],[.68,.48],[.88,.48],[.35,.16],[.65,.16]],
  '5-3-2':   [[.50,.90],[.10,.70],[.28,.70],[.50,.70],[.72,.70],[.90,.70],[.28,.48],[.50,.48],[.72,.48],[.35,.16],[.65,.16]],
  '5-4-1':   [[.50,.90],[.10,.70],[.28,.70],[.50,.70],[.72,.70],[.90,.70],[.18,.48],[.38,.48],[.62,.48],[.82,.48],[.50,.14]]
};

const FORMATION_POS_LABELS = {
  '4-3-3':   ['GK','LB','CB','CB','RB','CDM','CAM','CAM','LW','ST','RW'],
  '4-4-2':   ['GK','LB','CB','CB','RB','LW','CDM','CDM','RW','ST','ST'],
  '4-2-3-1': ['GK','LB','CB','CB','RB','CDM','CDM','LW','CAM','RW','ST'],
  '4-1-4-1': ['GK','LB','CB','CB','RB','CDM','LW','CAM','CAM','RW','ST'],
  '4-2-1-3': ['GK','LB','CB','CB','RB','CDM','CDM','CAM','LW','ST','RW'],
  '4-1-2-3': ['GK','LB','CB','CB','RB','CDM','CAM','CAM','LW','ST','RW'],
  '3-4-3':   ['GK','CB','CB','CB','CAM','CDM','CDM','CAM','LW','ST','RW'],
  '3-5-2':   ['GK','CB','CB','CB','LB','CDM','CAM','CDM','RB','ST','ST'],
  '5-3-2':   ['GK','LB','CB','CB','CB','RB','CDM','CAM','CDM','ST','ST'],
  '5-4-1':   ['GK','LB','CB','CB','CB','RB','LW','CDM','CDM','RW','ST']
};

const SLOT_LABEL_MATCH = {
  // ── 현행 포지션 ──
  'GK' :['GK'],
  'CB' :['CB','LB','RB'],
  'LB' :['LB','CB'],
  'RB' :['RB','CB'],
  'CDM':['CDM','CAM'],
  'CAM':['CAM','CDM'],
  'LW' :['LW','ST','RW'],
  'RW' :['RW','ST','LW'],
  'ST' :['ST','LW','RW'],
  // ── 구 포지션 하위 호환 (기존 저장 데이터에 남아있을 수 있음) ──
  'DF' :['CB','LB','RB','DF'],
  'LWB':['LB','LWB','CB'],  'RWB':['RB','RWB','CB'],
  'CM' :['CDM','CAM','CM','MF'],
  'MF' :['CDM','CAM','MF','CM'],
  'LM' :['LW','LM','LB'],  'RM' :['RW','RM','RB'],
  'CF' :['ST','CF','LW','RW'],  'FW' :['ST','FW','CF'],
};

// 슬롯 스냅 인식 반경 (플레이 영역 0~1 기준). 작을수록 미세 조정하기 쉬움
const SNAP_RADIUS = 0.05;
const MAX_FIELD = 11;

// ── OVR 별 구간: 1~39=1★ / 40~54=2★ / 55~69=3★ / 70~84=4★ / 85~100=5★ ──
function ovrStarCount(ovr) {
  if (ovr == null || ovr < 1) return 0;
  if (ovr >= 85) return 5;
  if (ovr >= 70) return 4;
  if (ovr >= 55) return 3;
  if (ovr >= 40) return 2;
  return 1;
}
function ovrStars(ovr) {
  const n=ovrStarCount(ovr); if(n===0)return '';
  const stars='★'.repeat(n);
  if(n===5) return `<span class="ovr-stars elite">${stars}</span>`;
  const color=n>=3?'#f59e0b':'#9ca3af';
  return `<span class="ovr-stars" style="color:${color}">${stars}</span>`;
}
function ovrStarsText(ovr) { const n=ovrStarCount(ovr); return n>0?'★'.repeat(n):''; }
function ovrStarTier(ovr) {
  const n = ovrStarCount(ovr);
  if (n >= 5) return 'tier-5';
  if (n >= 4) return 'tier-4';
  if (n >= 3) return 'tier-3';
  if (n >= 2) return 'tier-2';
  if (n >= 1) return 'tier-1';
  return '';
}
function getOvr(p, pos) {
  if (!p.positions?.length) return null;
  if (!p.ovr) p.ovr = {};
  // 1. 정확히 일치하는 포지션 OVR
  if (pos && p.ovr[pos] != null) return p.ovr[pos];
  // 2. 슬롯이 수용하는 선수 포지션 중 최고 OVR (예: CM 슬롯 → CAM OVR 인식)
  if (pos) {
    const acceptable = SLOT_LABEL_MATCH[pos] || [];
    const matchOvrs = p.positions
      .filter(pp => acceptable.includes(pp))
      .map(pp => p.ovr[pp] ?? 50);
    if (matchOvrs.length) return Math.max(...matchOvrs);
    // 3. 반대로 선수 포지션의 매핑이 이 슬롯을 포함하는 경우 (예: CAM 선수 → MF 슬롯)
    for (const pp of p.positions) {
      if ((SLOT_LABEL_MATCH[pp] || []).includes(pos)) return p.ovr[pp] ?? 50;
    }
  }
  // 4. 최종 폴백: 선수의 주포 OVR
  const first = p.positions[0];
  return p.ovr[first] ?? 50;
}
// getBestOvr: 주포(x1.0) 부포(x0.75)만 반영, 3번째 이후 포지션은 OVR에 영향 없음
function getBestOvr(p) {
  if (!p.positions?.length) return null;
  if (!p.ovr) p.ovr = {};
  const pos0 = p.positions[0];
  const pos1 = p.positions[1];
  const ovr0 = p.ovr[pos0] ?? 50;
  if (!pos1) return ovr0;
  const ovr1 = p.ovr[pos1] ?? 50;
  return Math.round((ovr0 * 1.0 + ovr1 * 0.75) / 1.75);
}
function normalizePlayerOvr(p) {
  if(!p.positions?.length)return p;
  if(!p.ovr)p.ovr={};
  p.positions.forEach(pos=>{if(p.ovr[pos]==null)p.ovr[pos]=50;});
  return p;
}

const DEFAULT_PLAYERS = [
  {id:1,  name:'경표', jersey:7,  positions:['LW','RW'],            ovr:{}},
  {id:2,  name:'승규', jersey:5,  positions:['CB','CDM','ST'],       ovr:{}},
  {id:3,  name:'인수', jersey:8,  positions:['CDM'],                 ovr:{}},
  {id:4,  name:'주용', jersey:6,  positions:['CDM','CB'],            ovr:{}},
  {id:5,  name:'승지', jersey:4,  positions:['CDM','CB'],            ovr:{}},
  {id:6,  name:'청재', jersey:9,  positions:['ST','LW','RW'],        ovr:{}},
  {id:7,  name:'종민', jersey:3,  positions:['CB'],                  ovr:{}},
  {id:8,  name:'성진', jersey:10, positions:['CAM','CDM'],           ovr:{}},
  {id:9,  name:'인성', jersey:2,  positions:['CB','CDM'],            ovr:{}},
  {id:10, name:'성준', jersey:1,  positions:['GK','ST'],             ovr:{}},
  {id:11, name:'용민', jersey:11, positions:['LB','RB'],             ovr:{}},
  {id:12, name:'미수', jersey:12, positions:['RW','LW','LB','CDM'],  ovr:{}},
  {id:13, name:'지원', jersey:13, positions:['LW','RW','LB','RB'],   ovr:{}},
  {id:14, name:'철민', jersey:21, positions:['GK'],                  ovr:{}},
  {id:15, name:'진우', jersey:14, positions:['CDM'],                 ovr:{}},
  {id:16, name:'승위', jersey:16, positions:[],                      ovr:{}},
  {id:17, name:'지환', jersey:17, positions:['CDM','ST'],            ovr:{}}
];

// ── 통계 집계 (matches 배열 기준, 클라이언트 계산) ──
function matchResult(m) {
  if (m.scoreUs > m.scoreOpp) return 'W';
  if (m.scoreUs === m.scoreOpp) return 'D';
  return 'L';
}
function matchParticipantPids(m) {
  const pids = new Set();
  (m.lineup || []).forEach(l => { if (l.pid != null) pids.add(l.pid); });
  (m.subs || []).forEach(s => { if (s.pid != null) pids.add(s.pid); });
  return pids;
}
function getMatchYears(matches) {
  const years = new Set(matches.map(m => normalizeDate(m.date).slice(0, 4)).filter(Boolean));
  return [...years].sort((a, b) => b - a);
}
function filterMatchesByYear(matches, year) {
  if (!year || year === 'ALL') return matches;
  return matches.filter(m => normalizeDate(m.date).startsWith(String(year)));
}
function filterMatchesByVenue(matches, venue) {
  if (!venue || venue === 'all') return matches;
  return matches.filter(m => m.homeAway === venue);
}
function computePlayerStats(matches, players) {
  const map = {};
  players.forEach(p => {
    map[p.id] = { pid: p.id, name: p.name, jersey: p.jersey, positions: p.positions,
      attendance: 0, goals: 0, assists: 0, mom: 0 };
  });
  matches.forEach(m => {
    // 출석: 선발 + 교체 투입 + 교체 후보(subPid 등록 선수) 모두 포함
    matchParticipantPids(m).forEach(pid => { if (map[pid]) map[pid].attendance++; });
    (m.scorers || []).forEach(s => {
      if (!map[s.pid]) return;
      map[s.pid].goals += s.goals || 0;
      map[s.pid].assists += s.assists || 0;
    });
    if (m.mom != null && map[m.mom]) map[m.mom].mom++;
  });
  return Object.values(map);
}
function computeTeamStats(matches) {
  const n = matches.length;
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  matches.forEach(m => {
    gf += m.scoreUs || 0;
    ga += m.scoreOpp || 0;
    const r = matchResult(m);
    if (r === 'W') w++; else if (r === 'D') d++; else l++;
  });
  return {
    played: n, w, d, l, gf, ga,
    winRate: n ? Math.round(w / n * 100) : 0,
    gpg: n ? (gf / n).toFixed(1) : '0.0',
    cpg: n ? (ga / n).toFixed(1) : '0.0',
  };
}
function computeStreaks(matches) {
  const sorted = [...matches].filter(m => normalizeDate(m.date)).sort((a, b) => normalizeDate(a.date).localeCompare(normalizeDate(b.date)));
  const best = {
    win: { count: 0, from: null, to: null },
    unbeaten: { count: 0, from: null, to: null },
    lose: { count: 0, from: null, to: null },
  };
  let curWin = 0, winFrom = null;
  let curUnbeaten = 0, unbeatenFrom = null;
  let curLose = 0, loseFrom = null;
  const setBest = (key, count, from, to) => {
    if (count > best[key].count) best[key] = { count, from, to };
  };
  sorted.forEach(m => {
    const r = matchResult(m);
    const md = normalizeDate(m.date);
    if (r === 'W') {
      if (!curWin) winFrom = md;
      curWin++;
      setBest('win', curWin, winFrom, md);
    } else curWin = 0;
    if (r !== 'L') {
      if (!curUnbeaten) unbeatenFrom = md;
      curUnbeaten++;
      setBest('unbeaten', curUnbeaten, unbeatenFrom, md);
    } else curUnbeaten = 0;
    if (r === 'L') {
      if (!curLose) loseFrom = md;
      curLose++;
      setBest('lose', curLose, loseFrom, md);
    } else curLose = 0;
  });
  return best;
}
function getPlayerStatHistory(matches, pid, type) {
  return matches
    .filter(m => (m.scorers || []).some(s => s.pid === pid && (type === 'goals' ? (s.goals || 0) > 0 : (s.assists || 0) > 0)))
    .map(m => {
      const s = m.scorers.find(x => x.pid === pid);
      return {
        date: normalizeDate(m.date), oppTeam: m.oppTeam, scoreUs: m.scoreUs, scoreOpp: m.scoreOpp,
        count: type === 'goals' ? (s.goals || 0) : (s.assists || 0),
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
