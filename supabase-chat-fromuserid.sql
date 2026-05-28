-- Add from_user_id to messages so chat ownership is decided by uid, not nom.
-- Fixes the bug where two members with the same (or empty) nom mistake each
-- other's messages for their own.

alter table messages
  add column if not exists from_user_id uuid references auth.users(id) on delete set null;

create index if not exists messages_from_user_id_idx on messages (from_user_id);

-- Best-effort backfill: link historical messages to profiles by nom (only when
-- a single profile in the org matches). Leaves ambiguous rows null.
update messages m
   set from_user_id = p.id
  from profiles p
 where m.from_user_id is null
   and m.from_user is not null
   and p.org_id = m.org_id
   and lower(p.nom) = lower(m.from_user)
   and (select count(*) from profiles p2 where p2.org_id = m.org_id and lower(p2.nom) = lower(m.from_user)) = 1;
