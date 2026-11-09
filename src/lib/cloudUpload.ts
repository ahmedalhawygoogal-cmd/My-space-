import type { Card, Deck, Note, Recording, Task } from '../types'
import * as db from '../db'
import { STORES } from '../db'
import { isCloudSyncEnabled } from './cloudPref'
import { pushLocalCards } from './cardSync'
import { pushLocalDecks } from './deckSync'
import { migrateLocalDataToCloud } from './migrateLocal'
import { pushLocalNotes } from './noteSync'
import { pushLocalRecordings } from './recordingSync'
import { pushLocalTasks } from './taskSync'

export async function uploadLocalDataToCloud(): Promise<void> {
  if (!isCloudSyncEnabled()) return
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
