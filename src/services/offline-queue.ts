import { getSupabase } from './supabase';
import { getSupabaseUserId } from './auth';
import type { ScoreData } from './score';

const QUEUE_KEY = 'bh_score_queue';
const MAX_QUEUE = 50;

interface QueuedScore extends ScoreData {
  played_at: string;
}

function readQueue(): QueuedScore[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function writeQueue(queue: QueuedScore[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueScore(data: ScoreData): void {
  const queue = readQueue();
  const entry: QueuedScore = {
    ...data,
    played_at: new Date().toISOString(),
  };

  queue.push(entry);

  // FIFO: drop lowest scores if over max
  if (queue.length > MAX_QUEUE) {
    queue.sort((a, b) => b.score - a.score);
    queue.length = MAX_QUEUE;
  }

  writeQueue(queue);
}

/** 익명 점수 큐 전체 삭제 (Google 연동 시 사용) */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;

  const sb = getSupabase();
  const userId = getSupabaseUserId();
  if (!sb || !userId) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  flushing = true;

  for (const entry of queue) {
    try {
      const { error } = await sb.from('scores').insert({
        user_id: userId,
        score: entry.score,
        height: entry.height,
        played_at: entry.played_at,
      });

      if (error) {
        console.warn('[Queue] flush error, discarding entry:', error.code, error.message);
      }
    } catch (e) {
      console.warn('[Queue] flush exception, discarding entry:', e);
    }

    // 1 second delay between submissions (rate limiting)
    await new Promise(r => setTimeout(r, 1000));
  }

  writeQueue([]);
  flushing = false;
}
