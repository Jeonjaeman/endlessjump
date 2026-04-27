-- ================================================================
-- BunnyHop Supabase Migration Script
-- Run this in: Supabase SQL Editor (Project > SQL Editor)
-- ================================================================

-- 1. Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT 'Bunny',
  country_code TEXT DEFAULT 'KR',
  local_uuid TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  height INTEGER NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create get_ranking RPC function
CREATE OR REPLACE FUNCTION get_ranking(
  p_user_id UUID,
  p_mode TEXT  -- 'all' or 'weekly'
)
RETURNS TABLE (
  rank BIGINT,
  score INTEGER,
  height INTEGER,
  nickname TEXT,
  country_code TEXT,
  user_id UUID,
  is_me BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mode = 'weekly' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        s.user_id,
        s.score,
        s.height,
        p.nickname,
        p.country_code,
        ROW_NUMBER() OVER (ORDER BY s.height DESC, s.score DESC, s.created_at ASC) AS rank
      FROM scores s
      JOIN profiles p ON p.id = s.user_id
      WHERE s.played_at >= NOW() - INTERVAL '7 days'
    )
    SELECT
      r.rank,
      r.score,
      r.height,
      r.nickname,
      r.country_code,
      r.user_id,
      (r.user_id = p_user_id) AS is_me
    FROM ranked r
    ORDER BY r.rank;
  ELSE
    RETURN QUERY
    WITH ranked AS (
      SELECT
        s.user_id,
        s.score,
        s.height,
        p.nickname,
        p.country_code,
        ROW_NUMBER() OVER (ORDER BY s.height DESC, s.score DESC, s.created_at ASC) AS rank
      FROM scores s
      JOIN profiles p ON p.id = s.user_id
    )
    SELECT
      r.rank,
      r.score,
      r.height,
      r.nickname,
      r.country_code,
      r.user_id,
      (r.user_id = p_user_id) AS is_me
    FROM ranked r
    ORDER BY r.rank;
  END IF;
END;
$$;

-- 5. Create index for performance
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_played_at ON scores(played_at);
CREATE INDEX IF NOT EXISTS idx_scores_height ON scores(height DESC);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 8. RLS Policies for scores
DROP POLICY IF EXISTS "Anyone can insert scores" ON scores;
CREATE POLICY "Anyone can insert scores" ON scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view scores" ON scores;
CREATE POLICY "Anyone can view scores" ON scores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own scores" ON scores;
CREATE POLICY "Users can update own scores" ON scores
  FOR UPDATE USING (auth.uid() = user_id);

-- 9. Verify function works (test call)
-- SELECT * FROM get_ranking('00000000-0000-0000-0000-000000000000', 'all') LIMIT 5;

-- ================================================================
-- Migration: Add comment and skin_id to scores
-- Run in Supabase SQL Editor after initial migration
-- ================================================================

ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS comment TEXT CHECK (char_length(comment) <= 100),
  ADD COLUMN IF NOT EXISTS skin_id TEXT DEFAULT 'default';

DROP FUNCTION IF EXISTS get_ranking(uuid, text);

CREATE OR REPLACE FUNCTION get_ranking(
  p_user_id UUID,
  p_mode TEXT
)
RETURNS TABLE (
  rank BIGINT,
  score INTEGER,
  height INTEGER,
  nickname TEXT,
  country_code TEXT,
  user_id UUID,
  is_me BOOLEAN,
  comment TEXT,
  skin_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_mode = 'weekly' THEN
    RETURN QUERY
    WITH ranked AS (
      SELECT
        s.user_id,
        s.score,
        s.height,
        p.nickname,
        p.country_code,
        s.comment,
        s.skin_id,
        ROW_NUMBER() OVER (ORDER BY s.height DESC, s.score DESC, s.created_at ASC) AS rank
      FROM scores s
      JOIN profiles p ON p.id = s.user_id
      WHERE s.played_at >= NOW() - INTERVAL '7 days'
    )
    SELECT r.rank, r.score, r.height, r.nickname, r.country_code,
           r.user_id, (r.user_id = p_user_id) AS is_me, r.comment, r.skin_id
    FROM ranked r ORDER BY r.rank;
  ELSE
    RETURN QUERY
    WITH ranked AS (
      SELECT
        s.user_id,
        s.score,
        s.height,
        p.nickname,
        p.country_code,
        s.comment,
        s.skin_id,
        ROW_NUMBER() OVER (ORDER BY s.height DESC, s.score DESC, s.created_at ASC) AS rank
      FROM scores s
      JOIN profiles p ON p.id = s.user_id
    )
    SELECT r.rank, r.score, r.height, r.nickname, r.country_code,
           r.user_id, (r.user_id = p_user_id) AS is_me, r.comment, r.skin_id
    FROM ranked r ORDER BY r.rank;
  END IF;
END;
$$;
