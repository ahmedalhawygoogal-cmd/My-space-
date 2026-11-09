import type { Card } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { now } from '../utils'
import { isCloudSyncEnabled } from './cloudPref'
import { supabase } from './supabase'
import { isUuid } from './taskSync'

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
  const due = parseTime(row.next_review_date) ?? prev?.nextReviewDate ?? prev?.dueAt ?? now()
  const imageUrl = row.image_url || undefined
  const image = prev?.imageBlob || prev?.imageDataUrl || imageUrl
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
    reviews: prev?.reviews ?? reps,
    nextReviewDate: due,
    translation: prev?.translation ?? '',
    definition: prev?.definition ?? '',
    exampleTranslation: prev?.exampleTranslation ?? '',
    explanation: prev?.explanation ?? '',
    imageDataUrl: image,
    status: prev?.status ?? 'new',
    ease,
    easeFactor: ease,
    interval: row.interval ?? prev?.interval ?? 0,
    repetitions: reps,
    dueAt: due,
    lapses: prev?.lapses ?? 0,
    mistakes: prev?.mistakes ?? 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : prev?.createdAt ?? now(),
    updatedAt: prev?.updatedAt ?? now(),
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

export async function upsertRemoteCard(card: Card): Promise<void> {
  if (!isUuid(card.id) || !isUuid(card.deckId)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('cards').upsert(localToRemote(card, uid), { onConflict: 'id' })
  } catch {
    return
  }
}

export async function removeRemoteCard(id: string): Promise<void> {
  if (!isUuid(id)) return
  const uid = await userId()
  if (!supabase || !uid) return
  try {
    await supabase.from('cards').delete().eq('id', id).eq('user_id', uid)
  } catch {
    return
  }
}

export async function pushLocalCards(cards: Card[]): Promise<void> {
  const uid = await userId()
  if (!supabase || !uid) return
  const rows = cards.filter((c) => isUuid(c.id) && isUuid(c.deckId)).map((c) => localToRemote(c, uid))
  if (!rows.length) return
  try {
    await supabase.from('cards').upsert(rows, { onConflict: 'id' })
  } catch {
    return
  }
}

export async function syncCardsFromCloud(): Promise<boolean> {
  const uid = await userId()
  if (!supabase || !uid) return false
  try {
    const { data, error } = await supabase.from('cards').select('*').eq('user_id', uid)
    if (error || !data) return false
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
      if (!seen.has(c.id)) merged.push(c)
    }
    await db.putMany(STORES.cards, merged)
    await pushLocalCards(merged)
    return true
  } catch {
    return false
  }
}
