-- ══════════════════════════════════════════════════════
-- Gewohnheiten-Verknüpfung + Nachrüsten der bisher fehlenden Tugenden/Fähigkeiten-
-- Persistenz bei Zielen
--
-- yuyu_todos: linked_items/linked_skill_ids gab es schon (siehe todos-add-linked-items.sql),
-- linked_habit_ids kommt hier dazu.
-- yuyu_goals: hatte bisher GAR KEINE dieser drei Spalten - verknüpfte Tugenden/Fähigkeiten
-- wurden nie gespeichert (nur im lokalen State), gingen nach jedem Login verloren.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

ALTER TABLE public.yuyu_todos
  ADD COLUMN IF NOT EXISTS linked_habit_ids uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.yuyu_goals
  ADD COLUMN IF NOT EXISTS linked_items uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_skill_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_habit_ids uuid[] NOT NULL DEFAULT '{}';
