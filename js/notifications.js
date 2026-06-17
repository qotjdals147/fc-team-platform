/** §5-2 알림함 — 목 데이터 (추후 Supabase notifications 연동) */

const STORE_KEY = 'fc_platform_notifications';

const seed = () => [
  {
    id: '1',
    type: 'invite',
    title: '구단 초대',
    body: 'FC 블루에서 초대가 왔습니다.',
    createdAt: Date.now() - 3600000,
    readAt: null,
    deletedAt: null,
    payload: { tab: 'profile' },
  },
  {
    id: '2',
    type: 'match_result',
    title: '매칭 미성사',
    body: '서울 FC · 6/20 14:00 경기 신청이 다른 팀과 확정되어 성사되지 않았습니다.',
    createdAt: Date.now() - 7200000,
    readAt: null,
    deletedAt: null,
    payload: { tab: 'matching', postId: 'demo' },
  },
  {
    id: '3',
    type: 'match_apply',
    title: '매칭 신청',
    body: '강남 유나이티드가 매칭 공고에 신청했습니다.',
    createdAt: Date.now() - 86400000,
    readAt: Date.now() - 80000000,
    deletedAt: null,
    payload: { tab: 'matching' },
  },
];

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  const items = seed();
  save(items);
  return items;
}

function save(items) {
  localStorage.setItem(STORE_KEY, JSON.stringify(items));
}

export function getNotifications() {
  return load().filter((n) => !n.deletedAt);
}

export function unreadCount() {
  return getNotifications().filter((n) => !n.readAt).length;
}

export function markRead(id) {
  const items = load();
  const n = items.find((x) => x.id === id);
  if (n && !n.readAt) n.readAt = Date.now();
  save(items);
}

export function removeNotification(id) {
  const items = load();
  const n = items.find((x) => x.id === id);
  if (n) n.deletedAt = Date.now();
  save(items);
}

export function resetDemoNotifications() {
  localStorage.removeItem(STORE_KEY);
}
