import { getSupabase } from './supabase';
import { flushQueue } from './offline-queue';

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

export function getSupabaseUserId(): string | null {
  return supabaseUserId;
}

export async function initAuth(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;

  try {
    // Check existing session (Google or anonymous)
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      supabaseUserId = session.user.id;
      // Google 연결 상태 감지
      if (session.user.app_metadata?.provider === 'google'
          || (session.user.identities ?? []).some((i: any) => i.provider === 'google')) {
        localStorage.setItem(LINKED_KEY, '1');
      }
      await ensureProfile();
      flushQueue();
      return supabaseUserId;
    }

    // 이전에 Google 연결했으면 Google 로그인 시도
    if (localStorage.getItem(LINKED_KEY) === '1') {
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (!error && data) {
        // OAuth redirect 진행 — 페이지 리로드 후 위의 getSession에서 세션 복원
        return null;
      }
      // Google 로그인 실패 시 익명으로 폴백
    }

    // Anonymous sign-in
    const { data, error } = await sb.auth.signInAnonymously();
    if (error || !data.user) return null;

    supabaseUserId = data.user.id;
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
    const { data, error } = await sb.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error || !data) return false;
    // OAuth redirect 진행 — 복귀 후 initAuth의 getSession에서 linked 감지
    localStorage.setItem(LINKED_KEY, '1');
    return true;
  } catch {
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
