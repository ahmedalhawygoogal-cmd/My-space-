import type { Recording } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

const BUCKET = 'recordings'

type RemoteRecording = {
  id: string
  user_id: string
  name: string | null
  duration: number | null
  cloud_url: string | null
  created_at: string | null
}

function remoteToLocal(row: RemoteRecording, prev?: Recording): Recording {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  const durationMs = row.duration ?? prev?.durationMs ?? 0
  return {
    id: row.id,
    name: row.name ?? prev?.name ?? '',
    durationMs,
    mimeType: prev?.mimeType ?? 'audio/mp4',
    sizeBytes: prev?.sizeBytes ?? 0,
    folderId: prev?.folderId,
    subjectId: prev?.subjectId,
    description: prev?.description ?? '',
    tags: prev?.tags ?? [],
    noteIds: prev?.noteIds ?? [],
    distance: prev?.distance ?? 'medium',
    enhanced: prev?.enhanced ?? false,
    cloudUrl: row.cloud_url || prev?.cloudUrl,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: prev?.updatedAt ?? now(),
  }
}

function localToRemote(rec: Recording, userId: string): RemoteRecording {
  return {
    id: rec.id,
    user_id: userId,
    name: rec.name ?? '',
    duration: rec.durationMs ?? 0,
    cloud_url: rec.cloudUrl ?? '',
    created_at: new Date(rec.createdAt || now()).toISOString(),
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

function objectPath(uid: string, id: string): string {
  return `${uid}/${id}.m4a`
}

async function uploadAudio(uid: string, id: string, blob: Blob): Promise<string | null> {
  if (!supabase) return null
  const path = objectPath(uid, id)
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type || 'audio/mp4',
  })
  if (error) return null
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}

async function persistCloudUrl(rec: Recording, cloudUrl: string): Promise<Recording> {
  if (rec.cloudUrl === cloudUrl) return rec
  const next: Recording = { ...rec, cloudUrl, updatedAt: now() }
  await db.putOne(STORES.recordings, next)
  return next
}

async function hydrateBlob(rec: Recording): Promise<void> {
  if (!rec.cloudUrl) return
  const existing = await db.getById<{ id: string; blob: Blob }>(STORES.audioBlobs, rec.id)
  if (existing?.blob) return
  const res = await fetch(rec.cloudUrl)
  if (!res.ok) return
  const blob = await res.blob()
  await db.putOne(STORES.audioBlobs, { id: rec.id, blob })
}

export async function pushRecordingToCloud(rec: Recording, blob?: Blob): Promise<void> {
  if (!isUuid(rec.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    let next = rec
    const file = blob ?? (await db.getById<{ id: string; blob: Blob }>(STORES.audioBlobs, rec.id))?.blob
    if (file) {
      const url = await uploadAudio(uid, rec.id, file)
      if (url) next = await persistCloudUrl(rec, url)
    }
    await supabase.from(BUCKET).upsert(localToRemote(next, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function upsertRemoteRecording(rec: Recording): Promise<void> {
  if (!isUuid(rec.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from(BUCKET).upsert(localToRemote(rec, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteRecording(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.storage.from(BUCKET).remove([objectPath(uid, id)])
    await supabase.from(BUCKET).delete().eq('id', id).eq('user_id', uid)
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
      const path = objectPath(uid, rec.id)
      throwIfError(
        await supabase.storage.from(BUCKET).upload(path, file, {
          upsert: true,
          contentType: file.type || 'audio/mp4',
        }),
      )
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
      if (data.publicUrl) next = await persistCloudUrl(rec, data.publicUrl)
    }
    throwIfError(await supabase.from(BUCKET).upsert(localToRemote(next, uid), { onConflict: 'id' }))
  }
}

export async function syncRecordingsFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase.from(BUCKET).select('*').eq('user_id', uid)
    if (error || !data) return false
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
      if (!seen.has(r.id)) merged.push(r)
    }
    await db.putMany(STORES.recordings, merged)
    await Promise.all(merged.map((r) => hydrateBlob(r).catch(() => undefined)))
    await pushLocalRecordings(merged)
    return true
  } catch {
    return false
  }
}
