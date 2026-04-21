import { getSupabase } from './supabase';
import { getSupabaseUserId } from './auth';
import { enqueueScore, flushQueue } from './offline-queue';

export interface ScoreData {
  score: number;
  height: number;
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
    });

    if (error) {
      enqueueScore(data);
      return false;
    }

    // Try flushing any queued scores too
    flushQueue();
    return true;
  } catch {
    enqueueScore(data);
    return false;
  }
}
