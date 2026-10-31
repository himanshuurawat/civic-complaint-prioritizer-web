-- Unique usernames for YourLocality.
-- Run this ONCE in the Supabase SQL Editor (project omuednmzkvaalrwdxbsq)
-- BEFORE merging the username-signup branch. The app code expects this table.
--
-- What it does:
--   * one row per account: user_id -> username
--   * username is case-insensitively UNIQUE (citext), which is what actually
--     stops two people from taking the same name, even if they sign up at the
--     same moment. The website checks first only to show a friendly message.
--   * anyone may READ usernames (they are public handles, shown on reports
--     and comments anyway); only the signed-in owner may claim their own row.
--   * no update or delete policy: a username, once claimed, stays with the
--     account. (Changing it later can be added as its own feature.)

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
