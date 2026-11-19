import type { Deck } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

type RemoteDeck = {
  id: string
  user_id: string
  name: string | null
  type: string | null
  created_at: string | null
  description?: string | null
  subject_id?: string | null
  space_id?: string | null
  note_id?: string | null
  tags?: string[] | null
  native_lang?: string | null
  target_lang?: string | null
  swapped?: boolean | null
  card_count?: number | null
  updated_at?: string | null
  deleted_at?: string | null
}

function asDeckType(raw: string | null | undefined, fallback: Deck['type'] = 'vocab'): Deck['type'] {
  if (raw === 'phrases' || raw === 'synonyms' || raw === 'definitions' || raw === 'antonyms' || raw === 'vocab') return raw
  return fallback
}

function remoteToLocal(row: RemoteDeck, prev?: Deck): Deck {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : NaN
  return {
    id: row.id,
    name: row.name ?? prev?.name ?? '',
    type: asDeckType(row.type, prev?.type),
    cardCount: row.card_count ?? prev?.cardCount ?? 0,
    description: row.description ?? prev?.description ?? '',
    subjectId: row.subject_id ?? prev?.subjectId,
    space_id: row.space_id ?? prev?.space_id,
    tags: Array.isArray(row.tags) ? row.tags : prev?.tags ?? [],
    noteId: row.note_id ?? prev?.noteId,
    nativeLang: row.native_lang || prev?.nativeLang || 'ar',
    targetLang: row.target_lang || prev?.targetLang || 'en',
    swapped: row.swapped ?? prev?.swapped ?? false,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : prev?.updatedAt ?? now(),
  }
}

function localToRemote(deck: Deck, userId: string): RemoteDeck {
  return {
    id: deck.id,
    user_id: userId,
    name: deck.name ?? '',
    type: deck.type ?? 'vocab',
    created_at: new Date(deck.createdAt || now()).toISOString(),
    description: deck.description ?? '',
    subject_id: deck.subjectId ?? null,
    space_id: deck.space_id ?? null,
    note_id: deck.noteId ?? null,
    tags: deck.tags ?? [],
    native_lang: deck.nativeLang ?? null,
    target_lang: deck.targetLang ?? null,
    swapped: !!deck.swapped,
    card_count: deck.cardCount ?? 0,
    updated_at: new Date(deck.updatedAt || now()).toISOString(),
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

export async function upsertRemoteDeck(deck: Deck): Promise<void> {
  if (!isUuid(deck.id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('decks').upsert(localToRemote(deck, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteDeck(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    // Soft delete: the tombstone stops other devices from re-uploading this row.
    const stamp = new Date().toISOString()
    await supabase
      .from('decks')
      .update({ deleted_at: stamp, updated_at: stamp })
      .eq('id', id)
      .eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalDecks(decks: Deck[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  const rows = decks.filter((d) => isUuid(d.id)).map((d) => localToRemote(d, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('decks').upsert(rows, { onConflict: 'id' }))
}

export async function syncDecksFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    // Tombstones are fetched separately so a row deleted elsewhere is also
    // dropped locally — otherwise the merge would push it straight back.
    const { data: tombstones } = await supabase
      .from('decks')
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))
    const local = await db.getAll<Deck>(STORES.decks)
    const localById = new Map(local.map((d) => [d.id, d]))
    const remote = data as RemoteDeck[]
    const seen = new Set<string>()
    const merged: Deck[] = []
    for (const row of remote) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      merged.push(remoteToLocal(row, localById.get(row.id)))
    }
    for (const d of local) {
      if (seen.has(d.id) || deletedIds.has(d.id)) continue
      merged.push(d)
    }
    for (const id of deletedIds) await db.deleteById(STORES.decks, id)
    await db.putMany(STORES.decks, merged)
    await pushLocalDecks(merged)
    return true
  } catch {
    return false
  }
}
