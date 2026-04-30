import { getSupabase } from './supabase';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { flushQueue, clearQueue } from './offline-queue';

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
      await checkProfileExists();
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
          await checkProfileExists();
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
    await checkProfileExists();
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

  // Google 전환 전에 현재 닉네임/프로필 보존
  const savedProfile = getLocalProfile();

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
    supabaseUserEmail = data.user.email ?? null;
    localStorage.setItem(LINKED_KEY, '1');

    // 보존한 프로필로 localStorage 복원 (signIn이 초기화할 수 있으므로)
    saveLocalProfile(savedProfile);

    await checkProfileExists();
    clearQueue(); // 익명 점수 큐 삭제 (Google 계정으로 새 시작)
    return true;
  } catch (e: any) {
    if (e?.message?.includes('USER_CANCELED')) return false;
    console.warn('[Auth] Google 연결 실패:', e);
    return false;
  }
}

/**
 * CHECK-ONLY: DB 프로필 존재 여부 확인. 존재하면 localStorage에 동기화 + bh_profile_set 설정.
 * 신규 유저는 false 반환, bh_profile_set 미설정, 프로필 생성 안 함.
 */
export async function checkProfileExists(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || !supabaseUserId) return false;

  const { data } = await sb.from('profiles')
    .select('id, nickname, country_code')
    .eq('id', supabaseUserId)
    .single();

  if (data) {
    const dbProfile: LocalProfile = {
      nickname: data.nickname ?? getLocalProfile().nickname,
      country_code: data.country_code ?? getLocalProfile().country_code,
    };
    saveLocalProfile(dbProfile);
    localStorage.setItem('bh_profile_set', '1');
    return true;
  }
  return false; // 신규 유저 — 플래그 미설정, 프로필 미생성
}

/**
 * CREATE: 닉네임 모달 저장 후 호출. 중복 체크 + DB insert + bh_profile_set 설정.
 */
export async function createProfile(nickname: string, countryCode: string): Promise<void> {
  const sb = getSupabase();
  if (!sb || !supabaseUserId) return;

  const resolvedNick = await resolveUniqueNickname(sb, nickname, supabaseUserId);

  await sb.from('profiles').insert({
    id: supabaseUserId,
    nickname: resolvedNick,
    country_code: countryCode,
    local_uuid: getLocalUUID(),
  });

  saveLocalProfile({ nickname: resolvedNick, country_code: countryCode });
  localStorage.setItem('bh_profile_set', '1');
}

/** 닉네임 중복 시 숫자 접미사를 붙여 유니크한 닉네임 반환 */
async function resolveUniqueNickname(
  sb: ReturnType<typeof getSupabase>,
  nickname: string,
  userId: string,
): Promise<string> {
  if (!sb) return nickname;

  const { data } = await sb.from('profiles')
    .select('id')
    .ilike('nickname', nickname)
    .neq('id', userId)
    .limit(1);

  if (!data || data.length === 0) return nickname;

  for (let i = 1; i <= 99; i++) {
    const suffix = `${i}`;
    const candidate = nickname.length + suffix.length > 12
      ? nickname.slice(0, 12 - suffix.length) + suffix
      : nickname + suffix;

    const { data: dup } = await sb.from('profiles')
      .select('id')
      .ilike('nickname', candidate)
      .neq('id', userId)
      .limit(1);

    if (!dup || dup.length === 0) return candidate;
  }

  return nickname + Math.floor(Math.random() * 1000);
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
