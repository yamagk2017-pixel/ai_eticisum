-- Prevent duplicate like/tag reactions from the same user.
-- Run this once in Supabase SQL editor.

begin;

create table if not exists public.tweet_reactions (
  id bigint generated always as identity primary key,
  user_key text not null,
  tweet_id text not null,
  target_type text not null check (target_type in ('tweet_like', 'tag_like')),
  tweet_tag_id text not null default '',
  created_at timestamptz not null default now(),
  constraint tweet_reactions_tweet_tag_required
    check (
      (target_type = 'tweet_like' and tweet_tag_id = '')
      or (target_type = 'tag_like' and tweet_tag_id <> '')
    )
);

create unique index if not exists ux_tweet_reactions_unique_user_target
  on public.tweet_reactions (user_key, tweet_id, target_type, tweet_tag_id);

commit;
