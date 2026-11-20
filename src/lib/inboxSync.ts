import type { InboxItem } from '../types'
import * as db from '../db'
import { SPACE_STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

type RemoteInboxItem = {
  id: string
  user_id: string
  space_id?: string | null
  type?: string | null
  title?: string | null
  body?: string | null
  source?: string | null
  status?: string | null
  converted_entity_id?: string | null
  converted_entity_type?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
  updated_at?: string | null
  processed_at?: string | null
  deleted_at?: string | null
}

function remoteToLocal(row: RemoteInboxItem, prev?: InboxItem): InboxItem {
  return {
    id: row.id,
    user_id: row.user_id,
    space_id: row.space_id ?? prev?.space_id ?? null,
    type: (row.type as InboxItem['type']) ?? prev?.type ?? 'note',
    title: row.title ?? prev?.title ?? '',
    body: row.body ?? prev?.body ?? null,
    source: (row.source as InboxItem['source']) ?? prev?.source ?? 'quick_capture',
    status: (row.status as InboxItem['status']) ?? prev?.status ?? 'unprocessed',
    converted_entity_id: row.converted_entity_id ?? prev?.converted_entity_id ?? null,
    converted_entity_type:
      (row.converted_entity_type as InboxItem['converted_entity_type']) ??
      prev?.converted_entity_type ??
      null,
    metadata: row.metadata ?? prev?.metadata ?? {},
    created_at: row.created_at ?? prev?.created_at ?? new Date(now()).toISOString(),
    updated_at: row.updated_at ?? prev?.updated_at ?? new Date(now()).toISOString(),
    processed_at: row.processed_at ?? prev?.processed_at ?? null,
  }
}

function localToRemote(item: InboxItem, userId: string): RemoteInboxItem {
  return {
    id: item.id,
    user_id: userId,
    space_id: item.space_id ?? null,
    type: item.type,
    title: item.title ?? '',
    body: item.body ?? null,
    source: item.source,
    status: item.status,
    converted_entity_id: item.converted_entity_id ?? null,
    converted_entity_type: item.converted_entity_type ?? null,
    metadata: item.metadata ?? {},
    created_at: item.created_at,
    updated_at: item.updated_at,
    processed_at: item.processed_at ?? null,
  }
}

async function currentUserId(): Promise<string | null> {
  if (!supabase || !isCloudSyncEnabled()) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}

export async function upsertRemoteInboxItem(item: InboxItem): Promise<void> {
  if (!isUuid(item.id)) return
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    await supabase.from('inbox_items').upsert(localToRemote(item, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteInboxItem(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await currentUserId()
  if (!supabase || !uid) return
  try {
    // Soft delete keeps a tombstone so another device does not re-upload it.
    const stamp = new Date().toISOString()
    await supabase
      .from('inbox_items')
      .update({ deleted_at: stamp, updated_at: stamp })
      .eq('id', id)
      .eq('user_id', uid)
  } catch {
    return
  }
}

async function pushLocalInbox(items: InboxItem[]): Promise<void> {
  const uid = await currentUserId()
  if (!supabase || !uid) return
  const rows = items.filter((x) => isUuid(x.id)).map((x) => localToRemote(x, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('inbox_items').upsert(rows, { onConflict: 'id' }))
}

/**
 * Merges the cloud inbox into IndexedDB. Tombstones drop items deleted on
 * another device, then everything local is pushed back so offline captures
 * survive the next reload.
 */
export async function syncInboxFromCloud(): Promise<boolean> {
  const uid = await currentUserId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from('inbox_items')
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    const { data: tombstones } = await supabase
      .from('inbox_items')
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))
    const local = await db.getAll<InboxItem>(SPACE_STORES.inbox)
    const localById = new Map(local.map((x) => [x.id, x]))
    const remote = data as RemoteInboxItem[]
    const seen = new Set<string>()
    const merged: InboxItem[] = []
    for (const row of remote) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      merged.push(remoteToLocal(row, localById.get(row.id)))
    }
    for (const item of local) {
      if (seen.has(item.id) || deletedIds.has(item.id)) continue
      merged.push(item)
    }
    for (const id of deletedIds) await db.deleteById(SPACE_STORES.inbox, id)
    await db.putMany(SPACE_STORES.inbox, merged)
    await pushLocalInbox(merged)
    return true
  } catch {
    return false
  }
}
