-- ══════════════════════════════════════════════════════
-- Nachrüst-Migration: yuyu_goals fehlten mehrere Spalten in der echten
-- Supabase-Tabelle (nie per SQL im Repo getrackt, nur handangelegt).
-- Konkreter Fehler beim Speichern eines Ziels:
--   "Could not find the 'learning_goal' column of 'yuyu_goals' in the schema cache"
--
-- Diese Migration rüstet defensiv ALLE Spalten nach, die die App beim
-- Insert/Update tatsächlich verwendet, damit kein weiteres Feld fehlt.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

ALTER TABLE public.yuyu_goals
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS learning_goal text,
  ADD COLUMN IF NOT EXISTS problem text,
  ADD COLUMN IF NOT EXISTS life_area text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS linked_items uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_skill_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_habit_ids uuid[] NOT NULL DEFAULT '{}';
