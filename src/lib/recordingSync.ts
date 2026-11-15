import type { Recording } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

// The table and the storage bucket used to share the name `recordings`, which
// made storage and table calls collide. They are now separate on purpose.
const TABLE = 'recordings'
const BUCKET = 'recordings_audio'
const SIGNED_URL_TTL_SECONDS = 60 * 60
const AUDIO_EXTENSIONS = ['m4a', 'webm', 'ogg', 'wav', 'mp3', 'aac'] as const

type RemoteRecording = {
  id: string
  user_id: string
  name: string | null
  duration: number | null
  cloud_url: string | null
  created_at: string | null
  mime_type?: string | null
  size_bytes?: number | null
  folder_id?: string | null
  subject_id?: string | null
  description?: string | null
  tags?: string[] | null
  note_ids?: string[] | null
  distance?: string | null
  enhanced?: boolean | null
  updated_at?: string | null
  deleted_at?: string | null
}

function asDistance(raw: string | null | undefined, fallback: Recording['distance'] = 'medium'): Recording['distance'] {
  return raw === 'near' || raw === 'medium' || raw === 'far' ? raw : fallback
}

/** Maps a blob mime type to a file extension — web recordings are webm, not m4a. */
function extensionFor(mimeType?: string | null): string {
  const mime = (mimeType || '').toLowerCase()
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('aac')) return 'aac'
  return 'm4a'
}

function objectPath(uid: string, id: string, mimeType?: string | null): string {
  return `${uid}/${id}.${extensionFor(mimeType)}`
}

function remoteToLocal(row: RemoteRecording, prev?: Recording): Recording {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : NaN
  const durationMs = row.duration ?? prev?.durationMs ?? 0
  return {
    id: row.id,
    name: row.name ?? prev?.name ?? '',
    durationMs,
    mimeType: row.mime_type || prev?.mimeType || 'audio/mp4',
    sizeBytes: row.size_bytes ?? prev?.sizeBytes ?? 0,
    folderId: row.folder_id ?? prev?.folderId,
    subjectId: row.subject_id ?? prev?.subjectId,
    description: row.description ?? prev?.description ?? '',
    tags: Array.isArray(row.tags) ? row.tags : prev?.tags ?? [],
    noteIds: Array.isArray(row.note_ids) ? row.note_ids : prev?.noteIds ?? [],
    distance: asDistance(row.distance, prev?.distance),
    enhanced: row.enhanced ?? prev?.enhanced ?? false,
    cloudUrl: row.cloud_url || prev?.cloudUrl,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : prev?.updatedAt ?? now(),
  }
}

function localToRemote(rec: Recording, userId: string): RemoteRecording {
  return {
    id: rec.id,
    user_id: userId,
    name: rec.name ?? '',
    duration: rec.durationMs ?? 0,
    // `cloud_url` now holds the object path inside the bucket, never a URL:
    // signed URLs expire and must not be persisted.
    cloud_url: rec.cloudUrl ?? '',
    created_at: new Date(rec.createdAt || now()).toISOString(),
    mime_type: rec.mimeType ?? null,
    size_bytes: rec.sizeBytes ?? 0,
    folder_id: rec.folderId ?? null,
    subject_id: rec.subjectId ?? null,
    description: rec.description ?? '',
    tags: rec.tags ?? [],
    note_ids: rec.noteIds ?? [],
    distance: rec.distance ?? 'medium',
    enhanced: !!rec.enhanced,
    updated_at: new Date(rec.updatedAt || now()).toISOString(),
  }
}

async function userId(): Promise<string | null> {
  if (!supabase || !isCloudSyncEnabled()) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

async function uploadAudio(uid: string, id: string, blob: Blob): Promise<string | null> {
  if (!supabase) return null
  const path = objectPath(uid, id, blob.type)
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'audio/mp4',
  })
  return error ? null : path
}

/** Short-lived signed URL for playback/download. Never persisted. */
export async function signedAudioUrl(rec: Recording): Promise<string | null> {
  if (!supabase) return null
  const stored = rec.cloudUrl?.trim()
  // `cloud_url` must be an object path inside the private `recordings_audio`
  // bucket. A legacy public URL is no longer valid: that bucket was removed.
  if (stored && /^https?:\/\//i.test(stored)) return null
  const uid = await userId()
  if (!uid) return null
  const path = stored || objectPath(uid, rec.id, rec.mimeType)
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch {
    return null
  }
}

async function persistStoragePath(rec: Recording, path: string): Promise<Recording> {
  if (rec.cloudUrl === path) return rec
  const next: Recording = { ...rec, cloudUrl: path, updatedAt: now() }
  await db.putOne(STORES.recordings, next)
  return next
}

export async function pushRecordingToCloud(rec: Recording, blob?: Blob): Promise<void> {
  if (!isUuid(rec.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    let next = rec
    const file = blob ?? (await db.getById<{ id: string; blob: Blob }>(STORES.audioBlobs, rec.id))?.blob
    if (file) {
      const path = await uploadAudio(uid, rec.id, file)
      if (path) next = await persistStoragePath(rec, path)
    }
    await supabase.from(TABLE).upsert(localToRemote(next, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function upsertRemoteRecording(rec: Recording): Promise<void> {
  if (!isUuid(rec.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from(TABLE).upsert(localToRemote(rec, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteRecording(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    // The stored extension varies by mime type, so try every known one.
    await supabase.storage.from(BUCKET).remove(AUDIO_EXTENSIONS.map((ext) => `${uid}/${id}.${ext}`))
    // Soft delete the metadata row; the tombstone stops other devices from re-uploading it.
    const stamp = new Date().toISOString()
    await supabase
      .from(TABLE)
      .update({ deleted_at: stamp, updated_at: stamp })
      .eq('id', id)
      .eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalRecordings(recordings: Recording[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  for (const rec of recordings) {
    if (!isUuid(rec.id)) continue
    let next = rec
    const file = (await db.getById<{ id: string; blob: Blob }>(STORES.audioBlobs, rec.id))?.blob
    if (file) {
      const path = objectPath(uid, rec.id, file.type || rec.mimeType)
      throwIfError(
        await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type || 'audio/mp4',
        }),
      )
      next = await persistStoragePath(rec, path)
    }
    throwIfError(await supabase.from(TABLE).upsert(localToRemote(next, uid), { onConflict: 'id' }))
  }
}

export async function syncRecordingsFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    // Tombstones are fetched separately so a row deleted elsewhere is also
    // dropped locally — otherwise the merge would push it straight back.
    const { data: tombstones } = await supabase
      .from(TABLE)
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))
    const local = await db.getAll<Recording>(STORES.recordings)
    const localById = new Map(local.map((r) => [r.id, r]))
    const remote = data as RemoteRecording[]
    const seen = new Set<string>()
    const merged: Recording[] = []
    for (const row of remote) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      merged.push(remoteToLocal(row, localById.get(row.id)))
    }
    for (const r of local) {
      if (seen.has(r.id) || deletedIds.has(r.id)) continue
      merged.push(r)
    }
    for (const id of deletedIds) await db.deleteById(STORES.recordings, id)
    await db.putMany(STORES.recordings, merged)
    // Audio is hydrated on demand by getAudioBlob() when the user plays a recording.
    await pushLocalRecordings(merged)
    return true
  } catch {
    return false
  }
}
