-- ══════════════════════════════════════════════════════
-- yuyu_todos: verknüpfte Tugenden/Fähigkeiten persistieren
--
-- Bisher wurden linkedItems/linkedSkillIds nur im lokalen State gehalten und nie
-- gespeichert - nach jedem Login/Reload verschwanden die Verknüpfungen wieder,
-- weil die Spalten in yuyu_todos gar nicht existierten.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

ALTER TABLE public.yuyu_todos
  ADD COLUMN IF NOT EXISTS linked_items uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_skill_ids uuid[] NOT NULL DEFAULT '{}';
