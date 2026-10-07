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
