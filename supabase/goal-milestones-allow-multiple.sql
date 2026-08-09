-- ══════════════════════════════════════════════════════
-- Symptom: "ich kann nur ein Meilenstein hinzufügen" - das erste Meilenstein-Insert
-- klappt, jedes weitere für dasselbe Ziel schlägt (bisher unbemerkt, da der Fehler
-- nicht angezeigt wurde) fehl.
--
-- Wahrscheinlichste Ursache: yuyu_goal_milestones wurde (wie yuyu_goals/yuyu_todos)
-- nie per getrackter SQL angelegt, sondern von Hand - dabei kam vermutlich ein
-- PRIMARY KEY/UNIQUE-Constraint allein auf goal_id zustande (als gäbe es nur einen
-- Meilenstein pro Ziel), statt auf id. Das lässt pro Ziel nur eine einzige Zeile zu.
--
-- Dieses Skript sucht dynamisch nach genau so einem Constraint (PK oder UNIQUE,
-- ausschließlich auf die Spalte goal_id) und entfernt ihn - id bleibt unangetastet.
-- Existiert kein solcher Constraint, ist das Skript ein No-Op.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'yuyu_goal_milestones'
      AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    GROUP BY tc.constraint_name
    HAVING COUNT(*) = 1 AND bool_and(kcu.column_name = 'goal_id')
  LOOP
    EXECUTE format('ALTER TABLE public.yuyu_goal_milestones DROP CONSTRAINT %I', r.constraint_name);
  END LOOP;
END $$;
