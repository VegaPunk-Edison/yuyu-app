-- ══════════════════════════════════════════════════════
-- Wiederherstellung verlorener Tugenden/Gewohnheiten/Fähigkeiten
-- Rekonstruiert aus Screenshots vom 6.8.2026, da die Migration beim Login
-- nie erfolgreich nach growth_items/growth_item_groups geschrieben hat.
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
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'elevateesport.1@gmail.com';
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Kein auth.users-Eintrag mit dieser E-Mail gefunden - bitte E-Mail oben im Skript korrigieren.';
  END IF;

  -- Oberkategorien
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'principles', 'Christentum') RETURNING id INTO v_group_christentum;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'skills', 'eSport ProClubs') RETURNING id INTO v_group_esport;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'Pilgrim') RETURNING id INTO v_group_pilgrim;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'Coach Nika') RETURNING id INTO v_group_coachnika;
  INSERT INTO growth_item_groups (user_id, type, name) VALUES (v_user_id, 'habits', 'PAC') RETURNING id INTO v_group_pac;

  -- Tugenden (Christentum)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order) VALUES
    (v_user_id, 'principles', v_group_christentum, 'Fleiß', 0, 0),
    (v_user_id, 'principles', v_group_christentum, 'Geduld', 0, 1),
    (v_user_id, 'principles', v_group_christentum, 'Demut', 0, 2),
    (v_user_id, 'principles', v_group_christentum, 'Weisheit', 0, 3),
    (v_user_id, 'principles', v_group_christentum, 'Liebe', 0, 4),
    (v_user_id, 'principles', v_group_christentum, 'Gottesfurcht', 0, 5),
    (v_user_id, 'principles', v_group_christentum, 'Integrität', 0, 6),
    (v_user_id, 'principles', v_group_christentum, 'Zuverlässigkeit', 0, 7),
    (v_user_id, 'principles', v_group_christentum, 'Beständigkeit', 0, 8);

  -- Fähigkeiten (eSport ProClubs)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order) VALUES
    (v_user_id, 'skills', v_group_esport, 'Mentale Stärke', 0, 0),
    (v_user_id, 'skills', v_group_esport, 'Körperliche Fitness', 0, 1),
    (v_user_id, 'skills', v_group_esport, 'Kognitive Fitness', 0, 2);

  -- Gewohnheiten (Pilgrim)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order) VALUES
    (v_user_id, 'habits', v_group_pilgrim, 'Stille Zeit', 0, 0),
    (v_user_id, 'habits', v_group_pilgrim, 'Fasten', 0, 1),
    (v_user_id, 'habits', v_group_pilgrim, 'Bibelstudium', 0, 2);

  -- Gewohnheiten (Coach Nika)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order) VALUES
    (v_user_id, 'habits', v_group_coachnika, 'Journal', 0, 0),
    (v_user_id, 'habits', v_group_coachnika, 'Körperliche Fitness', 0, 1),
    (v_user_id, 'habits', v_group_coachnika, 'Kognitive Fitness', 0, 2),
    (v_user_id, 'habits', v_group_coachnika, 'Bett machen, Wasser trinken', 0, 3),
    (v_user_id, 'habits', v_group_coachnika, 'To-Dos/Next Steps', 0, 4),
    (v_user_id, 'habits', v_group_coachnika, 'Tägliche Ausgaben und Einnahmen', 0, 5);

  -- Gewohnheiten (PAC)
  INSERT INTO growth_items (user_id, type, group_id, name, xp, sort_order) VALUES
    (v_user_id, 'habits', v_group_pac, 'Buch lesen', 0, 0),
    (v_user_id, 'habits', v_group_pac, 'Gesichtstraining', 0, 1);
END $$;
