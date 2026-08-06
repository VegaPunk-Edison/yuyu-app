-- ══════════════════════════════════════════════════════
-- YuYu ↔ PIFA – Geteilte Tugenden/Gewohnheiten/Fähigkeiten (Oberkategorien + Items)
-- Im Supabase Dashboard → SQL Editor ausführen
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.growth_item_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('principles', 'habits', 'skills')),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type, name)
);
ALTER TABLE public.growth_item_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_row_select ON public.growth_item_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_row_insert ON public.growth_item_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_row_update ON public.growth_item_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY own_row_delete ON public.growth_item_groups FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.growth_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('principles', 'habits', 'skills')),
  group_id   UUID NOT NULL REFERENCES public.growth_item_groups(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  xp         INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.growth_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_row_select ON public.growth_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_row_insert ON public.growth_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_row_update ON public.growth_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY own_row_delete ON public.growth_items FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS growth_items_user_type_idx ON public.growth_items (user_id, type);
CREATE INDEX IF NOT EXISTS growth_items_group_idx ON public.growth_items (group_id);
