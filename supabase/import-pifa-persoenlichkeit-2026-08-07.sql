-- ══════════════════════════════════════════════════════
-- Import der "Persönlichkeit"-Seite von pifa-esports.store/me nach YuYu
-- Rekonstruiert aus Screenshots vom 7.8.2026.
--
-- Mapping:
--   Tugend & Werte              -> Oberkategorie "PIFA Tugenden" (type=principles)
--   Gewohnheiten & Fähigkeiten  -> Oberkategorie "PIFA Fähigkeit" (type=skills)
--   Fitness & Bildung           -> Oberkategorie "PIFA Fitness"   (type=habits)
--
-- Dedupe: Tugenden dürfen laut Vorgabe nie doppelt vorkommen, egal in welcher
-- Oberkategorie - deshalb typübergreifende NOT EXISTS-Prüfung (nicht nur pro Gruppe).
-- Gleiche Prüfung auch für Fähigkeiten/Gewohnheiten angewandt: "Buch lesen" existiert
-- bereits als Gewohnheit in der Oberkategorie "PAC" und wird deshalb übersprungen.
--
-- Idempotent, sicher mehrfach ausführbar. Im Supabase SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id uuid;
  v_group_pifa_tugenden uuid;
  v_group_pifa_faehigkeit uuid;
  v_group_pifa_fitness uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'silbernes@icloud.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein auth.users-Eintrag mit dieser E-Mail gefunden - bitte E-Mail oben im Skript korrigieren.';
  END IF;

  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'principles', 'PIFA Tugenden')
    ON CONFLICT (user_id, type, name) DO NOTHING;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'skills', 'PIFA Fähigkeit')
    ON CONFLICT (user_id, type, name) DO NOTHING;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'PIFA Fitness')
    ON CONFLICT (user_id, type, name) DO NOTHING;

  SELECT id INTO v_group_pifa_tugenden FROM growth_item_groups WHERE user_id = v_user_id AND type = 'principles' AND name = 'PIFA Tugenden';
  SELECT id INTO v_group_pifa_faehigkeit FROM growth_item_groups WHERE user_id = v_user_id AND type = 'skills' AND name = 'PIFA Fähigkeit';
  SELECT id INTO v_group_pifa_fitness FROM growth_item_groups WHERE user_id = v_user_id AND type = 'habits' AND name = 'PIFA Fitness';

  -- Tugend & Werte -> PIFA Tugenden (typübergreifende Dedupe-Prüfung)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'principles', v_group_pifa_tugenden, x.name, 0, x.ord
  FROM (VALUES ('Disziplin', 0), ('Teamgeist', 1), ('Resilienz', 2)) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.user_id = v_user_id AND gi.type = 'principles' AND gi.name = x.name);

  -- Gewohnheiten & Fähigkeiten -> PIFA Fähigkeit
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'skills', v_group_pifa_faehigkeit, x.name, 0, x.ord
  FROM (VALUES ('Fokus', 0), ('Routine', 1), ('Mechanik', 2)) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.user_id = v_user_id AND gi.type = 'skills' AND gi.name = x.name);

  -- Fitness & Bildung -> PIFA Fitness ("Buch lesen" existiert schon in Gruppe "PAC", wird übersprungen)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'habits', v_group_pifa_fitness, x.name, 0, x.ord
  FROM (VALUES
    ('Gym', 0), ('eSport', 1), ('Buch lesen', 2), ('Seminar/Webinar buchen', 3),
    ('Finanzielle Bildung', 4), ('Kultur', 5), ('Geschichte', 6)
  ) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.user_id = v_user_id AND gi.type = 'habits' AND gi.name = x.name);
END $$;
