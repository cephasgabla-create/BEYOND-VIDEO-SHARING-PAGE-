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


-- Posts: public feed reads, owner writes.
do $$ begin
  create policy "posts are publicly readable" on public.posts for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users create their posts" on public.posts for insert to authenticated
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users update their posts" on public.posts for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users delete their posts" on public.posts for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Direct messages: only the sender/receiver can read; only the sender can create.
do $$ begin
  create policy "users read their messages" on public.messages for select to authenticated
    using (sender_id = auth.uid() or receiver_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "users send messages" on public.messages for insert to authenticated
    with check (sender_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "receivers can mark messages read" on public.messages for update to authenticated
    using (receiver_id = auth.uid()) with check (receiver_id = auth.uid());
exception when duplicate_object then null; end $$;

alter table public.posts enable row level security;
alter table public.messages enable row level security;

create index if not exists posts_user_idx on public.posts(user_id, created_at desc);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- Ensure new profiles can be created automatically when a Supabase Auth account is registered.
create or replace function public.handle_new_beyond_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username',''),
      'beyond_' || substr(replace(new.id::text,'-',''),1,10)
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name',''),
      nullif(new.raw_user_meta_data->>'username',''),
      'Beyond User'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_beyond_auth_user_created on auth.users;
create trigger on_beyond_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_beyond_user();

-- Realtime for posts and follows/messages.
alter table public.posts replica identity full;
alter table public.messages replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.posts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;


-- Beyond For You recommendation feed.
-- Scores videos using real views, likes, comments, follows, hashtag affinity,
-- creator activity, freshness, and a small diversity factor.
create or replace function public.get_beyond_for_you_feed(p_limit integer default 30)
returns table (
  id bigint,
  user_id uuid,
  video_url text,
  caption text,
  hashtags text,
  views_count bigint,
  likes_count integer,
  comments_count bigint,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  recommendation_score numeric
)
language sql
security definer
set search_path = public
as $$
with current_user_id as (
  select auth.uid() as id
),
liked_videos as (
  select distinct l.video_id
  from likes l
  where l.user_id = (select id from current_user_id)
),
commented_videos as (
  select distinct c.video_id
  from comments c
  where c.user_id = (select id from current_user_id)
),
interest_tags as (
  select lower(trim(tag)) as tag
  from (
    select regexp_split_to_table(coalesce(v.hashtags,''), '\s+') as tag
    from videos v
    where v.id in (
      select video_id from liked_videos
      union
      select video_id from commented_videos
    )
  ) tags
  where trim(tag) <> ''
),
followed_creators as (
  select f.following_id
  from follows f
  where f.follower_id = (select id from current_user_id)
),
creator_activity as (
  select v.user_id, count(*)::numeric as recent_posts
  from videos v
  where v.status = 'published'
    and v.created_at >= now() - interval '7 days'
  group by v.user_id
),
comment_counts as (
  select c.video_id, count(*)::bigint as comments_count
  from comments c
  group by c.video_id
)
select
  v.id,
  v.user_id,
  v.video_url,
  v.caption,
  v.hashtags,
  coalesce(v.views_count,0),
  coalesce(v.likes_count,0),
  coalesce(cc.comments_count,0),
  v.created_at,
  p.username,
  p.display_name,
  p.avatar_url,
  (
    case when v.user_id in (select following_id from followed_creators) then 55 else 0 end
    + case when exists (
        select 1
        from regexp_split_to_table(lower(coalesce(v.hashtags,'')), '\s+') candidate
        where trim(candidate) <> ''
          and trim(candidate) in (select tag from interest_tags)
      ) then 30 else 0 end
    + least(25, ln(1 + greatest(coalesce(v.views_count,0),0)::numeric) * 3)
    + least(24, ln(1 + greatest(coalesce(v.likes_count,0),0)::numeric) * 5)
    + least(24, ln(1 + greatest(coalesce(cc.comments_count,0),0)::numeric) * 6)
    + least(18, coalesce(ca.recent_posts,0) * 4)
    + greatest(0, 28 - extract(epoch from (now() - v.created_at))/86400 * 2)
    + (random() * 3)
  )::numeric as recommendation_score
from videos v
join profiles p on p.id = v.user_id
left join comment_counts cc on cc.video_id = v.id
left join creator_activity ca on ca.user_id = v.user_id
where v.status = 'published'
order by recommendation_score desc, v.created_at desc
limit greatest(1, least(coalesce(p_limit,30),100));
$$;

grant execute on function public.get_beyond_for_you_feed(integer) to anon, authenticated;



-- Beyond Discover / Trending ranking.
-- Server-side ranking keeps Discover consistent across browsers and lets the
-- database combine views, likes, comments, followers and freshness.
create or replace function public.get_beyond_discover(p_limit integer default 20)
returns jsonb
language sql
security definer
set search_path = public
as $$
with published as (
  select v.id, v.user_id, v.video_url, v.caption, v.hashtags,
         coalesce(v.views_count,0)::numeric as views_count,
         coalesce(v.likes_count,0)::numeric as likes_count,
         v.created_at,
         coalesce(c.comments_count,0)::numeric as comments_count,
         coalesce(f.followers_count,0)::numeric as followers_count
  from public.videos v
  left join (
    select video_id, count(*)::numeric comments_count
    from public.comments
    group by video_id
  ) c on c.video_id = v.id
  left join (
    select following_id, count(*)::numeric followers_count
    from public.follows
    group by following_id
  ) f on f.following_id = v.user_id
  where v.status = 'published'
    and coalesce(v.visibility,'public') = 'public'
),
scored as (
  select p.*,
    (
      least(35, ln(1+p.views_count)*4)
      + least(40, ln(1+p.likes_count)*7)
      + least(35, ln(1+p.comments_count)*9)
      + least(20, ln(1+p.followers_count)*3)
      + greatest(0, 30 - extract(epoch from (now()-p.created_at))/3600*1.25)
    )::numeric as trend_score
  from published p
),
video_rows as (
  select jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'user_id', s.user_id,
      'video_url', s.video_url,
      'caption', s.caption,
      'hashtags', s.hashtags,
      'views_count', s.views_count,
      'likes_count', s.likes_count,
      'comments_count', s.comments_count,
      'created_at', s.created_at,
      'trend_score', round(s.trend_score,2),
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url
    ) order by s.trend_score desc, s.created_at desc
  ) as rows
  from (select * from scored order by trend_score desc, created_at desc limit greatest(1,least(coalesce(p_limit,20),50))) s
  left join public.profiles p on p.id=s.user_id
),
tag_rows as (
  select jsonb_agg(
    jsonb_build_object('tag',tag,'videos',video_count,'score',round(tag_score,2))
    order by tag_score desc, video_count desc, tag
  ) as rows
  from (
    select lower(regexp_replace(trim(tag),'^#+','')) as tag,
           count(*)::numeric as video_count,
           sum(
             least(35, ln(1+s.views_count)*4)
             + least(40, ln(1+s.likes_count)*7)
             + least(35, ln(1+s.comments_count)*9)
             + greatest(0, 30 - extract(epoch from (now()-s.created_at))/3600*1.25)
           )::numeric as tag_score
    from scored s
    cross join lateral regexp_split_to_table(coalesce(s.hashtags,''),'[[:space:],]+') tag
    where trim(tag) <> ''
    group by lower(regexp_replace(trim(tag),'^#+',''))
    order by tag_score desc
    limit 20
  ) t
),
creator_rows as (
  select jsonb_agg(
    jsonb_build_object(
      'user_id',x.user_id,
      'username',p.username,
      'display_name',p.display_name,
      'avatar_url',p.avatar_url,
      'videos',x.video_count,
      'followers',x.followers_count,
      'engagement',round(x.engagement,2)
    ) order by x.creator_score desc, x.video_count desc
  ) as rows
  from (
    select s.user_id,
           count(*)::numeric video_count,
           max(s.followers_count)::numeric followers_count,
           sum(s.likes_count + s.comments_count)::numeric engagement,
           (
             least(35,ln(1+max(s.followers_count))*7)
             + least(35,ln(1+sum(s.likes_count+s.comments_count))*6)
             + least(25,count(*)*4)
             + greatest(0,20-extract(epoch from (now()-max(s.created_at)))/86400*2)
           )::numeric creator_score
    from scored s
    group by s.user_id
    order by creator_score desc
    limit 12
  ) x
  left join public.profiles p on p.id=x.user_id
)
select jsonb_build_object(
  'videos', coalesce((select rows from video_rows),'[]'::jsonb),
  'hashtags', coalesce((select rows from tag_rows),'[]'::jsonb),
  'creators', coalesce((select rows from creator_rows),'[]'::jsonb)
);
$$;

