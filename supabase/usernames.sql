-- Unique usernames for YourLocality.
-- Run this ONCE in the Supabase SQL Editor (project omuednmzkvaalrwdxbsq)
-- BEFORE merging the username-signup branch. The app code expects this table.
--
-- What it does:
--   * one row per account: user_id -> username (primary key = one username per account)
--   * username is case-insensitively UNIQUE (citext), which is what actually
--     stops two people from taking the same name, even if they sign up at the
--     same moment. The website checks first only to show a friendly message.
--   * anyone may READ usernames (they are public handles, shown on reports
--     and comments anyway); only the signed-in owner may claim their own row.
--   * no update or delete policy: a username, once claimed, stays with the
--     account. (Changing it later can be added as its own feature.)
--   * a trigger forces the author identity on every new report and comment:
--     the database pins user_id to the signed-in account and copies that
--     account's claimed username onto the row. A hand-crafted API request
--     therefore cannot post under someone else's name, and posting without
--     a claimed username is rejected. The website always claims a username
--     before posting, so this only stops direct API misuse.

create extension if not exists citext;

create table if not exists public.usernames (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username citext not null unique,
  created_at timestamptz not null default now()
);

alter table public.usernames enable row level security;

create policy "usernames are public"
  on public.usernames for select
  using (true);

create policy "claim own username"
  on public.usernames for insert
  to authenticated
  with check (user_id = auth.uid());

create or replace function public.use_claimed_username()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  claimed citext;
begin
  new.user_id := auth.uid();          -- never trust the request body for who posted
  select username into claimed from public.usernames where user_id = new.user_id;
  if claimed is null then
    raise exception 'Choose a username before posting.';
  end if;
  new.author_label := claimed;        -- never trust the request body for the display name
  return new;
end;
$$;

drop trigger if exists reports_author_username on public.reports;
create trigger reports_author_username
  before insert on public.reports
  for each row execute function public.use_claimed_username();

drop trigger if exists comments_author_username on public.comments;
create trigger comments_author_username
  before insert on public.comments
  for each row execute function public.use_claimed_username();
