/** §5-2 알림함 — Supabase REST + Realtime */



import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

import { PLATFORM } from './config.js';

import { ensureValidSession, getUserId } from './auth.js';

import {

  apiLoadNotifications,

  apiMarkNotificationRead,

  apiDeleteNotification,

  isBackendReady,

} from './api.js';



/** @type {Array<{id:string,type:string,title:string,body:string,createdAt:number,readAt:number|null,deletedAt:number|null,payload:object}>} */

let cache = [];



/** @type {import('@supabase/supabase-js').SupabaseClient|null} */

let rtClient = null;

/** @type {import('@supabase/supabase-js').RealtimeChannel|null} */

let rtChannel = null;

let rtUserId = null;

let rtSubscribed = false;

let rtRetryTimer = null;



/** @type {Set<() => void>} */

const listeners = new Set();



function emitUpdate() {

  listeners.forEach((fn) => {

    try {

      fn();

    } catch (e) {

      console.warn('[notifications] listener error', e);

    }

  });

}



/** UI 갱신 콜백 등록 — unsubscribe 함수 반환 */

export function onNotificationsUpdated(fn) {

  listeners.add(fn);

  return () => listeners.delete(fn);

}



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

    emitUpdate();

    return cache;

  }

  try {

    const rows = await apiLoadNotifications(uid);

    cache = (rows || []).map(rowToItem);

  } catch {

    cache = [];

  }

  emitUpdate();

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

  emitUpdate();

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

  emitUpdate();

  if (uid && isBackendReady()) {

    try {

      await apiDeleteNotification(id, uid);

    } catch {

      /* keep optimistic UI */

    }

  }

}



function clearRtRetry() {

  if (rtRetryTimer) {

    clearTimeout(rtRetryTimer);

    rtRetryTimer = null;

  }

}



function scheduleRtRetry(delayMs = 4000) {

  clearRtRetry();

  rtRetryTimer = setTimeout(() => {

    rtRetryTimer = null;

    syncNotificationsRealtime({ force: true });

  }, delayMs);

}



export function stopNotificationsRealtime() {

  clearRtRetry();

  if (rtChannel && rtClient) {

    rtClient.removeChannel(rtChannel);

  }

  rtChannel = null;

  rtUserId = null;

  rtSubscribed = false;

}



/** 로그인 후 — notifications INSERT/UPDATE/DELETE 즉시 반영 */

export async function syncNotificationsRealtime(options = {}) {

  const { force = false } = options;

  const uid = getUserId();

  if (!uid || !isBackendReady()) {

    stopNotificationsRealtime();

    return;

  }

  if (!force && rtChannel && rtUserId === uid && rtSubscribed) return;



  stopNotificationsRealtime();



  const session = await ensureValidSession();

  if (!session?.access_token) return;



  if (!rtClient) {

    rtClient = createClient(PLATFORM.SUPABASE_URL, PLATFORM.SUPABASE_KEY, {

      auth: {

        persistSession: false,

        autoRefreshToken: false,

        detectSessionInUrl: false,

      },

      realtime: {

        params: { eventsPerSecond: 10 },

      },

    });

  }



  await rtClient.realtime.setAuth(session.access_token);

  rtUserId = uid;



  rtChannel = rtClient

    .channel(`notifications:${uid}`)

    .on(

      'postgres_changes',

      {

        event: '*',

        schema: 'public',

        table: 'notifications',

        filter: `user_id=eq.${uid}`,

      },

      () => {

        refreshNotifications();

      },

    )

    .subscribe((status, err) => {

      if (status === 'SUBSCRIBED') {

        rtSubscribed = true;

        clearRtRetry();

        return;

      }



      rtSubscribed = false;



      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {

        console.warn(

          '[notifications] realtime:',

          status,

          err?.message || '',

          '— SQL Editor에서 platform-realtime-notifications 재실행(REPLICA IDENTITY FULL)',

        );

        scheduleRtRetry();

      }

    });

}

