-- Unique usernames for YourLocality - PHASE 1 of 2 (safe to run any time).
-- Run this ONCE in the Supabase SQL Editor (project omuednmzkvaalrwdxbsq).
-- It only ADDS a new table, so the live site keeps working exactly as today.
-- Phase 2 (usernames-author-trigger.sql) runs together with the merge.
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
