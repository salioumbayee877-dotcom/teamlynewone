-- ═══════════════════════════════════════════════════════════════
-- TEAMLY — Añade columna birthday a profiles
-- Ejecutar en: Supabase → SQL Editor → New query → Run
--
-- Motivo: el código del settings modal (closer/livreur) envía
-- birthday en el PATCH, pero la columna no existía en la DB, así
-- que PGRST204 ("Could not find the 'birthday' column") rompía
-- todo el guardado del perfil.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birthday DATE NULL;

-- (Opcional) reload del schema cache de PostgREST para que el cambio
-- esté disponible inmediatamente sin esperar al reinicio automático.
NOTIFY pgrst, 'reload schema';
