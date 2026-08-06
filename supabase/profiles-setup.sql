-- ══════════════════════════════════════════════════════
-- YuYu ↔ PIFA – Profiles-Tabelle + Auto-Anlage bei Signup
-- Im Supabase Dashboard → SQL Editor ausführen
--
-- Behebt confirmEmployerLink (App.jsx), das seit Einführung des Arbeitgeber-Features
-- bereits gegen "profiles" abfragt - diese Tabelle gab es bisher nirgends.
-- ══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_row_select ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY own_row_update ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Legt bei jedem neuen auth.users-Eintrag automatisch eine profiles-Zeile an.
-- name wird aus raw_user_meta_data befüllt (vorname/nachname aus PIFA-Signup, falls vorhanden).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'vorname', '') || ' ' || COALESCE(NEW.raw_user_meta_data->>'nachname', '')), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
