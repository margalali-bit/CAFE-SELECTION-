-- One authoritative POS device per café. No PIN or PIN hash is uploaded.
create table public.cafes(id uuid primary key default gen_random_uuid(), name text not null);
create table public.cafe_members(cafe_id uuid references public.cafes(id), user_id uuid references auth.users(id), primary key(cafe_id,user_id));
create table public.devices(id uuid primary key default gen_random_uuid(), cafe_id uuid not null unique references public.cafes(id), auth_user_id uuid not null unique references auth.users(id));
create table public.cafe_state(cafe_id uuid primary key references public.cafes(id), device_id uuid not null references public.devices(id), seq bigint not null, snapshot jsonb not null, updated_at timestamptz not null default now());
create table public.sync_events(event_id uuid primary key, cafe_id uuid not null references public.cafes(id), device_id uuid not null references public.devices(id), seq bigint not null, kind text not null, received_at timestamptz not null default now(), unique(device_id,seq));
create table public.commands(id uuid primary key default gen_random_uuid(), cafe_id uuid not null references public.cafes(id), device_id uuid not null references public.devices(id), kind text not null check(kind in('product','settings','cancel','confirm','payment')), payload jsonb not null check(jsonb_typeof(payload)='object'), requested_by uuid not null default auth.uid() references auth.users(id), status text not null default 'pending' check(status in('pending','applied','failed')), error text, created_at timestamptz not null default now(), completed_at timestamptz);
create table public.push_tokens(user_id uuid references auth.users(id), token text not null, primary key(user_id,token));
create table public.notification_jobs(id uuid primary key, cafe_id uuid not null references public.cafes(id), kind text not null, sent_at timestamptz, attempts integer not null default 0, created_at timestamptz not null default now());
create or replace function public.is_owner(p_cafe uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists(select 1 from public.cafe_members m where m.cafe_id=p_cafe and m.user_id=auth.uid());
$$;
create or replace function public.is_device(p_cafe uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.devices d where d.cafe_id=p_cafe and d.auth_user_id=auth.uid());
$$;
-- Row security on every exposed table, including tables with no client policies.
DO $$ declare t text; begin foreach t in array array['cafes','cafe_members','devices','cafe_state','sync_events','commands','push_tokens','notification_jobs'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy owner_cafe on public.cafes for select to authenticated using(public.is_owner(id));
create policy own_membership on public.cafe_members for select to authenticated using(user_id=auth.uid());
create policy read_devices on public.devices for select to authenticated using(public.is_owner(cafe_id) or auth_user_id=auth.uid());
create policy read_state on public.cafe_state for select to authenticated using(public.is_owner(cafe_id));
create policy read_commands on public.commands for select to authenticated using(public.is_owner(cafe_id) or public.is_device(cafe_id));
create policy owner_commands on public.commands for insert to authenticated with check(public.is_owner(cafe_id) and requested_by=auth.uid() and status='pending' and error is null and completed_at is null and exists(select 1 from public.devices d where d.id=commands.device_id and d.cafe_id=commands.cafe_id));
create policy manage_own_push on public.push_tokens for all to authenticated using(user_id=auth.uid() and coalesce(auth.jwt()->>'aal','aal1')='aal2') with check(user_id=auth.uid() and coalesce(auth.jwt()->>'aal','aal1')='aal2');
revoke all on public.sync_events,public.notification_jobs from anon,authenticated;
grant select on public.cafes,public.cafe_members,public.devices,public.cafe_state,public.commands to authenticated;
grant insert on public.commands to authenticated;
grant select,insert,delete on public.push_tokens to authenticated;
create or replace function public.ingest_snapshot(p_cafe uuid,p_device uuid,p_event uuid,p_seq bigint,p_kind text,p_snapshot jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.devices where id=p_device and cafe_id=p_cafe and auth_user_id=auth.uid()) then raise exception 'Device access denied'; end if;
 if p_seq<1 or jsonb_typeof(p_snapshot)<>'object' or not(p_snapshot ?& array['orders','products','shifts','customers','debt_payments','expenses','settings','users']) or p_snapshot::text ~ '"(pin_hash|salt|pin_code|password)"\s*:' then raise exception 'Invalid snapshot'; end if;
 -- Serialize all uploads for this café and commit deduplication + state atomically.
 perform pg_advisory_xact_lock(hashtextextended(p_cafe::text,0));
 if exists(select 1 from public.sync_events where event_id=p_event and device_id=p_device and seq=p_seq) then return; end if;
 insert into public.sync_events(event_id,cafe_id,device_id,seq,kind) values(p_event,p_cafe,p_device,p_seq,p_kind);
 insert into public.cafe_state(cafe_id,device_id,seq,snapshot) values(p_cafe,p_device,p_seq,p_snapshot)
 on conflict(cafe_id) do update set seq=excluded.seq,snapshot=excluded.snapshot,updated_at=now() where public.cafe_state.seq<excluded.seq;
 if p_kind in('order.created','order.cancelled','shift.closed') then insert into public.notification_jobs(id,cafe_id,kind) values(p_event,p_cafe,p_kind) on conflict do nothing; end if;
end; $$;
create or replace function public.complete_command(p_id uuid,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.commands c join public.devices d on d.id=c.device_id where c.id=p_id and d.auth_user_id=auth.uid()) then raise exception 'Device access denied'; end if;
 update public.commands set status=case when p_error is null then 'applied' else 'failed' end,error=left(p_error,300),completed_at=now() where id=p_id and status='pending';
end; $$;
revoke all on function public.ingest_snapshot(uuid,uuid,uuid,bigint,text,jsonb),public.complete_command(uuid,text),public.is_owner(uuid),public.is_device(uuid) from public;
grant execute on function public.ingest_snapshot(uuid,uuid,uuid,bigint,text,jsonb),public.complete_command(uuid,text),public.is_owner(uuid),public.is_device(uuid) to authenticated;
-- Polling is used as a fallback. Realtime is optional for installations supporting it.
DO $$ begin alter publication supabase_realtime add table public.cafe_state,public.commands; exception when duplicate_object or undefined_object then null; end $$;

-- Compact local outbox + one current snapshot per batch avoids storing a full
-- financial history for every local sale. Metadata events are acknowledged together.
create or replace function public.ingest_batch(p_cafe uuid,p_device uuid,p_events jsonb,p_seq bigint,p_snapshot jsonb) returns void language plpgsql security definer set search_path='' as $$
declare e jsonb;
begin
 if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)<1 or jsonb_array_length(p_events)>100 then raise exception 'Invalid batch'; end if;
 if not exists(select 1 from public.devices where id=p_device and cafe_id=p_cafe and auth_user_id=auth.uid()) then raise exception 'Device access denied'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_cafe::text,0));
 for e in select value from jsonb_array_elements(p_events) loop
   if (e->>'seq')::bigint>p_seq then raise exception 'Invalid sequence'; end if;
   perform public.ingest_snapshot(p_cafe,p_device,(e->>'event_id')::uuid,(e->>'seq')::bigint,e->>'kind',p_snapshot);
 end loop;
 update public.cafe_state set seq=p_seq,snapshot=p_snapshot,updated_at=now() where cafe_id=p_cafe and device_id=p_device and seq<p_seq;
end; $$;
revoke all on function public.ingest_batch(uuid,uuid,jsonb,bigint,jsonb) from public;
grant execute on function public.ingest_batch(uuid,uuid,jsonb,bigint,jsonb) to authenticated;
