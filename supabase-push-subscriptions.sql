-- Push notifications subscription store (Web Push / VAPID).
-- Run this once in the Supabase SQL editor.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role text not null check (role in ('admin','closer','livreur')),
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (endpoint)
);

create index if not exists push_subscriptions_org_role_idx
  on push_subscriptions (org_id, role);

alter table push_subscriptions enable row level security;

-- A user can manage only their own subscriptions; service key bypasses RLS.
drop policy if exists "push_subs_select_own" on push_subscriptions;
create policy "push_subs_select_own" on push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_subs_insert_own" on push_subscriptions;
create policy "push_subs_insert_own" on push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_subs_update_own" on push_subscriptions;
create policy "push_subs_update_own" on push_subscriptions
  for update using (auth.uid() = user_id);

drop policy if exists "push_subs_delete_own" on push_subscriptions;
create policy "push_subs_delete_own" on push_subscriptions
  for delete using (auth.uid() = user_id);
