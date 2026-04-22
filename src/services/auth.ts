import { getSupabase } from './supabase';
import { flushQueue } from './offline-queue';

const LOCAL_UUID_KEY = 'bh_local_uuid';
const PROFILE_KEY = 'bh_profile';

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
    // Check existing session
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      supabaseUserId = session.user.id;
      await ensureProfile();
      // 기존 세션 복원 시에도 오프라인 큐 플러시
      flushQueue();
      return supabaseUserId;
    }

    // Anonymous sign-in
    const { data, error } = await sb.auth.signInAnonymously();
    if (error || !data.user) return null;

    supabaseUserId = data.user.id;
    await ensureProfile();
    // 앱 시작 시 오프라인 큐 플러시
    flushQueue();
    return supabaseUserId;
  } catch {
    return null;
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
