import { getSupabase } from './supabase';
import { getSupabaseUserId } from './auth';
import type { RankEntry } from '../types';

interface CachedRanking {
  data: RankEntry[];
  timestamp: number;
}

const cache: Record<string, CachedRanking> = {};
const CACHE_TTL = 30_000; // 30 seconds

export async function fetchRanking(mode: 'all' | 'weekly'): Promise<RankEntry[]> {
  const cacheKey = mode;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const sb = getSupabase();
  const userId = getSupabaseUserId();
  if (!sb) return [];

  try {
    const { data, error } = await sb.rpc('get_ranking', {
      p_user_id: userId || '00000000-0000-0000-0000-000000000000',
      p_mode: mode,
    });

    if (error || !data) return [];

    const entries: RankEntry[] = (data as Array<{
      rank: number;
      score: number;
      height: number;
      nickname: string;
      country_code: string;
      user_id: string;
    }>).map(row => ({
      rank: row.rank,
      score: row.score,
      height: row.height,
      nickname: row.nickname,
      country_code: row.country_code,
      is_me: row.user_id === userId,
    }));

    cache[cacheKey] = { data: entries, timestamp: Date.now() };
    return entries;
  } catch {
    return [];
  }
}
