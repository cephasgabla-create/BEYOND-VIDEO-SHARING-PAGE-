-- Beyond database schema for Supabase/PostgreSQL

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text default '',
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists videos (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  video_url text not null,
  caption text default '',
  hashtags text default '',
  status text default 'published' check (status in ('published','draft')),
  views_count bigint default 0,
  likes_count integer default 0,
  created_at timestamptz default now()
);

create table if not exists posts (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists comments (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  video_id bigint references videos(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists follows (
  follower_id uuid references auth.users(id) on delete cascade,
  following_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

create table if not exists likes (
  user_id uuid references auth.users(id) on delete cascade,
  video_id bigint references videos(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, video_id)
);

create table if not exists messages (
  id bigint generated always as identity primary key,
  sender_id uuid references auth.users(id) on delete cascade,
  receiver_id uuid references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  read boolean default false
);

create table if not exists live_rooms (
  id bigint generated always as identity primary key,
  host_id uuid references auth.users(id) on delete cascade,
  title text not null,
  category text default 'Just Chatting',
  active boolean default true,
  viewer_count integer default 0,
  started_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists live_messages (
  id bigint generated always as identity primary key,
  room_id bigint references live_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists live_reactions (
  id bigint generated always as identity primary key,
  room_id bigint references live_rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reaction text not null,
  created_at timestamptz default now()
);

-- Safe migrations for an existing Beyond Supabase project
alter table videos add column if not exists hashtags text default '';
alter table videos add column if not exists status text default 'published';
alter table videos add column if not exists views_count bigint default 0;
alter table videos add column if not exists likes_count integer default 0;
alter table videos add column if not exists visibility text default 'public';
alter table videos add column if not exists comments_enabled boolean default true;

create index if not exists messages_receiver_idx on messages(receiver_id, created_at desc);
create index if not exists live_messages_room_idx on live_messages(room_id, created_at);
create index if not exists live_rooms_active_idx on live_rooms(active, started_at desc);
create index if not exists videos_user_idx on videos(user_id, created_at desc);
create index if not exists comments_video_idx on comments(video_id, created_at);
create index if not exists likes_video_idx on likes(video_id, created_at);

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

alter table profiles enable row level security;
alter table videos enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;
alter table follows enable row level security;
alter table likes enable row level security;
alter table messages enable row level security;
alter table live_rooms enable row level security;
alter table live_messages enable row level security;
alter table live_reactions enable row level security;

-- Policies are created only when absent so this script can be re-run safely.
do $$ begin
  create policy "profiles are publicly readable" on profiles for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users create their profile" on profiles for insert to authenticated with check (id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update their profile" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "videos are readable" on videos for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users create their videos" on videos for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update their videos" on videos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete their videos" on videos for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "comments are readable" on comments for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users create comments" on comments for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete own comments" on comments for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "likes are readable" on likes for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users like" on likes for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users unlike" on likes for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "follows are readable" on follows for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users follow" on follows for insert to authenticated with check (follower_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users unfollow" on follows for delete to authenticated using (follower_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "live rooms are readable" on live_rooms for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users create live rooms" on live_rooms for insert to authenticated with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "hosts update live rooms" on live_rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "live messages are readable" on live_messages for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated users send live messages" on live_messages for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "live reactions are readable" on live_reactions for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authenticated users send live reactions" on live_reactions for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Beyond users can upload videos" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Beyond videos are publicly readable" on storage.objects for select to public
  using (bucket_id = 'videos');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Beyond users can delete their videos" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;

alter table videos replica identity full;
alter table likes replica identity full;
alter table comments replica identity full;
alter table messages replica identity full;

do $$ begin
  alter publication supabase_realtime add table videos;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table likes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table comments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; end $$;

create index if not exists follows_following_idx on follows(following_id, created_at desc);
create index if not exists follows_follower_idx on follows(follower_id, created_at desc);


-- Storage safety for Beyond video files
do $$ begin
  create policy "Beyond users can update their video files" on storage.objects for update to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;


-- Keep aggregate like counts synchronized with the likes table.
create or replace function public.sync_video_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.videos
      set likes_count = (select count(*) from public.likes where video_id = new.video_id)
      where id = new.video_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.videos
      set likes_count = (select count(*) from public.likes where video_id = old.video_id)
      where id = old.video_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists beyond_sync_video_likes on public.likes;
create trigger beyond_sync_video_likes
after insert or delete on public.likes
for each row execute function public.sync_video_likes_count();

-- Increment a video view through a controlled RPC so viewers do not need
-- permission to update arbitrary video rows directly.
create or replace function public.increment_video_view(video_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  update public.videos
    set views_count = coalesce(views_count,0) + 1
    where id = increment_video_view.video_id
      and status = 'published'
    returning views_count into new_count;

  return coalesce(new_count,0);
end;
$$;

grant execute on function public.increment_video_view(bigint) to anon, authenticated;

-- Make sure realtime can deliver interaction changes.
do $$ begin
  alter publication supabase_realtime add table public.videos;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.likes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.comments;
exception when duplicate_object then null; end $$;

-- Creator Settings synchronization table
create table if not exists public.creator_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.creator_settings enable row level security;
do $$ begin create policy "creator_settings_owner_select" on public.creator_settings for select to authenticated using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "creator_settings_owner_insert" on public.creator_settings for insert to authenticated with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "creator_settings_owner_update" on public.creator_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- Dashboard customization: one private settings document per creator.
create table if not exists public.dashboard_customizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.dashboard_customizations enable row level security;
do $$ begin create policy "dashboard_customizations_owner_select" on public.dashboard_customizations for select to authenticated using (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "dashboard_customizations_owner_insert" on public.dashboard_customizations for insert to authenticated with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy "dashboard_customizations_owner_update" on public.dashboard_customizations for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid()); exception when duplicate_object then null; end $$;

-- Creator moderation: allow video owners to hide comments on their own videos.
alter table public.comments add column if not exists hidden_by_creator boolean not null default false;
do $$ begin
  create policy "video owners can hide comments" on public.comments for update to authenticated
    using (exists (select 1 from public.videos v where v.id = comments.video_id and v.user_id = auth.uid()))
    with check (exists (select 1 from public.videos v where v.id = comments.video_id and v.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "video owners can delete comments" on public.comments for delete to authenticated
    using (exists (select 1 from public.videos v where v.id = comments.video_id and v.user_id = auth.uid()) or user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Realtime for Beyond Live analytics.
alter table public.live_rooms replica identity full;
alter table public.live_messages replica identity full;
alter table public.live_reactions replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.live_rooms;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.live_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.live_reactions;
exception when duplicate_object then null; end $$;

-- Realtime for follower activity used by Audience and Notifications.
alter table public.follows replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.follows;
exception when duplicate_object then null; end $$;


-- Safe realtime viewer-count RPC for Beyond Live.
create or replace function public.change_live_viewer_count(room_id bigint, delta integer)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_count bigint;
begin
  if delta not in (-1, 1) then
    raise exception 'Viewer count delta must be -1 or 1';
  end if;
  update public.live_rooms
    set viewer_count = greatest(0, coalesce(viewer_count,0) + delta)
    where id = change_live_viewer_count.room_id
      and active = true
    returning viewer_count into new_count;
  return coalesce(new_count,0);
end;
$$;
grant execute on function public.change_live_viewer_count(bigint, integer) to anon, authenticated;


-- Persistent creator branding fields.
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists accent_color text default '#ff2d55';
