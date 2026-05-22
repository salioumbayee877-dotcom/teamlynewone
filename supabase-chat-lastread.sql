-- ============================================================
-- Teamly — chat_last_read_at sincronizado por usuario
-- ============================================================
-- Permite que el badge de "no leídos" del chat se sincronice
-- entre dispositivos (móvil ↔ PC). Ejecutar en SQL Editor → Run.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chat_last_read_at timestamptz;

NOTIFY pgrst, 'reload schema';
