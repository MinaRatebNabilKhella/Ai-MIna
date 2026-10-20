-- Mina Student AI — Supabase schema (run in SQL Editor once).
-- This file deliberately contains no passwords, Gemini keys, or service-role keys.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- This address is an allowlisted identity, not an authentication secret.
-- The account still has to sign in through Supabase Auth and verify control of the email.
insert into public.admin_allowlist(email)
values ('minaratebnabil1@gmail.com')
on conflict (email) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null default '',
  school text not null default '',
  grade text not null default 'sec3',
  phone text not null default '',
  governorate text not null default '',
  address text not null default '',
  role text not null default 'student' check (role in ('student', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deleted')),
  approval_code_hash text,
  approval_code_expires_at timestamptz,
  approval_code_attempts integer not null default 0 check (approval_code_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists approval_code_attempts integer not null default 0;

create table if not exists public.student_data (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_type text not null check (usage_type in ('ai', 'youtube')),
  usage_date date not null default ((now() at time zone 'Africa/Cairo')::date),
  requests integer not null default 0 check (requests >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_type, usage_date)
);

create index if not exists profiles_status_created_idx on public.profiles(status, created_at desc);
create index if not exists usage_daily_date_idx on public.usage_daily(usage_date desc);

create or replace function public.is_app_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_allowlist a
    join auth.users u on u.id = auth.uid()
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(a.email) = lower(coalesce(u.email, ''))
      and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.is_app_admin() from PUBLIC, anon;
grant execute on function public.is_app_admin() to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_is_admin boolean;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  select exists(select 1 from public.admin_allowlist where email = v_email) into v_is_admin;
  insert into public.profiles (
    id, email, name, school, grade, phone, governorate, address, role, status
  ) values (
    new.id,
    v_email,
    case when v_is_admin then 'MinaRatebNabil' else left(coalesce(v_meta ->> 'name', ''), 160) end,
    case when v_is_admin then 'إدارة التطبيق' else left(coalesce(v_meta ->> 'school', ''), 200) end,
    case when v_is_admin then 'sec3' when coalesce(v_meta ->> 'grade', '') in ('p6','prep3','sec1','sec2','sec3','uni3','uni4') then v_meta ->> 'grade' else 'sec3' end,
    left(coalesce(v_meta ->> 'phone', ''), 40),
    left(coalesce(v_meta ->> 'governorate', ''), 100),
    left(coalesce(v_meta ->> 'address', ''), 300),
    case when v_is_admin then 'admin' else 'student' end,
    case when v_is_admin then 'approved' else 'pending' end
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_mina on auth.users;
create trigger on_auth_user_created_mina
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Whenever an admin changes a pending student's status, invalidate any previous approval code.
create or replace function public.clear_approval_code_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.approval_code_hash := null;
    new.approval_code_expires_at := null;
    new.approval_code_attempts := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists clear_approval_code_when_status_changes on public.profiles;
create trigger clear_approval_code_when_status_changes
before update of status on public.profiles
for each row execute procedure public.clear_approval_code_on_status_change();


-- Backfill legacy Supabase Auth users if the schema is applied after signups already exist.
insert into public.profiles (
  id, email, name, school, grade, phone, governorate, address, role, status, created_at
)
select
  u.id,
  lower(coalesce(u.email, '')),
  case when lower(coalesce(u.email, '')) = 'minaratebnabil1@gmail.com' then 'MinaRatebNabil' else left(coalesce(u.raw_user_meta_data ->> 'name', ''), 160) end,
  case when lower(coalesce(u.email, '')) = 'minaratebnabil1@gmail.com' then 'إدارة التطبيق' else left(coalesce(u.raw_user_meta_data ->> 'school', ''), 200) end,
  case when lower(coalesce(u.email, '')) = 'minaratebnabil1@gmail.com' then 'sec3' when coalesce(u.raw_user_meta_data ->> 'grade', '') in ('p6','prep3','sec1','sec2','sec3','uni3','uni4') then u.raw_user_meta_data ->> 'grade' else 'sec3' end,
  left(coalesce(u.raw_user_meta_data ->> 'phone', ''), 40),
  left(coalesce(u.raw_user_meta_data ->> 'governorate', ''), 100),
  left(coalesce(u.raw_user_meta_data ->> 'address', ''), 300),
  case when u.email_confirmed_at is not null and exists(select 1 from public.admin_allowlist a where lower(a.email) = lower(coalesce(u.email, ''))) then 'admin' else 'student' end,
  case when u.email_confirmed_at is not null and exists(select 1 from public.admin_allowlist a where lower(a.email) = lower(coalesce(u.email, ''))) then 'approved' else 'pending' end,
  coalesce(u.created_at, now())
from auth.users u
where coalesce(u.email, '') <> ''
on conflict (id) do nothing;

-- RLS is enabled everywhere; clients only get access to their own profile/data unless they are the allowlisted admin.
alter table public.admin_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.student_data enable row level security;
alter table public.usage_daily enable row level security;

revoke all on public.admin_allowlist from anon, authenticated;
grant select on public.admin_allowlist to authenticated;
revoke all on public.student_data from anon, authenticated;
grant select, insert, update, delete on public.student_data to authenticated;
revoke all on public.usage_daily from anon, authenticated;
grant select on public.usage_daily to authenticated;

drop policy if exists "admin can read allowlist" on public.admin_allowlist;
create policy "admin can read allowlist" on public.admin_allowlist for select to authenticated using (public.is_app_admin());

drop policy if exists "read own profile or all as admin" on public.profiles;
create policy "read own profile or all as admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_app_admin());
drop policy if exists "admin update profiles" on public.profiles;
create policy "admin update profiles" on public.profiles for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
drop policy if exists "admin delete profiles" on public.profiles;
create policy "admin delete profiles" on public.profiles for delete to authenticated using (public.is_app_admin());
-- Column-level grants keep the approval-code hash and role/email fields out of browser-side requests.
revoke all on public.profiles from anon, authenticated;
grant select (id, email, name, school, grade, phone, governorate, address, role, status, created_at, updated_at) on public.profiles to authenticated;
grant update (status, updated_at) on public.profiles to authenticated;
-- No client may insert profiles directly or update their own role/status. The auth trigger and admin policies control that.

drop policy if exists "student read own approved data or admin read all" on public.student_data;
create policy "student read own approved data or admin read all" on public.student_data for select to authenticated
using (public.is_app_admin() or (user_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'student')));
drop policy if exists "student insert own approved data or admin insert all" on public.student_data;
create policy "student insert own approved data or admin insert all" on public.student_data for insert to authenticated
with check (public.is_app_admin() or (user_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'student')));
drop policy if exists "student update own approved data or admin update all" on public.student_data;
create policy "student update own approved data or admin update all" on public.student_data for update to authenticated
using (public.is_app_admin() or (user_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'student')))
with check (public.is_app_admin() or (user_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'student')));
drop policy if exists "student delete own approved data or admin delete all" on public.student_data;
create policy "student delete own approved data or admin delete all" on public.student_data for delete to authenticated
using (public.is_app_admin() or (user_id = auth.uid() and exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved' and p.role = 'student')));

drop policy if exists "read own usage or admin usage" on public.usage_daily;
create policy "read own usage or admin usage" on public.usage_daily for select to authenticated using (user_id = auth.uid() or public.is_app_admin());
-- Client policies deliberately do not permit inserts/updates/deletes to usage_daily.

-- Atomic quota accounting; only the Edge Functions' service-role client may execute this RPC.
create or replace function public.reserve_usage(p_user_id uuid, p_usage_type text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_status text;
  v_role text;
  v_limit integer;
  v_count integer;
  v_day date := (now() at time zone 'Africa/Cairo')::date;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'FORBIDDEN';
  end if;
  if p_usage_type not in ('ai', 'youtube') then raise exception 'INVALID_USAGE_TYPE'; end if;
  select status, role into v_status, v_role from public.profiles where id = p_user_id;
  if not found or v_status <> 'approved' then raise exception 'ACCOUNT_NOT_APPROVED'; end if;
  if p_usage_type = 'ai' then
    v_limit := case when v_role = 'admin' then 100 else 20 end;
  else
    v_limit := case when v_role = 'admin' then 100 else 10 end;
  end if;
  insert into public.usage_daily(user_id, usage_type, usage_date, requests, updated_at)
  values (p_user_id, p_usage_type, v_day, 1, now())
  on conflict (user_id, usage_type, usage_date)
  do update set requests = usage_daily.requests + 1, updated_at = now()
    where public.usage_daily.requests < v_limit
  returning requests into v_count;
  if not found then raise exception 'DAILY_LIMIT'; end if;
  return v_count;
end;
$$;
revoke all on function public.reserve_usage(uuid, text) from PUBLIC, anon, authenticated;
grant execute on function public.reserve_usage(uuid, text) to service_role;

create or replace function public.generate_approval_code(p_user_id uuid)
returns text
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  if not public.is_app_admin() then raise exception 'FORBIDDEN'; end if;
  v_code := upper(encode(gen_random_bytes(4), 'hex'));
  update public.profiles
    set approval_code_hash = encode(digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex'),
        approval_code_expires_at = now() + interval '30 minutes', approval_code_attempts = 0, updated_at = now()
  where id = p_user_id and role = 'student' and status = 'pending';
  if not found then raise exception 'REQUEST_NOT_PENDING'; end if;
  return v_code;
end;
$$;
revoke all on function public.generate_approval_code(uuid) from PUBLIC, anon;
grant execute on function public.generate_approval_code(uuid) to authenticated;

create or replace function public.redeem_approval_code(p_code text)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_hash text;
begin
  if v_uid is null or length(coalesce(p_code, '')) < 6 or length(p_code) > 20 then return false; end if;
  v_hash := encode(digest(convert_to(upper(trim(p_code)), 'UTF8'), 'sha256'), 'hex');
  update public.profiles
    set status = 'approved', approval_code_hash = null, approval_code_expires_at = null, approval_code_attempts = 0, updated_at = now()
  where id = v_uid and role = 'student' and status = 'pending'
    and approval_code_hash = v_hash and approval_code_expires_at > now()
    and approval_code_attempts < 5;
  if found then return true; end if;

  -- Limit guessing to five attempts per generated code.
  update public.profiles
    set approval_code_attempts = approval_code_attempts + 1, updated_at = now()
  where id = v_uid and role = 'student' and status = 'pending'
    and approval_code_hash is not null and approval_code_expires_at > now()
    and approval_code_attempts < 5;
  return false;
end;
$$;
revoke all on function public.redeem_approval_code(text) from PUBLIC, anon;
grant execute on function public.redeem_approval_code(text) to authenticated;


-- Enable realtime delivery for a student's own synchronized data (RLS still limits visibility).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'student_data'
     ) then
    execute 'alter publication supabase_realtime add table public.student_data';
  end if;
end $$;

-- Recommended: run a database backup before changing this schema on an existing production project.


-- Promote an already-created, confirmed allowlisted account if this schema is installed afterwards.
update public.profiles p
set role = 'admin', status = 'approved', name = 'MinaRatebNabil', school = 'إدارة التطبيق', grade = 'sec3', approval_code_hash = null, approval_code_expires_at = null, approval_code_attempts = 0, updated_at = now()
from auth.users u
where p.id = u.id
  and lower(p.email) in (select lower(email) from public.admin_allowlist)
  and u.email_confirmed_at is not null;
