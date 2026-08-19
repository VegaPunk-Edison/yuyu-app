-- ══════════════════════════════════════════════════════
-- Symptom: "alles wird doppelt gezeigt, z.B. 2x Zuverlässigkeit, Demut" - Tugenden/
-- Fähigkeiten/Gewohnheiten kommen mit demselben Namen mehrfach vor.
--
-- Root Cause (im Code gefunden, kein Rätselraten diesmal): der einmalige "lokale Daten zu
-- Supabase hochladen"-Schritt beim ersten Login (src/App.jsx, Migration localStorage →
-- growth_items) prüft nur ein PRO-BROWSER-Flag in localStorage, ob er schon gelaufen ist -
-- nicht, ob die Items serverseitig schon existieren. growth_items hat (anders als
-- growth_item_groups) auch keinen UNIQUE(user_id, type, name)-Constraint, der einen
-- doppelten Insert verhindert hätte. Wurde die App auf einem zweiten Gerät/Browser
-- geöffnet (eigenes localStorage, eigenes "schon migriert"-Flag), lief die Migration dort
-- ein zweites Mal und legte dieselben Namen erneut an. Der Code-Fix (Migration prüft jetzt
-- vorher, was serverseitig schon existiert) ist bereits ausgeliefert - dieses Skript räumt
-- die bereits entstandenen Duplikate auf.
--
-- Vorgehen pro Duplikat-Gruppe (gleicher user_id + type + Name, Groß/Kleinschreibung und
-- Leerzeichen ignoriert):
--   1. Das ÄLTESTE Item (frühestes created_at) bleibt bestehen ("keeper").
--   2. Die XP aller Duplikate werden aufsummiert und dem keeper zugewiesen - kein Fortschritt
--      geht verloren, auch wenn auf verschiedenen Geräten unterschiedlich viel XP gesammelt wurde.
--   3. Verweise aus yuyu_goals/yuyu_todos (linked_items/linked_skill_ids/linked_habit_ids)
--      auf die zu löschenden Duplikate werden VOR dem Löschen auf den keeper umgebogen -
--      sonst würden verknüpfte Ziele/Aufgaben ihre Tugend/Fähigkeit/Gewohnheit stillschweigend
--      verlieren.
--   4. Erst danach werden die überzähligen Duplikate gelöscht.
--
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

DO $$
DECLARE
  dup RECORD;
  keeper_id UUID;
  loser_id UUID;
BEGIN
  FOR dup IN
    SELECT user_id, type, lower(trim(name)) AS norm_name,
           array_agg(id ORDER BY created_at ASC) AS ids,
           SUM(xp) AS xp_sum
    FROM growth_items
    GROUP BY user_id, type, lower(trim(name))
    HAVING COUNT(*) > 1
  LOOP
    keeper_id := dup.ids[1];

    FOR i IN 2..array_length(dup.ids, 1) LOOP
      loser_id := dup.ids[i];

      UPDATE yuyu_goals
      SET linked_items = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(linked_items, loser_id, keeper_id)) AS x)
      WHERE linked_items @> ARRAY[loser_id];
      UPDATE yuyu_goals
      SET linked_skill_ids = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(linked_skill_ids, loser_id, keeper_id)) AS x)
      WHERE linked_skill_ids @> ARRAY[loser_id];
      UPDATE yuyu_goals
      SET linked_habit_ids = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(linked_habit_ids, loser_id, keeper_id)) AS x)
      WHERE linked_habit_ids @> ARRAY[loser_id];

      UPDATE yuyu_todos
      SET linked_items = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(linked_items, loser_id, keeper_id)) AS x)
      WHERE linked_items @> ARRAY[loser_id];
      UPDATE yuyu_todos
      SET linked_skill_ids = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(linked_skill_ids, loser_id, keeper_id)) AS x)
      WHERE linked_skill_ids @> ARRAY[loser_id];
      UPDATE yuyu_todos
      SET linked_habit_ids = (SELECT array_agg(DISTINCT x) FROM unnest(array_replace(linked_habit_ids, loser_id, keeper_id)) AS x)
      WHERE linked_habit_ids @> ARRAY[loser_id];

      DELETE FROM growth_items WHERE id = loser_id;
    END LOOP;

    UPDATE growth_items SET xp = dup.xp_sum WHERE id = keeper_id;
  END LOOP;
END $$;
