/**
 * MK18/MK19 — 읽기 전용 포메 필드 뷰 (구단 홈 포메 탭과 동일한 시각)
 */

import { apiLoadClubPlayers } from './api.js';
import { FORMATIONS, FORMATION_POS_LABELS, SLOT_LABEL_MATCH } from './formations-data.js';

const POS_BG = {
  GK: '#b8860b',
  CB: '#1a5fb4', LB: '#1a5fb4', RB: '#1a5fb4',
  CDM: '#2e7d32', CAM: '#2e7d32',
  LW: '#c0392b', RW: '#c0392b', ST: '#c0392b',
};

const STAR_ARC_LAYOUT = {
  1: [[50, 2]],
  2: [[30, 10], [70, 10]],
  3: [[20, 16], [50, 2], [80, 16]],
  4: [[14, 20], [36, 6], [64, 6], [86, 20]],
  5: [[10, 22], [28, 8], [50, 0], [72, 8], [90, 22]],
};

function fieldPad(W) {
  return Math.max(8, Math.round((W * 16) / 400));
}

function normToCanvasPx(nx, ny, W, H) {
  const pad = fieldPad(W);
  return { x: pad + nx * (W - 2 * pad), y: pad + ny * (H - 2 * pad) };
}

function posColor(positions) {
  return POS_BG[positions?.[0]] || '#6b6b68';
}

function ovrStarCount(ovr) {
  if (ovr == null || ovr < 1) return 0;
  if (ovr >= 85) return 5;
  if (ovr >= 70) return 4;
  if (ovr >= 55) return 3;
  if (ovr >= 40) return 2;
  return 1;
}

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
  if (!p?.positions?.length) return null;
  const ovr = p.ovr || {};
  if (pos && ovr[pos] != null) return Number(ovr[pos]) || null;
  if (pos) {
    const acceptable = SLOT_LABEL_MATCH[pos] || [];
    const matchOvrs = p.positions
      .filter((pp) => acceptable.includes(pp))
      .map((pp) => Number(ovr[pp]) || 50);
    if (matchOvrs.length) return Math.max(...matchOvrs);
    for (const pp of p.positions) {
      if ((SLOT_LABEL_MATCH[pp] || []).includes(pos)) return Number(ovr[pp]) || 50;
    }
  }
  const first = p.positions[0];
  return first ? (Number(ovr[first]) || 50) : null;
}

function formBonus(p) {
  return Number(p?.formBonus ?? p?.form_bonus) || 0;
}

function drawGrass(canvas) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e7a43';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i += 1) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, (i * H) / 8, W, H / 8);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  const pad = fieldPad(W);
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  const mx = W / 2;
  const my = H / 2;
  ctx.beginPath();
  ctx.moveTo(pad, my);
  ctx.lineTo(W - pad, my);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, W * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(mx, my, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  const bw = W * 0.5;
  const bh = H * 0.12;
  ctx.strokeRect((W - bw) / 2, pad, bw, bh);
  ctx.strokeRect((W - bw) / 2, H - pad - bh, bw, bh);
  const pw = W * 0.28;
  const ph = H * 0.055;
  ctx.strokeRect((W - pw) / 2, pad, pw, ph);
  ctx.strokeRect((W - pw) / 2, H - pad - ph, pw, ph);
  const cr = H * 0.038;
  [[pad, pad], [W - pad, pad], [pad, H - pad], [W - pad, H - pad]].forEach(([cx, cy]) => {
    const a = (cx === pad ? (cy === pad ? 0 : 270) : cy === pad ? 90 : 180) * (Math.PI / 180);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, a, a + Math.PI / 2);
    ctx.stroke();
  });
}

