-- Phase 2.3 — storage buckets for recordings and card images.
--
-- Previously the audio bucket was named `recordings`, the same as its table.
-- That collided with table calls, and the bucket was public. This migration
-- creates a dedicated private bucket, plus a bucket for compressed card images.
--
-- Run this in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ---------------------------------------------------------------- buckets
insert into storage.buckets (id, name, public)
values ('recordings_audio', 'recordings_audio', false)
on conflict (id) do update set public = false;

-- Card images are rendered directly in <img src>, so this bucket is public
-- (writes are still owner-only). Swap to false and use signed URLs if the
-- images ever become sensitive.
insert into storage.buckets (id, name, public)
values ('card_images', 'card_images', true)
on conflict (id) do update set public = true;

-- Enforce a sane size/type ceiling at the bucket level.
update storage.buckets
   set file_size_limit = 52428800, -- 50 MB
       allowed_mime_types = array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac']
 where id = 'recordings_audio';

update storage.buckets
   set file_size_limit = 5242880, -- 5 MB
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'card_images';

-- ---------------------------------------------------------------- policies
-- Objects live under `<auth.uid()>/<file>`, so the first path segment must
-- match the owner. `create policy` has no IF NOT EXISTS, hence the drops.

-- recordings_audio: owner-only read/write, no public access.
drop policy if exists "recordings_audio_select_own" on storage.objects;
create policy "recordings_audio_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'recordings_audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recordings_audio_insert_own" on storage.objects;
create policy "recordings_audio_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recordings_audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recordings_audio_update_own" on storage.objects;
create policy "recordings_audio_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'recordings_audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recordings_audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "recordings_audio_delete_own" on storage.objects;
create policy "recordings_audio_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recordings_audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- card_images: public read is handled by the public bucket flag, writes are owner-only.
drop policy if exists "card_images_insert_own" on storage.objects;
create policy "card_images_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card_images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "card_images_update_own" on storage.objects;
create policy "card_images_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'card_images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'card_images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "card_images_delete_own" on storage.objects;
create policy "card_images_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card_images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------- notes
-- The old public `recordings` bucket is obsolete: it has been deleted and
-- signedAudioUrl() no longer accepts a legacy public URL. `cloud_url` must be
-- an object path inside `recordings_audio`.
