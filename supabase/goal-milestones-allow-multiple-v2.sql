-- ══════════════════════════════════════════════════════
-- Folgefix zu goal-milestones-allow-multiple.sql: das Problem "nur ein Meilenstein pro
-- Ziel möglich" besteht laut Nutzer trotz ausgeführter Vorgänger-Migration weiter, sogar
-- beim allerersten Meilenstein.
--
-- Die Vorgänger-Migration durchsucht nur information_schema.table_constraints - das
-- erfasst per ALTER TABLE ... ADD CONSTRAINT UNIQUE(...)/PK angelegte Constraints, aber
-- NICHT einen freistehenden, von Hand per CREATE UNIQUE INDEX angelegten Index ohne
-- begleitenden Constraint. Genau so ein Index würde weiterhin jeden zweiten (oder sogar
-- schon den ersten, falls noch eine alte Test-Zeile in der Tabelle steht) Insert für
-- dasselbe goal_id blockieren, ohne dass die Vorgänger-Migration ihn findet.
--
-- Dieses Skript wiederholt zur Sicherheit die Constraint-Suche und ergänzt zusätzlich eine
-- Suche über pg_index/pg_class/pg_attribute nach genau so einem freistehenden UNIQUE-Index
-- auf ausschließlich die Spalte goal_id - Primary-Key-Indizes werden ausgeschlossen (die
-- gehören zu id, nicht goal_id, und werden ohnehin über einen Constraint entfernt, falls
-- vorhanden). Beide Suchen sind dynamisch und No-Op, falls nichts (mehr) gefunden wird.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  -- 1) PK/UNIQUE-Constraints allein auf goal_id (zur Sicherheit erneut geprüft).
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

  -- 2) Freistehende UNIQUE-Indizes allein auf goal_id, die KEINEM Constraint zugeordnet sind.
  FOR r IN
    SELECT ic.relname AS index_name
    FROM pg_index i
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_class tc ON tc.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = tc.relnamespace
    WHERE n.nspname = 'public'
      AND tc.relname = 'yuyu_goal_milestones'
      AND i.indisunique
      AND NOT i.indisprimary
      AND i.indnatts = 1
      AND (SELECT attname FROM pg_attribute WHERE attrelid = tc.oid AND attnum = i.indkey[0]) = 'goal_id'
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
  END LOOP;
END $$;
