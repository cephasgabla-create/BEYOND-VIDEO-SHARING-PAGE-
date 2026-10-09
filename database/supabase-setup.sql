-- Beyond video sharing page: Supabase database setup
-- Run this file in Supabase Dashboard > SQL Editor for your Beyond project.
-- Safe to re-run: policies are dropped before being recreated.
-- Do not put your database password or service_role key in this file.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_url text not null,
  storage_path text,
  caption text not null default '',
  hashtags text[] not null default '{}',
  status text not null default 'published' check (status in ('draft','published','hidden')),
  views_count bigint not null default 0,
  likes_count bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists videos_status_created_idx on public.videos(status, created_at desc);
create index if not exists videos_user_created_idx on public.videos(user_id, created_at desc);
create index if not exists comments_video_created_idx on public.comments(video_id, created_at);
create index if not exists likes_video_idx on public.likes(video_id);
create index if not exists follows_following_idx on public.follows(following_id);

alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

drop policy if exists beyond_profiles_read on public.profiles;
create policy beyond_profiles_read on public.profiles for select using (true);
drop policy if exists beyond_profiles_insert on public.profiles;
create policy beyond_profiles_insert on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists beyond_profiles_update on public.profiles;
create policy beyond_profiles_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists beyond_videos_read on public.videos;
create policy beyond_videos_read on public.videos for select using (status = 'published' or auth.uid() = user_id);
drop policy if exists beyond_videos_insert on public.videos;
create policy beyond_videos_insert on public.videos for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists beyond_videos_update on public.videos;
create policy beyond_videos_update on public.videos for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists beyond_videos_delete on public.videos;
create policy beyond_videos_delete on public.videos for delete to authenticated using (auth.uid() = user_id);

drop policy if exists beyond_follows_read on public.follows;
create policy beyond_follows_read on public.follows for select using (true);
drop policy if exists beyond_follows_insert on public.follows;
create policy beyond_follows_insert on public.follows for insert to authenticated with check (auth.uid() = follower_id);
drop policy if exists beyond_follows_delete on public.follows;
create policy beyond_follows_delete on public.follows for delete to authenticated using (auth.uid() = follower_id);

drop policy if exists beyond_likes_read on public.likes;
create policy beyond_likes_read on public.likes for select using (true);
drop policy if exists beyond_likes_insert on public.likes;
create policy beyond_likes_insert on public.likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists beyond_likes_delete on public.likes;
create policy beyond_likes_delete on public.likes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists beyond_comments_read on public.comments;
create policy beyond_comments_read on public.comments for select using (true);
drop policy if exists beyond_comments_insert on public.comments;
create policy beyond_comments_insert on public.comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists beyond_comments_delete on public.comments;
create policy beyond_comments_delete on public.comments for delete to authenticated using (auth.uid() = user_id);

-- Create a Storage bucket named 'beyond-videos' in the Supabase Storage dashboard.
-- Configure Storage policies separately before enabling uploads.
