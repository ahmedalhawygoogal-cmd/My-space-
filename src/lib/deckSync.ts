import type { Deck } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { supabase } from './supabase'
import { isUuid } from './taskSync'

type RemoteDeck = {
  id: string
  user_id: string
  name: string | null
  type: string | null
  created_at: string | null
}

function asDeckType(raw: string | null | undefined, fallback: Deck['type'] = 'vocab'): Deck['type'] {
  if (raw === 'phrases' || raw === 'synonyms' || raw === 'definitions' || raw === 'antonyms' || raw === 'vocab') return raw
  return fallback
}

function remoteToLocal(row: RemoteDeck, prev?: Deck): Deck {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  return {
    id: row.id,
    name: row.name ?? prev?.name ?? '',
    type: asDeckType(row.type, prev?.type),
    cardCount: prev?.cardCount ?? 0,
    description: prev?.description ?? '',
    subjectId: prev?.subjectId,
    tags: prev?.tags ?? [],
    noteId: prev?.noteId,
    nativeLang: prev?.nativeLang || 'ar',
    targetLang: prev?.targetLang || 'en',
    swapped: prev?.swapped ?? false,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: prev?.updatedAt ?? now(),
  }
}

function localToRemote(deck: Deck, userId: string): RemoteDeck {
  return {
    id: deck.id,
    user_id: userId,
    name: deck.name ?? '',
    type: deck.type ?? 'vocab',
    created_at: new Date(deck.createdAt || now()).toISOString(),
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
    await supabase.from('decks').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalDecks(decks: Deck[]): Promise<void> {
  const uid = await userId()
  if (!supabase || !uid) return
  const rows = decks.filter((d) => isUuid(d.id)).map((d) => localToRemote(d, uid))
  if (!rows.length) return
  try {
    await supabase.from('decks').upsert(rows, { onConflict: 'id' })
  } catch {
    return
  }
}

export async function syncDecksFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase.from('decks').select('*').eq('user_id', uid)
    if (error || !data) return false
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
      if (!seen.has(d.id)) merged.push(d)
    }
    await db.putMany(STORES.decks, merged)
    await pushLocalDecks(merged)
    return true
  } catch {
    return false
  }
}
