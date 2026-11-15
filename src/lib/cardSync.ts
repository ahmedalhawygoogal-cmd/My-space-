import type { Card } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { compressImageDataUrl, now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { assertOnline, supabase, throwIfError } from './supabase'
import { isUuid } from './taskSync'

const IMAGE_BUCKET = 'card_images'
const IMAGE_MAX_EDGE = 1024
const IMAGE_QUALITY = 0.8

type RemoteCard = {
  id: string
  deck_id: string
  user_id: string
  front: string | null
  back: string | null
  example: string | null
  note: string | null
  image_url: string | null
  next_review_date: string | null
  interval: number | null
  ease_factor: number | null
  repetitions: number | null
  created_at: string | null
  reviews?: number | null
  translation?: string | null
  definition?: string | null
  example_translation?: string | null
  explanation?: string | null
  status?: string | null
  lapses?: number | null
  mistakes?: number | null
  updated_at?: string | null
  deleted_at?: string | null
}

function asStatus(raw: string | null | undefined, fallback: Card['status'] = 'new'): Card['status'] {
  return raw === 'new' || raw === 'learning' || raw === 'review' || raw === 'learned'
    ? raw
    : fallback
}

function parseTime(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  const t = Date.parse(raw)
  return Number.isFinite(t) ? t : undefined
}

function remoteToLocal(row: RemoteCard, prev?: Card): Card {
  const createdAt = row.created_at ? Date.parse(row.created_at) : NaN
  const updatedAt = row.updated_at ? Date.parse(row.updated_at) : NaN
  const due = parseTime(row.next_review_date) ?? prev?.nextReviewDate ?? prev?.dueAt ?? now()
  const imageUrl = row.image_url || undefined
  const prevImage = prev?.imageBlob || prev?.imageDataUrl
  const prevIsUrl = !!prevImage && /^https?:\/\//i.test(prevImage)
  // A URL set on another device wins; an empty remote value means it was removed.
  const image = imageUrl ?? (prevIsUrl ? undefined : prevImage)
  const ease = row.ease_factor ?? prev?.easeFactor ?? prev?.ease ?? 2.5
  const reps = row.repetitions ?? prev?.repetitions ?? 0
  return {
    id: row.id,
    deckId: row.deck_id || prev?.deckId || '',
    front: row.front ?? prev?.front ?? '',
    back: row.back ?? prev?.back ?? '',
    example: row.example ?? prev?.example ?? '',
    note: row.note ?? prev?.note ?? '',
    imageBlob: image,
    reviews: row.reviews ?? prev?.reviews ?? reps,
    nextReviewDate: due,
    translation: row.translation ?? prev?.translation ?? '',
    definition: row.definition ?? prev?.definition ?? '',
    exampleTranslation: row.example_translation ?? prev?.exampleTranslation ?? '',
    explanation: row.explanation ?? prev?.explanation ?? '',
    imageDataUrl: image,
    status: asStatus(row.status, prev?.status),
    ease,
    easeFactor: ease,
    interval: row.interval ?? prev?.interval ?? 0,
    repetitions: reps,
    dueAt: due,
    lapses: row.lapses ?? prev?.lapses ?? 0,
    mistakes: row.mistakes ?? prev?.mistakes ?? 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : prev?.updatedAt ?? now(),
  }
}

function localToRemote(card: Card, userId: string): RemoteCard {
  const due = card.nextReviewDate ?? card.dueAt
  const image = card.imageBlob || card.imageDataUrl
  const imageUrl = image && /^https?:\/\//i.test(image) ? image : null
  return {
    id: card.id,
    deck_id: card.deckId,
    user_id: userId,
    front: card.front ?? '',
    back: card.back ?? '',
    example: card.example ?? '',
    note: card.note ?? '',
    image_url: imageUrl,
    next_review_date: due != null ? new Date(due).toISOString() : null,
    interval: card.interval ?? 0,
    ease_factor: card.easeFactor ?? card.ease ?? 2.5,
    repetitions: card.repetitions ?? 0,
    created_at: new Date(card.createdAt || now()).toISOString(),
    reviews: card.reviews ?? 0,
    translation: card.translation ?? '',
    definition: card.definition ?? '',
    example_translation: card.exampleTranslation ?? '',
    explanation: card.explanation ?? '',
    status: card.status ?? 'new',
    lapses: card.lapses ?? 0,
    mistakes: card.mistakes ?? 0,
    updated_at: new Date(card.updatedAt || now()).toISOString(),
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

/**
 * Compresses a picked image and uploads it to the `card_images` bucket, so cards
 * sync without shipping base64 data URLs through the database.
 * Returns the public URL, or null when offline / not signed in.
 */
export async function uploadCardImage(cardId: string, dataUrl: string): Promise<string | null> {
  if (!supabase || !dataUrl.startsWith('data:')) return null
  const uid = await userId()
  if (!uid) return null
  try {
    const blob = await compressImageDataUrl(dataUrl, IMAGE_MAX_EDGE, IMAGE_QUALITY)
    if (!blob) return null
    const path = `${uid}/${cardId}.jpg`
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
      cacheControl: '31536000',
    })
    if (error) return null
    const { data } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl || null
  } catch {
    return null
  }
}

export async function upsertRemoteCard(card: Card): Promise<void> {
  if (!isUuid(card.id) || !isUuid(card.deckId)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    const { error } = await supabase.from('cards').upsert(localToRemote(card, uid), { onConflict: 'id' })
    if (error) console.error('[Cards] Failed to upsert next review date', error)
  } catch (error) {
    console.error('[Cards] Failed to upsert next review date', error)
  }
}

export async function removeRemoteCard(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    // Soft delete: the tombstone stops other devices from re-uploading this row.
    const stamp = new Date().toISOString()
    await supabase
      .from('cards')
      .update({ deleted_at: stamp, updated_at: stamp })
      .eq('id', id)
      .eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalCards(cards: Card[]): Promise<void> {
  assertOnline()
  const uid = await userId()
  if (!supabase || !uid) throw new Error('not signed in')
  const rows = cards.filter((c) => isUuid(c.id) && isUuid(c.deckId)).map((c) => localToRemote(c, uid))
  if (!rows.length) return
  throwIfError(await supabase.from('cards').upsert(rows, { onConflict: 'id' }))
}

export async function syncCardsFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', uid)
      .is('deleted_at', null)
    if (error || !data) return false
    // Tombstones are fetched separately so a row deleted elsewhere is also
    // dropped locally — otherwise the merge would push it straight back.
    const { data: tombstones } = await supabase
      .from('cards')
      .select('id')
      .eq('user_id', uid)
      .not('deleted_at', 'is', null)
    const deletedIds = new Set((tombstones ?? []).map((r) => (r as { id: string }).id))
    const local = await db.getAll<Card>(STORES.cards)
    const localById = new Map(local.map((c) => [c.id, c]))
    const remote = data as RemoteCard[]
    const seen = new Set<string>()
    const merged: Card[] = []
    for (const row of remote) {
      if (!isUuid(row.id)) continue
      seen.add(row.id)
      merged.push(remoteToLocal(row, localById.get(row.id)))
    }
    for (const c of local) {
      if (seen.has(c.id) || deletedIds.has(c.id)) continue
      merged.push(c)
    }
    for (const id of deletedIds) await db.deleteById(STORES.cards, id)
    await db.putMany(STORES.cards, merged)
    await pushLocalCards(merged)
    return true
  } catch {
    return false
  }
}
