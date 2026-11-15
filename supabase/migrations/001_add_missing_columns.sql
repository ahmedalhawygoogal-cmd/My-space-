-- Phase 2.1 — align the remote schema with the local models and add soft-delete tombstones.
--
-- Why: the sync layer only ever wrote a handful of columns, so most local fields
-- (due dates, subtasks, tags, attachments, SM-2 state, ...) were silently dropped,
-- and deletes used hard DELETE, which let another device re-upload a deleted row.
--
-- Every statement is idempotent (`if not exists`), so this file is safe to re-run.

-- ---------------------------------------------------------------- tasks
alter table public.tasks
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists deleted_at   timestamptz,
  add column if not exists start_date   timestamptz,
  add column if not exists due_date     timestamptz,
  add column if not exists subject_id   text,
  add column if not exists note_id      text,
  add column if not exists recording_id text,
  add column if not exists deck_id      text,
  add column if not exists remind       boolean not null default false,
  add column if not exists recurring    text    not null default 'none',
  add column if not exists subtasks     jsonb   not null default '[]'::jsonb,
  add column if not exists completed_at timestamptz;

-- ---------------------------------------------------------------- notes
alter table public.notes
  add column if not exists updated_at    timestamptz not null default now(),
  add column if not exists deleted_at    timestamptz,
  add column if not exists notebook_id   text,
  add column if not exists folder_id     text,
  add column if not exists audio_id      text,
  add column if not exists subject_id    text,
  add column if not exists tags          jsonb not null default '[]'::jsonb,
  add column if not exists recording_ids jsonb not null default '[]'::jsonb,
  add column if not exists task_ids      jsonb not null default '[]'::jsonb,
  add column if not exists attachments   jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------- decks
alter table public.decks
  add column if not exists updated_at   timestamptz not null default now(),
  add column if not exists deleted_at   timestamptz,
  add column if not exists description  text,
  add column if not exists subject_id   text,
  add column if not exists note_id      text,
  add column if not exists tags         jsonb   not null default '[]'::jsonb,
  add column if not exists native_lang  text,
  add column if not exists target_lang  text,
  add column if not exists swapped      boolean not null default false,
  add column if not exists card_count   integer not null default 0;

-- ---------------------------------------------------------------- cards
-- Review state (SM-2) is stored locally today; these columns keep it across devices.
-- Card images stay in image_url (public URL) — base64 data URLs are never pushed.
alter table public.cards
  add column if not exists updated_at          timestamptz not null default now(),
  add column if not exists deleted_at          timestamptz,
  add column if not exists reviews             integer not null default 0,
  add column if not exists translation         text,
  add column if not exists definition          text,
  add column if not exists example_translation text,
  add column if not exists explanation         text,
  add column if not exists status              text    not null default 'new',
  add column if not exists lapses              integer not null default 0,
  add column if not exists mistakes            integer not null default 0;

-- ---------------------------------------------------------------- recordings
-- The audio itself lives in Storage; these are the metadata columns.
alter table public.recordings
  add column if not exists updated_at  timestamptz not null default now(),
  add column if not exists deleted_at  timestamptz,
  add column if not exists mime_type   text,
  add column if not exists size_bytes  bigint,
  add column if not exists folder_id   text,
  add column if not exists subject_id  text,
  add column if not exists description text,
  add column if not exists tags        jsonb   not null default '[]'::jsonb,
  add column if not exists note_ids    jsonb   not null default '[]'::jsonb,
  add column if not exists distance    text    not null default 'medium',
  add column if not exists enhanced    boolean not null default false;

-- ---------------------------------------------------------------- habits
alter table public.habits
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------- habit_logs
alter table public.habit_logs
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- ---------------------------------------------------------------- indexes
-- Every sync read filters by user_id and skips tombstones.
create index if not exists tasks_user_deleted_idx       on public.tasks       (user_id, deleted_at);
create index if not exists notes_user_deleted_idx       on public.notes       (user_id, deleted_at);
create index if not exists decks_user_deleted_idx       on public.decks       (user_id, deleted_at);
create index if not exists cards_user_deleted_idx       on public.cards       (user_id, deleted_at);
create index if not exists recordings_user_deleted_idx  on public.recordings  (user_id, deleted_at);
create index if not exists habits_user_deleted_idx      on public.habits      (user_id, deleted_at);
create index if not exists habit_logs_user_deleted_idx  on public.habit_logs  (user_id, deleted_at);
create index if not exists profiles_user_deleted_idx    on public.profiles    (deleted_at);
