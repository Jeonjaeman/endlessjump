/**
 * 일일 업적 시스템
 *
 * - 일일 업적 5개 (매일 자정 리셋)
 * - 달성 여부 추적
 * - localStorage로 저장/로드
 * - game.ts에서 이벤트 발생 시 체크
 */

import type { Achievement } from '../types';

// ── localStorage 키 ──────────────────────────────────────────
const STORAGE_KEY_ACHIEVEMENTS = 'bh_achievements';
const STORAGE_KEY_LAST_RESET = 'bh_achievement_reset_date';

// ── 일일 업적 템플릿 ────────────────────────────────────────
function createDailyAchievements(): Achievement[] {
  return [
    {
      id: 'daily_score_50',
      name: '점수 사냥꾼',
      description: '한 판에 50점 달성',
      icon: '🎯',
      target: 50,
      current: 0,
      completed: false,

      type: 'daily',
    },
    {
      id: 'daily_height_1000',
      name: '하늘 높이',
      description: '1000mm 높이 도달',
      icon: '🚀',
      target: 1000,
      current: 0,
      completed: false,

      type: 'daily',
    },
    {
      id: 'daily_golden_3',
      name: '황금 수집가',
      description: '골든 당근 3개 먹기',
      icon: '✨',
      target: 3,
      current: 0,
      completed: false,

      type: 'daily',
    },
    {
      id: 'daily_games_5',
      name: '열정 플레이어',
      description: '5판 플레이',
      icon: '🔥',
      target: 5,
      current: 0,
      completed: false,

      type: 'daily',
    },
    {
      id: 'daily_carrots_100',
      name: '당근 먹방',
      description: '당근 100개 먹기 (누적)',
      icon: '🥕',
      target: 100,
      current: 0,
      completed: false,

      type: 'daily',
    },
  ];
}

// ── 상태 ────────────────────────────────────────────────────
let achievements: Achievement[] = [];

/** 최근 달성된 업적 (팝업 표시용) */
let recentlyCompleted: Achievement[] = [];

// ── 날짜 비교 유틸 ──────────────────────────────────────────
function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shouldResetDaily(): boolean {
  const lastReset = localStorage.getItem(STORAGE_KEY_LAST_RESET);
  return lastReset !== getTodayString();
}

// ── 저장/로드 ───────────────────────────────────────────────
function save(): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACHIEVEMENTS, JSON.stringify(achievements));
    localStorage.setItem(STORAGE_KEY_LAST_RESET, getTodayString());
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

function load(): void {
  try {
    if (shouldResetDaily()) {
      // 일일 업적 리셋
      achievements = createDailyAchievements();
      save();
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
    if (stored) {
      achievements = JSON.parse(stored) as Achievement[];
    } else {
      achievements = createDailyAchievements();
    }
  } catch {
    achievements = createDailyAchievements();
  }
}

// ── 초기화 ──────────────────────────────────────────────────
export function initAchievements(): void {
  load();
}

// ── 업적 목록 조회 ──────────────────────────────────────────
export function getAchievements(): Achievement[] {
  return achievements;
}

// ── 최근 달성 업적 팝업 가져오기 (가져온 뒤 비움) ────────────
export function popRecentlyCompleted(): Achievement[] {
  const result = [...recentlyCompleted];
  recentlyCompleted = [];
  return result;
}

// ── 업적 진행도 업데이트 (내부 공통) ────────────────────────
function updateProgress(id: string, value: number): void {
  const ach = achievements.find(a => a.id === id);
  if (!ach || ach.completed) return;

  ach.current = Math.min(value, ach.target);

  if (ach.current >= ach.target) {
    ach.completed = true;
    recentlyCompleted.push({ ...ach });
  }

  save();
}

// ── 게임 이벤트 핸들러 (game.ts에서 호출) ───────────────────

/** 게임 오버 시 호출 — 점수/높이 기반 업적 체크 + 플레이 횟수 */
export function onGameOver(score: number, heightMm: number): void {
  // 점수 업적: 한 판 최고 점수 기준
  const scoreAch = achievements.find(a => a.id === 'daily_score_50');
  if (scoreAch && !scoreAch.completed && score > scoreAch.current) {
    updateProgress('daily_score_50', score);
  }

  // 높이 업적: 한 판 최고 높이 기준
  const heightAch = achievements.find(a => a.id === 'daily_height_1000');
  if (heightAch && !heightAch.completed && heightMm > heightAch.current) {
    updateProgress('daily_height_1000', heightMm);
  }

  // 플레이 횟수 누적
  const gamesAch = achievements.find(a => a.id === 'daily_games_5');
  if (gamesAch && !gamesAch.completed) {
    updateProgress('daily_games_5', gamesAch.current + 1);
  }
}

/** 당근 먹을 때 호출 (type: 'normal' | 'special') */
export function onCarrotEaten(type: 'normal' | 'special'): void {
  // 전체 당근 누적
  const carrotAch = achievements.find(a => a.id === 'daily_carrots_100');
  if (carrotAch && !carrotAch.completed) {
    updateProgress('daily_carrots_100', carrotAch.current + 1);
  }

  // 골든 당근 누적
  if (type === 'special') {
    const goldenAch = achievements.find(a => a.id === 'daily_golden_3');
    if (goldenAch && !goldenAch.completed) {
      updateProgress('daily_golden_3', goldenAch.current + 1);
    }
  }
}
