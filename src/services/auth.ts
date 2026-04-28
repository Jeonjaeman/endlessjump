import { getSupabase } from './supabase';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { flushQueue } from './offline-queue';

// ── 네이티브 Google Sign-In 플러그인 ─────────────────────────
interface GoogleAuthPlugin {
  signIn(opts: { webClientId: string }): Promise<{ idToken: string; email: string; displayName: string }>;
}

const GoogleAuth = registerPlugin<GoogleAuthPlugin>('GoogleAuth');

// Google Cloud Console → Web Client ID (Supabase Google Provider에 설정한 것과 동일)
const GOOGLE_WEB_CLIENT_ID = '1051100102015-ep4olnqgi0qbsu443nvti1fj5e1ckb3s.apps.googleusercontent.com';

const LOCAL_UUID_KEY = 'bh_local_uuid';
const PROFILE_KEY = 'bh_profile';
const LINKED_KEY = 'bh_account_linked';

export interface LocalProfile {
  nickname: string;
  country_code: string;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export function getLocalUUID(): string {
  let uuid = localStorage.getItem(LOCAL_UUID_KEY);
  if (!uuid) {
    uuid = generateUUID();
    localStorage.setItem(LOCAL_UUID_KEY, uuid);
  }
  return uuid;
}

export function getLocalProfile(): LocalProfile {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }
  return { nickname: 'Bunny', country_code: 'KR' };
}

export function saveLocalProfile(profile: LocalProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

let supabaseUserId: string | null = null;
let supabaseUserEmail: string | null = null;

export function getSupabaseUserId(): string | null {
  return supabaseUserId;
}

export function getSupabaseUserEmail(): string | null {
  return supabaseUserEmail;
}

export async function initAuth(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // Check existing session (Google or anonymous)
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      supabaseUserId = session.user.id;
      supabaseUserEmail = session.user.email ?? null;
      // Google 연결 상태 감지
      if (session.user.app_metadata?.provider === 'google'
          || (session.user.identities ?? []).some((i: any) => i.provider === 'google')) {
        localStorage.setItem(LINKED_KEY, '1');
      }
      await ensureProfile();
      flushQueue();
      return supabaseUserId;
    }

    // 이전에 Google 연결했으면 세션이 만료된 경우만 재로그인 시도
    if (localStorage.getItem(LINKED_KEY) === '1' && Capacitor.isNativePlatform()) {
      try {
        const { idToken } = await GoogleAuth.signIn({ webClientId: GOOGLE_WEB_CLIENT_ID });
        const { data: signInData, error: signInError } = await sb.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });
        if (!signInError && signInData.user) {
          supabaseUserId = signInData.user.id;
          supabaseUserEmail = signInData.user.email ?? null;
          await ensureProfile();
          flushQueue();
          return supabaseUserId;
        }
      } catch {
        // 자동 로그인 실패 → 익명으로 폴백
      }
    }

    // Anonymous sign-in
    const { data, error } = await sb.auth.signInAnonymously();
    if (error || !data.user) return null;

    supabaseUserId = data.user.id;
    supabaseUserEmail = data.user.email ?? null;
    await ensureProfile();
    flushQueue();
    return supabaseUserId;
  } catch {
    return null;
  }
}

// ── Google 계정 연결 ─────────────────────────────────────────
export function isAccountLinked(): boolean {
  return localStorage.getItem(LINKED_KEY) === '1';
}

export async function linkGoogleAccount(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    // 네이티브 Google Sign-In으로 ID 토큰 획득
    if (!Capacitor.isNativePlatform()) {
      // 웹 폴백: redirect 방식
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      return !error && !!data;
    }

    const { idToken } = await GoogleAuth.signIn({ webClientId: GOOGLE_WEB_CLIENT_ID });

    // Supabase에 ID 토큰으로 로그인
    const { data, error } = await sb.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error || !data.user) return false;

    supabaseUserId = data.user.id;
    localStorage.setItem(LINKED_KEY, '1');
    await ensureProfile();
    flushQueue();
    return true;
  } catch (e: any) {
    if (e?.message?.includes('USER_CANCELED')) return false;
    console.warn('[Auth] Google 연결 실패:', e);
    return false;
  }
}

async function ensureProfile(): Promise<void> {
  const sb = getSupabase();
  if (!sb || !supabaseUserId) return;

  const localProfile = getLocalProfile();
  const localUUID = getLocalUUID();

  const { data } = await sb.from('profiles')
    .select('id')
    .eq('id', supabaseUserId)
    .single();

  if (!data) {
    await sb.from('profiles').insert({
      id: supabaseUserId,
      nickname: localProfile.nickname,
      country_code: localProfile.country_code,
      local_uuid: localUUID,
    });
  }
}

export async function updateProfile(profile: LocalProfile): Promise<void> {
  saveLocalProfile(profile);

  const sb = getSupabase();
  if (!sb || !supabaseUserId) return;

  await sb.from('profiles').update({
    nickname: profile.nickname,
    country_code: profile.country_code,
  }).eq('id', supabaseUserId);
}
