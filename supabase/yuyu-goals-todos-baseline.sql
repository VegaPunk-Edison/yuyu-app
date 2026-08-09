-- ══════════════════════════════════════════════════════
-- Baseline: yuyu_goals, yuyu_todos, yuyu_goal_milestones
--
-- Diese drei Tabellen wurden nie per CREATE TABLE im Repo angelegt, nur von Hand in
-- Supabase - anders als growth_items/growth_item_groups/employers/profiles, die jeweils
-- ein eigenes *-setup.sql haben. Genau diese Lücke war die Ursache für zwei Bugs in
-- dieser Session: eine fehlende Spalte (learning_goal) und ein zu strenger Constraint
-- (nur ein Meilenstein pro Ziel möglich).
--
-- Diese Datei bündelt den aus dem App-Code (src/App.jsx) und allen bisherigen Nachrüst-
-- Migrationen (goals-add-learning-problem.sql, goals-add-missing-columns.sql,
-- goals-and-todos-add-linked-habits.sql, todos-add-linked-items.sql,
-- todos-add-goal-link.sql, goal-milestones-allow-multiple.sql) rekonstruierten Ist-
-- Zustand an einer einzigen Stelle:
--   - CREATE TABLE IF NOT EXISTS: No-Op für die drei bereits produktiv laufenden
--     Tabellen, aber die vollständige Definition für eine frische/Recovery-Umgebung
--   - ADD COLUMN IF NOT EXISTS: patcht die echte, von Hand angelegte Tabelle auf den
--     gleichen Stand nach, unabhängig davon welche der obigen Migrationen bereits liefen
--
-- BEWUSST AUSGELASSEN: RLS-Policies für diese drei Tabellen. Sie laufen bereits
-- produktiv mit Nutzer-Isolation (sonst würde ein Login fremde Daten zeigen), aber die
-- exakten Policy-Namen sind unbekannt - CREATE POLICY hat kein IF NOT EXISTS, ein
-- blinder Versuch würde bei bereits vorhandenen Policies mit Namenskollision abbrechen.
-- Nur falls CREATE TABLE hier tatsächlich greift (echte Neuanlage in einer leeren
-- Umgebung) muss RLS manuell ergänzt werden - Muster dafür steht in
-- growth-items-setup.sql.
-- Im Supabase Dashboard → SQL Editor ausführen.
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.yuyu_goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  description      TEXT,
  learning_goal    TEXT,
  problem          TEXT,
  life_area        TEXT,
  status           TEXT NOT NULL DEFAULT 'open',
  linked_items     UUID[] NOT NULL DEFAULT '{}',
  linked_skill_ids UUID[] NOT NULL DEFAULT '{}',
  linked_habit_ids UUID[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.yuyu_goals
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS learning_goal TEXT,
  ADD COLUMN IF NOT EXISTS problem TEXT,
  ADD COLUMN IF NOT EXISTS life_area TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS linked_items UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_skill_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_habit_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS yuyu_goals_user_idx ON public.yuyu_goals (user_id);

CREATE TABLE IF NOT EXISTS public.yuyu_todos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text             TEXT NOT NULL,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  failed           BOOLEAN NOT NULL DEFAULT FALSE,
  life_area        TEXT,
  linked_items     UUID[] NOT NULL DEFAULT '{}',
  linked_skill_ids UUID[] NOT NULL DEFAULT '{}',
  linked_habit_ids UUID[] NOT NULL DEFAULT '{}',
  goal_id          UUID REFERENCES public.yuyu_goals(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.yuyu_todos
  ADD COLUMN IF NOT EXISTS linked_items UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_skill_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linked_habit_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.yuyu_goals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS yuyu_todos_user_idx ON public.yuyu_todos (user_id);
CREATE INDEX IF NOT EXISTS yuyu_todos_goal_idx ON public.yuyu_todos (goal_id);

-- yuyu_goal_milestones: id/goal_id/user_id/name/completed sind schon nachweislich
-- funktionsfähig (Anlegen/Umbenennen/Abhaken/Löschen laufen produktiv) - hier daher
-- keine ADD COLUMN-Nachrüstung nötig, nur die Baseline-Definition für den Recovery-Fall.
CREATE TABLE IF NOT EXISTS public.yuyu_goal_milestones (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    UUID NOT NULL REFERENCES public.yuyu_goals(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS yuyu_goal_milestones_goal_idx ON public.yuyu_goal_milestones (goal_id);
