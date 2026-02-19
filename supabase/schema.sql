-- 점수 테이블 (이미 적용됨 - 참고용)
-- Supabase Dashboard > SQL Editor에서 실행 가능

CREATE TABLE IF NOT EXISTS public.scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL,
  score integer NOT NULL CHECK (score >= 0),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_score_desc ON public.scores (score DESC);

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.scores;
CREATE POLICY "Allow public read" ON public.scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON public.scores;
CREATE POLICY "Allow public insert" ON public.scores FOR INSERT WITH CHECK (true);
