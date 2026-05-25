-- Promo codes — gestionados por el OWNER de la plataforma (salioumbayee877@gmail.com)
-- Ejecutar en Supabase SQL Editor

create table if not exists promo_codes (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  discount_pct    integer not null check (discount_pct > 0 and discount_pct <= 100),
  expires_at      timestamptz,
  max_uses        integer,
  uses_count      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

create index if not exists promo_codes_code_idx on promo_codes (upper(code));
create index if not exists promo_codes_active_idx on promo_codes (active) where active = true;

alter table promo_codes enable row level security;

-- Cualquier usuario autenticado puede LEER los códigos (para validarlos al pagar)
drop policy if exists promo_codes_select on promo_codes;
create policy promo_codes_select on promo_codes
  for select to authenticated
  using (true);

-- Solo el OWNER puede crear/editar/borrar
drop policy if exists promo_codes_insert_owner on promo_codes;
create policy promo_codes_insert_owner on promo_codes
  for insert to authenticated
  with check (auth.jwt()->>'email' = 'salioumbayee877@gmail.com');

drop policy if exists promo_codes_update_owner on promo_codes;
create policy promo_codes_update_owner on promo_codes
  for update to authenticated
  using (auth.jwt()->>'email' = 'salioumbayee877@gmail.com')
  with check (auth.jwt()->>'email' = 'salioumbayee877@gmail.com');

drop policy if exists promo_codes_delete_owner on promo_codes;
create policy promo_codes_delete_owner on promo_codes
  for delete to authenticated
  using (auth.jwt()->>'email' = 'salioumbayee877@gmail.com');

-- Seed con el código actual (mantener compatibilidad)
insert into promo_codes (code, discount_pct, active) values
  ('LANCEMENT30', 30, true),
  ('INFLUENCER30', 30, true),
  ('PROMO30', 30, true),
  ('PARTENAIRE30', 30, true),
  ('TEAMLY30', 30, true),
  ('RAMADAN30', 30, true),
  ('BIENVENUE30', 30, true)
on conflict (code) do nothing;