grant execute on function public.get_beyond_discover(integer) to anon, authenticated;


-- Real Beyond Analytics view events.
create table if not exists public.video_views (
  id bigint generated always as identity primary key,
  video_id bigint not null references public.videos(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  viewed_at timestamptz not null default now()
);
create index if not exists video_views_video_time_idx on public.video_views(video_id, viewed_at desc);
create index if not exists video_views_time_idx on public.video_views(viewed_at desc);
alter table public.video_views enable row level security;
do $$ begin
  create policy "video owners can read their view events" on public.video_views
    for select to authenticated
    using (exists (select 1 from public.videos v where v.id=video_views.video_id and v.user_id=auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "viewers can record views" on public.video_views
    for insert to anon, authenticated
    with check (viewer_id is null or viewer_id=auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.increment_video_view(video_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_count bigint;
declare viewer uuid;
begin
  viewer := auth.uid();
  update public.videos
    set views_count = coalesce(views_count,0) + 1
    where id = increment_video_view.video_id
      and status = 'published'
    returning views_count into new_count;
  if new_count is not null then
    insert into public.video_views(video_id,viewer_id)
    values (increment_video_view.video_id,viewer);
  end if;
  return coalesce(new_count,0);
end;
$$;
grant execute on function public.increment_video_view(bigint) to anon, authenticated;

alter table public.video_views replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.video_views;
exception when duplicate_object then null; end $$;


-- Beyond follower history for Creator Studio Audience & Followers.
create table if not exists public.follower_events (
  id bigint generated always as identity primary key,
  creator_id uuid not null references auth.users(id) on delete cascade,
  follower_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('follow','unfollow')),
  created_at timestamptz not null default now()
);

create index if not exists follower_events_creator_time_idx
  on public.follower_events(creator_id, created_at desc);
create index if not exists follower_events_follower_time_idx
  on public.follower_events(follower_id, created_at desc);

alter table public.follower_events enable row level security;

do $$ begin
  create policy "creators can read their follower history"
    on public.follower_events for select to authenticated
    using (creator_id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.log_beyond_follower_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.follower_events(creator_id, follower_id, event_type)
    values (new.following_id, new.follower_id, 'follow');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.follower_events(creator_id, follower_id, event_type)
    values (old.following_id, old.follower_id, 'unfollow');
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists beyond_log_follow_event on public.follows;
create trigger beyond_log_follow_event
after insert or delete on public.follows
for each row execute function public.log_beyond_follower_event();

alter table public.follower_events replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.follower_events;
exception when duplicate_object then null; end $$;


-- Beyond backend foundation: notifications and synchronized interaction counters.
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('like','comment','follow','message')),
  video_id bigint references public.videos(id) on delete cascade,
  comment_id bigint references public.comments(id) on delete cascade,
  message text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_time_idx
  on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications(user_id, read, created_at desc);

alter table public.notifications enable row level security;

do $$ begin
  create policy "users read their notifications"
    on public.notifications for select to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users mark their notifications read"
    on public.notifications for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.create_beyond_notification(
  target_user uuid,
  actor uuid,
  notification_type text,
  target_video bigint default null,
  target_comment bigint default null,
  notification_message text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user is null or actor is null or target_user = actor then
    return;
  end if;

  insert into public.notifications(
    user_id, actor_id, type, video_id, comment_id, message
  )
  values (
    target_user, actor, notification_type, target_video, target_comment,
    left(coalesce(notification_message,''), 500)
  );
end;
$$;

revoke all on function public.create_beyond_notification(uuid,uuid,text,bigint,bigint,text) from public;
grant execute on function public.create_beyond_notification(uuid,uuid,text,bigint,bigint,text) to authenticated;

create or replace function public.beyond_like_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.videos where id = new.video_id;
  perform public.create_beyond_notification(
    owner_id, new.user_id, 'like', new.video_id, null, 'Someone liked your video.'
  );
  return new;
end;
$$;

drop trigger if exists beyond_like_notification_trigger on public.likes;
create trigger beyond_like_notification_trigger
after insert on public.likes
for each row execute function public.beyond_like_notification();

create or replace function public.beyond_comment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.videos where id = new.video_id;
  perform public.create_beyond_notification(
    owner_id, new.user_id, 'comment', new.video_id, new.id, 'Someone commented on your video.'
  );
  return new;
end;
$$;

drop trigger if exists beyond_comment_notification_trigger on public.comments;
create trigger beyond_comment_notification_trigger
after insert on public.comments
for each row execute function public.beyond_comment_notification();

create or replace function public.beyond_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_beyond_notification(
    new.following_id, new.follower_id, 'follow', null, null, 'You have a new follower.'
  );
  return new;
end;
$$;

drop trigger if exists beyond_follow_notification_trigger on public.follows;
create trigger beyond_follow_notification_trigger
after insert on public.follows
for each row execute function public.beyond_follow_notification();

create or replace function public.sync_video_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_video bigint;
begin
  target_video := case when tg_op = 'DELETE' then old.video_id else new.video_id end;
  update public.videos
    set comments_count = (
      select count(*) from public.comments
      where video_id = target_video and coalesce(hidden_by_creator,false) = false
    )
    where id = target_video;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter table public.videos add column if not exists comments_count bigint not null default 0;

drop trigger if exists beyond_sync_video_comments on public.comments;
create trigger beyond_sync_video_comments
after insert or delete on public.comments
for each row execute function public.sync_video_comment_count();

alter table public.notifications replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;

-- Secure RPC for unread notification count.
create or replace function public.get_beyond_unread_notification_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.notifications
  where user_id = auth.uid() and read = false;
$$;

grant execute on function public.get_beyond_unread_notification_count() to authenticated;


-- Allow each authenticated user to clear only their own notifications.
do $$ begin
  create policy "users delete their notifications"
    on public.notifications for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;


-- Lock down notification creation to trusted database triggers only.
-- The notification creator is security-definer and is invoked by database triggers.
-- Clients should not be able to manufacture arbitrary notifications.
revoke execute on function public.create_beyond_notification(uuid, uuid, text, bigint, bigint, text) from public;
revoke execute on function public.create_beyond_notification(uuid, uuid, text, bigint, bigint, text) from authenticated;
