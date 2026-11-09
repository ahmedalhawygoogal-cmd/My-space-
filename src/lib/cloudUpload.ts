import type { Card, Deck, Note, Recording, Task } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { isCloudSyncEnabled } from './cloudPref'
import { pushLocalCards } from './cardSync'
import { pushLocalDecks } from './deckSync'
import { migrateLocalDataToCloud } from './migrateLocal'
import { pushLocalNotes } from './noteSync'
import { pushLocalRecordings } from './recordingSync'
import { assertOnline, supabase, throwIfError } from './supabase'
import { pushLocalTasks } from './taskSync'

export async function uploadLocalDataToCloud(): Promise<void> {
  assertOnline()
  if (!isCloudSyncEnabled()) throw new Error('cloud disabled')
  if (!supabase) throw new Error('missing supabase')
  const session = throwIfError(await supabase.auth.getSession())
  if (!session.data.session?.user.id) throw new Error('not signed in')
  await migrateLocalDataToCloud()
  const [tasks, notes, decks, cards, recordings] = await Promise.all([
    db.getAll<Task>(STORES.tasks),
    db.getAll<Note>(STORES.notes),
    db.getAll<Deck>(STORES.decks),
    db.getAll<Card>(STORES.cards),
    db.getAll<Recording>(STORES.recordings),
  ])
  await pushLocalDecks(decks)
  await pushLocalNotes(notes)
  await pushLocalTasks(tasks)
  await pushLocalCards(cards)
  await pushLocalRecordings(recordings)
}
