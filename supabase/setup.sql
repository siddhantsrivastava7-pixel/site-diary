-- Run this in your Supabase project's SQL Editor.
-- Every user can read/write ONLY their own notebook. Do not disable RLS.
create table if not exists public.site_diary_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_diary_data enable row level security;

drop policy if exists "read own diary" on public.site_diary_data;
create policy "read own diary" on public.site_diary_data
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own diary" on public.site_diary_data;
create policy "insert own diary" on public.site_diary_data
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "update own diary" on public.site_diary_data;
create policy "update own diary" on public.site_diary_data
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy by design. Users can archive sites in the app.
