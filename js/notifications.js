/** §5-2 알림함 — Supabase notifications 연동 */

import { getUserId } from './auth.js';
import {
  apiLoadNotifications,
  apiMarkNotificationRead,
  apiDeleteNotification,
  isBackendReady,
} from './api.js';

/** @type {Array<{id:string,type:string,title:string,body:string,createdAt:number,readAt:number|null,deletedAt:number|null,payload:object}>} */
let cache = [];

function rowToItem(r) {
  return {
    id: String(r.id),
    type: r.type,
    title: r.title,
    body: r.body || '',
    createdAt: new Date(r.created_at).getTime(),
    readAt: r.read_at ? new Date(r.read_at).getTime() : null,
    deletedAt: r.deleted_at ? new Date(r.deleted_at).getTime() : null,
    payload: r.payload || {},
  };
}

export async function refreshNotifications() {
  const uid = getUserId();
  if (!uid || !isBackendReady()) {
    cache = [];
    return cache;
  }
  try {
    const rows = await apiLoadNotifications(uid);
    cache = (rows || []).map(rowToItem);
  } catch {
    cache = [];
  }
  return cache;
}

export function getNotifications() {
  return cache.filter((n) => !n.deletedAt);
}

export function unreadCount() {
  return getNotifications().filter((n) => !n.readAt).length;
}

export async function markRead(id) {
  const uid = getUserId();
  const n = cache.find((x) => x.id === id);
  if (n && !n.readAt) n.readAt = Date.now();
  if (uid && isBackendReady()) {
    try {
      await apiMarkNotificationRead(id, uid);
    } catch {
      /* keep optimistic UI */
    }
  }
}

export async function removeNotification(id) {
  const uid = getUserId();
  const n = cache.find((x) => x.id === id);
  if (n) n.deletedAt = Date.now();
  if (uid && isBackendReady()) {
    try {
      await apiDeleteNotification(id, uid);
    } catch {
      /* keep optimistic UI */
    }
  }
}