function drawFormationSlots(ctx, W, H, formation, tokens) {
  const slots = FORMATIONS[formation] || [];
  const labels = FORMATION_POS_LABELS[formation] || [];
  const occupied = new Set(tokens.map((t) => t.slotIdx).filter((i) => i >= 0));
  const sc = W / 420;
  const rBase = Math.max(10, 14 * sc);
  slots.forEach((sl, i) => {
    const { x, y } = normToCanvasPx(sl[0], sl[1], W, H);
    const isOccupied = occupied.has(i);
    ctx.beginPath();
    ctx.arc(x, y, rBase, 0, Math.PI * 2);
    ctx.fillStyle = isOccupied ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.24)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (labels[i]) {
      ctx.fillStyle = 'rgba(255,255,255,0.52)';
      ctx.font = `bold ${Math.max(8, Math.round(9 * sc))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], x, y);
    }
  });
}

export function getQuarterData(save, q) {
  const formation = save?.[`q${q}formation`] || (q === 1 ? save?.formation : '') || '';
  const tokens = save?.[`q${q}tokens`] || (q === 1 ? save?.tokens : null) || [];
  return { formation, tokens };
}

export function firstQuarterWithLineup(save) {
  for (let q = 1; q <= 4; q += 1) {
    if (getQuarterData(save, q).tokens.length > 0) return q;
  }
  return 1;
}

/** matching_posts / matching_applications field_snapshot → saves 형식 */
export function snapshotToSave(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const d = snapshot.data && typeof snapshot.data === 'object' ? snapshot.data : {};
  return {
    q1formation: d.q1formation || '',
    q1tokens: Array.isArray(snapshot.q1tokens) ? snapshot.q1tokens : [],
    q2formation: d.q2formation || '',
    q2tokens: Array.isArray(snapshot.q2tokens) ? snapshot.q2tokens : [],
    q3formation: d.q3formation || '',
    q3tokens: Array.isArray(snapshot.q3tokens) ? snapshot.q3tokens : [],
    q4formation: d.q4formation || '',
    q4tokens: Array.isArray(snapshot.q4tokens) ? snapshot.q4tokens : [],
  };
}

export function saveHasLineup(save) {
  if (!save) return false;
  for (let q = 1; q <= 4; q += 1) {
    if (getQuarterData(save, q).tokens.length > 0) return true;
  }
  return false;
}

export function snapshotHasLineup(snapshot) {
  return saveHasLineup(snapshotToSave(snapshot));
}

/** @param {HTMLElement} hostEl */
export async function mountSnapshotLineupPreview(hostEl, snapshot, teamId) {
  if (!hostEl) return;
  const save = snapshotToSave(snapshot);
  if (!saveHasLineup(save)) {
    hostEl.innerHTML = '<p class="page-muted">신청 시점 라인업 스냅샷이 없습니다.</p>';
    return;
  }
  hostEl.innerHTML = '<p class="page-muted">라인업 불러오는 중…</p>';
  let playerMap = new Map();
  if (teamId) {
    try {
      const players = await apiLoadClubPlayers(teamId);
      playerMap = new Map((players || []).map((p) => [p.id, p]));
    } catch {
      playerMap = new Map();
    }
  }
  destroyLineupFieldPreview(hostEl);
  mountLineupFieldPreview(hostEl, {
    save,
    playerMap,
    activeQuarter: firstQuarterWithLineup(save),
  });
}

function tokenXY(t, formation) {
  if (t.freeX != null && t.freeY != null) return { x: t.freeX, y: t.freeY };
  const slots = FORMATIONS[formation] || [];
  if (t.slotIdx >= 0 && slots[t.slotIdx]) {
    return { x: slots[t.slotIdx][0], y: slots[t.slotIdx][1] };
  }
  return { x: 0.5, y: 0.5 };
}

function resolveTokenPos(t, p, formation) {
  const labels = FORMATION_POS_LABELS[formation] || [];
  const slotLabel = t.slotIdx >= 0 && labels[t.slotIdx] ? labels[t.slotIdx] : '';
  return t.pos || slotLabel || p?.positions?.[0] || '';
}

function tokenStarArcHtml(ovr) {
  const n = ovrStarCount(ovr);
  if (!n) return '';
  const tier = ovrStarTier(ovr);
  const pts = STAR_ARC_LAYOUT[n] || STAR_ARC_LAYOUT[1];
  const stars = pts.map(([l, top]) => `<span class="lf-token-star" style="left:${l}%;top:${top}%">★</span>`).join('');
  return `<div class="lf-token-star-arc ${tier}">${stars}</div>`;
}

function tokenOvrPillHtml(baseOvr, bonus) {
  if (baseOvr == null) return '';
  const effectiveOvr = baseOvr + bonus;
  const tier = ovrStarTier(effectiveOvr);
  const bonusStr = bonus !== 0
    ? `<span class="lf-form-bonus ${bonus > 0 ? 'plus' : 'minus'}">${bonus > 0 ? '+' : ''}${bonus}</span>`
    : '';
  return `<div class="lf-token-ovr-pill ${tier}"><span class="lf-token-ovr-label">OVR+</span><span class="lf-token-ovr-val">${Math.round(baseOvr)}</span>${bonusStr}</div>`;
}

function buildTokenHtml(p, pos, ovr, subPid, playerMap) {
  let subStr = '';
  if (subPid) {
    const subP = playerMap.get(subPid);
    if (subP) {
      subStr = `<div class="lf-token-sub">🔄 ${subP.jersey != null ? `${subP.jersey} ` : ''}${subP.name}</div>`;
    }
  }
  const circleColor = posColor(pos ? [pos] : p?.positions);
  const bonus = formBonus(p);
  const effectiveOvr = ovr != null ? ovr + bonus : null;
  const initials = (p?.name || '?').slice(0, 2);
  return `<div class="lf-token-avatar-wrap">
    ${effectiveOvr != null ? tokenStarArcHtml(effectiveOvr) : ''}
    <div class="lf-token-circle" style="background:${circleColor}">
      ${initials}
      ${pos ? `<span class="lf-token-pos-badge">${pos}</span>` : ''}
    </div>
  </div>
  ${tokenOvrPillHtml(ovr, bonus)}${subStr}`;
}

function tokenPosNorm(nx, ny, canvasRect, wrapRect) {
  const pad = fieldPad(canvasRect.width);
  const x = pad + nx * (canvasRect.width - 2 * pad);
  const y = pad + ny * (canvasRect.height - 2 * pad);
  return {
    left: canvasRect.left - wrapRect.left + x,
    top: canvasRect.top - wrapRect.top + y,
  };
}

function resizeCanvas(wrap, canvas) {
  const RATIO = 1.45;
  const maxW = Math.min(wrap.clientWidth || 360, 420);
  const W = Math.max(220, maxW);
  const H = Math.round(W * RATIO);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  return { W, H };
}

function paintField(root, save, playerMap, activeQuarter) {
  const qd = getQuarterData(save, activeQuarter);
  const formation = qd.formation && FORMATIONS[qd.formation] ? qd.formation : '4-3-3';
  const tokens = qd.tokens || [];

  const wrap = root.querySelector('.lineup-field-view__wrap');
  const canvas = root.querySelector('.lineup-field-canvas');
  const tokenHost = root.querySelector('.lineup-field-tokens');
  const metaEl = root.querySelector('.lineup-field-view__formation');
  if (!wrap || !canvas || !tokenHost) return;

  const { W, H } = resizeCanvas(wrap, canvas);
  const tkScale = Math.min(1, Math.max(0.65, W / 340));
  root.style.setProperty('--lf-tk', tkScale.toFixed(3));

  drawGrass(canvas);
  drawFormationSlots(canvas.getContext('2d'), W, H, formation, tokens);

  const uniquePids = new Set(tokens.map((t) => t.pid).filter((id) => id != null));
  if (metaEl) {
    metaEl.textContent = `${formation} · ${tokens.length}명 배치 · ${uniquePids.size}명 출전`;
  }

  tokenHost.innerHTML = '';
  const canvasRect = canvas.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();

  tokens.forEach((t) => {
    const p = playerMap.get(t.pid);
    if (!p) return;
    const pos = resolveTokenPos(t, p, formation);
    const ovr = getOvr(p, pos);
    const { x, y } = tokenXY(t, formation);
    const { left, top } = tokenPosNorm(x, y, canvasRect, wrapRect);
    const el = document.createElement('div');
    el.className = 'lf-player-token';
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.innerHTML = buildTokenHtml(p, pos, ovr, t.subPid, playerMap);
    tokenHost.appendChild(el);
  });

  root.querySelectorAll('[data-lineup-q]').forEach((btn) => {
    const q = Number(btn.dataset.lineupQ);
    const has = getQuarterData(save, q).tokens.length > 0;
    btn.classList.toggle('is-active', q === activeQuarter);
    btn.classList.toggle('has-players', has);
    btn.disabled = !has;
  });
}

function quarterButtonsHtml(save, activeQuarter) {
  return [1, 2, 3, 4].map((q) => {
    const has = getQuarterData(save, q).tokens.length > 0;
    const cls = [
      'lineup-q-btn',
      q === activeQuarter ? 'is-active' : '',
      has ? 'has-players' : '',
    ].filter(Boolean).join(' ');
    return `<button type="button" class="${cls}" data-lineup-q="${q}" ${has ? '' : 'disabled'}>${q}Q</button>`;
  }).join('');
}

/**
 * @param {HTMLElement} host
 * @param {{ save: object, playerMap: Map<number, object>, activeQuarter?: number, onQuarterChange?: (q:number)=>void }} opts
 */
export function mountLineupFieldPreview(host, opts) {
  const { save, playerMap, activeQuarter = firstQuarterWithLineup(save), onQuarterChange } = opts;
  if (!save) {
    host.innerHTML = '<p class="page-muted">포메이션을 선택하면 미리보기가 표시됩니다.</p>';
    return;
  }

  host.innerHTML = `
    <div class="lineup-field-view">
      <div class="lineup-field-view__head">
        <span class="lineup-field-view__formation"></span>
        <div class="lineup-field-view__quarters">${quarterButtonsHtml(save, activeQuarter)}</div>
      </div>
      <div class="lineup-field-view__wrap">
        <canvas class="lineup-field-canvas" aria-hidden="true"></canvas>
        <div class="lineup-field-tokens"></div>
      </div>
    </div>`;

  const root = host.querySelector('.lineup-field-view');
  let currentQ = activeQuarter;

  const repaint = () => {
    paintField(root, save, playerMap, currentQ);
  };

  root.querySelectorAll('[data-lineup-q]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = Number(btn.dataset.lineupQ);
      if (!q || btn.disabled) return;
      currentQ = q;
      onQuarterChange?.(q);
      repaint();
    });
  });

  repaint();

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => repaint());
    const wrap = root.querySelector('.lineup-field-view__wrap');
    if (wrap) ro.observe(wrap);
    root._lineupFieldRo = ro;
  }
}

export function destroyLineupFieldPreview(host) {
  const root = host?.querySelector?.('.lineup-field-view') || host;
  if (root?._lineupFieldRo) {
    root._lineupFieldRo.disconnect();
    delete root._lineupFieldRo;
  }
}
