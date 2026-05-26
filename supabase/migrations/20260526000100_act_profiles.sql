-- Foundation — act.profiles.
-- Mirrors sat.profiles structure exactly (id, email, full_name, avatar_url,
-- role, created_at, updated_at). Sub-project #2 will call getOrCreateProfile()
-- against this shape. Profile rows are created by app code, NOT by a trigger
-- on auth.users (which is shared with PropLedger).

create table if not exists act.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        text not null default 'student' check (role in ('student', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table act.profiles enable row level security;

-- Read/create/update only your own profile row.
create policy "profiles_select_own" on act.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on act.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on act.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Column-scoped grants so authenticated users can never write `role`.
-- The trigger below is the airtight backstop.
grant select on act.profiles to authenticated;
grant insert (id, email, full_name, avatar_url) on act.profiles to authenticated;
grant update (email, full_name, avatar_url) on act.profiles to authenticated;

-- updated_at maintenance (trigger on our own table — not shared infra).
create or replace function act.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on act.profiles
  for each row execute function act.set_updated_at();

-- Role-escalation guard. SAT app's CLAUDE.md documents the rationale: Supabase
-- re-grants table-level write privileges to anon/authenticated on tables in
-- exposed schemas, so column-scoped GRANTs aren't sufficient. This trigger
-- forces 'role' to 'student' on insert and silently keeps the existing role
-- on update for API roles. Privileged roles (postgres, service_role) are
-- unaffected. To promote: `update act.profiles set role='admin' where id=...`
-- as service_role.
create or replace function act.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = act, pg_temp
as $$
begin
  if (tg_op = 'INSERT') then
    if current_user in ('anon', 'authenticated') then
      new.role := 'student';
    end if;
    return new;
  elsif (tg_op = 'UPDATE') then
    if current_user in ('anon', 'authenticated') then
      new.role := old.role;
    end if;
    return new;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before insert or update on act.profiles
  for each row execute function act.protect_profile_role();
