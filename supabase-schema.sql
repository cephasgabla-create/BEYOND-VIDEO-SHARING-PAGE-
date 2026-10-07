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

create index if not exists messages_receiver_idx on messages(receiver_id, created_at desc);
create index if not exists live_messages_room_idx on live_messages(room_id, created_at);
create index if not exists live_rooms_active_idx on live_rooms(active, created_at desc);


-- Run once in Supabase SQL Editor:
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "Beyond users can upload videos"
on storage.objects for insert
to authenticated
with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Beyond videos are publicly readable"
on storage.objects for select
to public
using (bucket_id = 'videos');

create policy "Beyond users can delete their videos"
on storage.objects for delete
to authenticated
using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);


-- Beyond production security: enable RLS on user data
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

create policy "profiles are publicly readable" on profiles for select using (true);
create policy "users create their profile" on profiles for insert to authenticated with check (id = auth.uid());
create policy "users update their profile" on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "published videos are readable" on videos for select using (true);
create policy "users create their videos" on videos for insert to authenticated with check (user_id = auth.uid());
create policy "users update their videos" on videos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their videos" on videos for delete to authenticated using (user_id = auth.uid());

create policy "posts are readable" on posts for select using (true);
create policy "users create posts" on posts for insert to authenticated with check (user_id = auth.uid());
create policy "users delete own posts" on posts for delete to authenticated using (user_id = auth.uid());

create policy "comments are readable" on comments for select using (true);
create policy "users create comments" on comments for insert to authenticated with check (user_id = auth.uid());
create policy "users delete own comments" on comments for delete to authenticated using (user_id = auth.uid());

create policy "follows are readable" on follows for select using (true);
create policy "users follow" on follows for insert to authenticated with check (follower_id = auth.uid());
create policy "users unfollow" on follows for delete to authenticated using (follower_id = auth.uid());

create policy "likes are readable" on likes for select using (true);
create policy "users like" on likes for insert to authenticated with check (user_id = auth.uid());
create policy "users unlike" on likes for delete to authenticated using (user_id = auth.uid());

create policy "users read their messages" on messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy "users send messages" on messages for insert to authenticated with check (sender_id = auth.uid());
create policy "users update received messages" on messages for update to authenticated using (receiver_id = auth.uid());

create policy "live rooms are readable" on live_rooms for select using (true);
create policy "users create live rooms" on live_rooms for insert to authenticated with check (host_id = auth.uid());
create policy "hosts update live rooms" on live_rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

create policy "live messages are readable" on live_messages for select using (true);
create policy "authenticated users send live messages" on live_messages for insert to authenticated with check (user_id = auth.uid());

create policy "live reactions are readable" on live_reactions for select using (true);
create policy "authenticated users send live reactions" on live_reactions for insert to authenticated with check (user_id = auth.uid());

alter table videos replica identity full;
alter table likes replica identity full;
alter table comments replica identity full;
alter table messages replica identity full;

-- Enable realtime for the main social tables. If a table is already in the
-- publication, Supabase may report that it is already present.
alter publication supabase_realtime add table videos;
alter publication supabase_realtime add table likes;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table messages;
