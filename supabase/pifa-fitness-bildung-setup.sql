-- ══════════════════════════════════════════════════════
-- YuYu ↔ PIFA – Rohe Fitness/Bildung-Logs (Gym-Tage, Bücher)
-- Im Supabase Dashboard → SQL Editor ausführen
--
-- PIFA-spezifische Detail-Historie (kein YuYu-Äquivalent), wandert von AsyncStorage
-- nach Supabase für Cross-Device-Haltbarkeit. Speist zusätzlich die geteilten
-- growth_items "Training" (habits) und "Lesen" (skills) - siehe growth-items-setup.sql.
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pifa_gym_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.pifa_gym_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_row_select ON public.pifa_gym_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_row_insert ON public.pifa_gym_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_row_delete ON public.pifa_gym_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pifa_books (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  author       TEXT,
  genre        TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.pifa_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_row_select ON public.pifa_books FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_row_insert ON public.pifa_books FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_row_delete ON public.pifa_books FOR DELETE USING (auth.uid() = user_id);
