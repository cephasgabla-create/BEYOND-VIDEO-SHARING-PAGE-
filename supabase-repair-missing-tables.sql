-- Beyond repair: create the two core tables used by the backend health check and video uploads.
-- Run in the SQL Editor of the SAME Supabase project configured in supabase.js.
-- Safe to rerun: existing tables and rows are preserved.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text not null default '',
  avatar_url text,
  banner_url text,
  accent_color text not null default '#ff2d55',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_url text not null,
  caption text not null default '',
  hashtags text not null default '',
  status text not null default 'published'
    check (status in ('draft', 'published', 'private')),
  views_count bigint not null default 0 check (views_count >= 0),
  likes_count bigint not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;

-- Ensure API roles can access these tables; row-level policies still control rows.
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.videos to anon, authenticated;
grant insert, update, delete on public.videos to authenticated;

drop policy if exists "Profiles are readable" on public.profiles;
create policy "Profiles are readable"
  on public.profiles for select to anon, authenticated using (true);

drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Published videos are readable" on public.videos;
create policy "Published videos are readable"
  on public.videos for select to anon, authenticated
  using (status = 'published' or auth.uid() = user_id);

drop policy if exists "Users create own videos" on public.videos;
create policy "Users create own videos"
  on public.videos for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own videos" on public.videos;
create policy "Users update own videos"
  on public.videos for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own videos" on public.videos;
create policy "Users delete own videos"
  on public.videos for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists videos_published_created_idx
  on public.videos (created_at desc) where status = 'published';
create index if not exists videos_user_created_idx
  on public.videos (user_id, created_at desc);

-- Ask PostgREST to refresh its schema cache so the new tables appear to the API.
notify pgrst, 'reload schema';
