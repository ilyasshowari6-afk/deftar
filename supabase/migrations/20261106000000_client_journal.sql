begin;

create function public.daftar_phone(value text) returns text
language sql immutable strict set search_path = '' as $$
  with digits as (
    select regexp_replace(translate(value, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g') as raw
  ), international as (
    select regexp_replace(raw, '^00212', '212') as raw from digits
  )
  select case when raw ~ '^212[0-9]{9}$' then '0' || substr(raw, 4) else raw end
  from international;
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  first text not null check (char_length(btrim(first)) between 1 and 100),
  last text not null check (char_length(btrim(last)) between 1 and 100),
  phone text not null default '' check (char_length(phone) <= 40 and (phone = '' or char_length(public.daftar_phone(phone)) >= 6)),
  notes text not null default '' check (char_length(notes) <= 5000),
  unique (owner_id, id)
);
create unique index clients_owner_phone_idx on public.clients (owner_id, public.daftar_phone(phone)) where phone <> '';
create index clients_owner_name_idx on public.clients (owner_id, first, last, id);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  client_id uuid not null,
  date date not null check (date between date '2026-01-01' and date '9999-12-31'),
  notes text not null default '' check (char_length(notes) <= 5000),
  foreign key (owner_id, client_id) references public.clients(owner_id, id) on delete cascade
);
create index visits_owner_date_idx on public.visits (owner_id, date desc, id);
create index visits_owner_client_idx on public.visits (owner_id, client_id, date desc);

create table public.daftar_import_log (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('client', 'visit')),
  source_id text not null check (char_length(source_id) between 1 and 250),
  target_id uuid not null,
  primary key (owner_id, kind, source_id)
);

alter table public.clients enable row level security;
alter table public.visits enable row level security;
alter table public.daftar_import_log enable row level security;

create policy own_clients on public.clients to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_visits on public.visits to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy own_import_log on public.daftar_import_log to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

revoke all on public.clients, public.visits, public.daftar_import_log from public, anon, authenticated;
grant select, insert, delete on public.clients to authenticated;
grant update (first, last, phone, notes) on public.clients to authenticated;
grant select, insert, delete on public.visits to authenticated;
grant update (date, notes) on public.visits to authenticated;
grant select, insert on public.daftar_import_log to authenticated;

create function public.daftar_add_client(card jsonb, visit jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare target uuid;
begin
  insert into public.clients (first, last, phone, notes)
    values (btrim(card->>'first'), btrim(card->>'last'), card->>'phone', card->>'notes')
    returning id into target;
  insert into public.visits (client_id, date, notes)
    values (target, (visit->>'date')::date, visit->>'notes');
  return target;
end;
$$;

create function public.daftar_import(records jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  account uuid := auth.uid();
  card jsonb;
  visit jsonb;
  target uuid;
  added_visit uuid;
  cards_added integer := 0;
  visits_added integer := 0;
begin
  if account is null then
    raise insufficient_privilege;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(account::text, 0));

  for card in select value from jsonb_array_elements(records) loop
    select target_id into target from public.daftar_import_log
      where owner_id = account and kind = 'client' and source_id = card->>'id';

    if not found then
      insert into public.clients (first, last, phone, notes)
        values (btrim(card->>'first'), btrim(card->>'last'), card->>'phone', card->>'notes')
        on conflict (owner_id, public.daftar_phone(phone)) where phone <> '' do nothing
        returning id into target;
      if found then
        cards_added := cards_added + 1;
      else
        select id into strict target from public.clients
          where owner_id = account and phone <> '' and public.daftar_phone(phone) = public.daftar_phone(card->>'phone');
      end if;
      insert into public.daftar_import_log (kind, source_id, target_id) values ('client', card->>'id', target);
    end if;

    -- Preserve a deletion made after an earlier import.
    if not exists (select 1 from public.clients where owner_id = account and id = target) then
      continue;
    end if;
    for visit in select value from jsonb_array_elements(card->'entries') loop
      if not exists (select 1 from public.daftar_import_log
        where owner_id = account and kind = 'visit' and source_id = visit->>'id') then
        insert into public.visits (client_id, date, notes)
          values (target, (visit->>'date')::date, visit->>'notes') returning id into added_visit;
        insert into public.daftar_import_log (kind, source_id, target_id) values ('visit', visit->>'id', added_visit);
        visits_added := visits_added + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('clients', cards_added, 'visits', visits_added);
end;
$$;

revoke execute on function public.daftar_add_client(jsonb, jsonb), public.daftar_import(jsonb) from public, anon;
grant execute on function public.daftar_add_client(jsonb, jsonb), public.daftar_import(jsonb) to authenticated;
commit;
