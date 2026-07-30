-- ══════════════════════════════════════════════════════
-- YuYu – Arbeitgeber-Verknüpfung (Supabase Setup)
-- Im Supabase Dashboard → SQL Editor ausführen
-- ══════════════════════════════════════════════════════

-- Kuratierte Arbeitgeber-Liste (öffentlich lesbar, da keine sensiblen Daten)
CREATE TABLE IF NOT EXISTS public.employers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  linkable   BOOLEAN NOT NULL DEFAULT false,
  link_url   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;
CREATE POLICY employers_read_all ON public.employers FOR SELECT USING (true);

INSERT INTO public.employers (id, name, linkable, link_url) VALUES
  ('pifa', 'PIFA', true, 'https://pifa-esports.store')
ON CONFLICT (id) DO NOTHING;

-- Pro Nutzer: aktueller Job + gewählter Arbeitgeber + Verknüpfungsstatus
CREATE TABLE IF NOT EXISTS public.user_employer_links (
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  job_title   TEXT,
  employer_id TEXT REFERENCES public.employers(id),
  linked      BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.user_employer_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_row_select ON public.user_employer_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY own_row_insert ON public.user_employer_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY own_row_update ON public.user_employer_links FOR UPDATE USING (auth.uid() = user_id);
