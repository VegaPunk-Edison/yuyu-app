-- ══════════════════════════════════════════════════════
-- Aufgaben lassen sich jetzt direkt mit einem Ziel verknüpfen (nicht nur über
-- den Lebensbereich) - sichtbar/verwaltbar sowohl in der Aufgaben-Detailansicht
-- als auch in der neuen Ziel-Detailansicht.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

ALTER TABLE public.yuyu_todos
  ADD COLUMN IF NOT EXISTS goal_id uuid;
