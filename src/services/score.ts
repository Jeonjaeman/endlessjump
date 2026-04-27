import { getSupabase } from './supabase';
import { getSupabaseUserId } from './auth';
import { enqueueScore, flushQueue } from './offline-queue';

export interface ScoreData {
  score: number;
  height: number;
  skin_id?: string;
  comment?: string;
}

export async function submitScore(data: ScoreData): Promise<boolean> {
  const sb = getSupabase();
  const userId = getSupabaseUserId();

  if (!sb || !userId) {
    enqueueScore(data);
    return false;
  }

  try {
    const { error } = await sb.from('scores').insert({
      user_id: userId,
      score: data.score,
      height: data.height,
      skin_id: data.skin_id ?? 'default',
      comment: data.comment ?? null,
    });

    if (error) {
      enqueueScore(data);
      return false;
    }

    flushQueue();
    return true;
  } catch {
    enqueueScore(data);
    return false;
  }
}
