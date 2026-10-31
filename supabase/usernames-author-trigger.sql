-- Unique usernames for YourLocality - PHASE 2 of 2.
-- Run this in the Supabase SQL Editor TOGETHER WITH merging the username-signup
-- branch - NOT before. Reason: it makes the database reject any report or
-- comment from an account that has not claimed a username, and the old live
-- site does not claim usernames, so running it early would break live posting.
-- After the merge, the website always claims a username before posting.
--
-- What it does: on every new report or comment, the database pins user_id to
-- the signed-in account and copies that account's claimed username onto the
-- row as author_label. A hand-crafted API request therefore cannot post under
-- someone else's name; only the website's real identity is ever shown.

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
