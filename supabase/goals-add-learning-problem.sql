-- ══════════════════════════════════════════════════════
-- YuYu – Ziel-Formular um "Was muss ich lernen?" und "Welches Problem löst du?" erweitert
-- Im Supabase Dashboard → SQL Editor ausführen
-- ══════════════════════════════════════════════════════

ALTER TABLE public.yuyu_goals ADD COLUMN IF NOT EXISTS learning_goal TEXT;
ALTER TABLE public.yuyu_goals ADD COLUMN IF NOT EXISTS problem TEXT;
