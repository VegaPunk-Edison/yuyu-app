-- ══════════════════════════════════════════════════════
-- Wiederherstellung verlorener Tugenden/Gewohnheiten/Fähigkeiten
-- Rekonstruiert aus Screenshots vom 6.8.2026, da die Migration beim Login
-- nie erfolgreich nach growth_items/growth_item_groups geschrieben hat.
--
-- Idempotent: überspringt Oberkategorien/Items, die schon existieren (z.B. weil
-- die App-Migration nach dem Fix in commit 2f3d3ff zwischenzeitlich bereits einen
-- Teil selbst nachgeholt hat). Sicher mehrfach ausführbar.
--
-- WICHTIG: Vor dem Ausführen prüfen, dass die E-Mail unten wirklich die ist,
-- mit der bei YuYu/PIFA eingeloggt wird - sonst landen die Daten am falschen Account.
-- Im Supabase SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id uuid;
  v_group_christentum uuid;
  v_group_esport uuid;
  v_group_pilgrim uuid;
  v_group_coachnika uuid;
  v_group_pac uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'silbernes@icloud.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein auth.users-Eintrag mit dieser E-Mail gefunden - bitte E-Mail oben im Skript korrigieren.';
  END IF;

  -- Oberkategorien: bereits vorhandene (gleicher user_id/type/name) werden übersprungen
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'principles', 'Christentum')
    ON CONFLICT (user_id, type, name) DO NOTHING;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'skills', 'eSport ProClubs')
    ON CONFLICT (user_id, type, name) DO NOTHING;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'Pilgrim')
    ON CONFLICT (user_id, type, name) DO NOTHING;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'Coach Nika')
    ON CONFLICT (user_id, type, name) DO NOTHING;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'PAC')
    ON CONFLICT (user_id, type, name) DO NOTHING;

  SELECT id INTO v_group_christentum FROM growth_item_groups WHERE user_id = v_user_id AND type = 'principles' AND name = 'Christentum';
  SELECT id INTO v_group_esport FROM growth_item_groups WHERE user_id = v_user_id AND type = 'skills' AND name = 'eSport ProClubs';
  SELECT id INTO v_group_pilgrim FROM growth_item_groups WHERE user_id = v_user_id AND type = 'habits' AND name = 'Pilgrim';
  SELECT id INTO v_group_coachnika FROM growth_item_groups WHERE user_id = v_user_id AND type = 'habits' AND name = 'Coach Nika';
  SELECT id INTO v_group_pac FROM growth_item_groups WHERE user_id = v_user_id AND type = 'habits' AND name = 'PAC';

  -- Items: nur einfügen, wenn noch kein Item mit demselben Namen in dieser Gruppe existiert
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'principles', v_group_christentum, x.name, 0, x.ord
  FROM (VALUES
    ('Fleiß', 0), ('Geduld', 1), ('Demut', 2), ('Weisheit', 3), ('Liebe', 4),
    ('Gottesfurcht', 5), ('Integrität', 6), ('Zuverlässigkeit', 7), ('Beständigkeit', 8)
  ) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.group_id = v_group_christentum AND gi.name = x.name);

  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'skills', v_group_esport, x.name, 0, x.ord
  FROM (VALUES ('Mentale Stärke', 0), ('Körperliche Fitness', 1), ('Kognitive Fitness', 2)) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.group_id = v_group_esport AND gi.name = x.name);

  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'habits', v_group_pilgrim, x.name, 0, x.ord
  FROM (VALUES ('Stille Zeit', 0), ('Fasten', 1), ('Bibelstudium', 2)) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.group_id = v_group_pilgrim AND gi.name = x.name);

  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'habits', v_group_coachnika, x.name, 0, x.ord
  FROM (VALUES
    ('Journal', 0), ('Körperliche Fitness', 1), ('Kognitive Fitness', 2),
    ('Bett machen, Wasser trinken', 3), ('To-Dos/Next Steps', 4), ('Tägliche Ausgaben und Einnahmen', 5)
  ) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.group_id = v_group_coachnika AND gi.name = x.name);

  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order)
  SELECT v_user_id, 'habits', v_group_pac, x.name, 0, x.ord
  FROM (VALUES ('Buch lesen', 0), ('Gesichtstraining', 1)) AS x(name, ord)
  WHERE NOT EXISTS (SELECT 1 FROM growth_items gi WHERE gi.group_id = v_group_pac AND gi.name = x.name);
END $$;
