import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as db from './db'
import { STORES } from './db'
import type {
  AppSettings,
  Card,
  CardRating,
  Deck,
  DownloadItem,
  Folder,
  Lang,
  Link,
  Note,
  Notebook,
  Recording,
  SearchHit,
  Subject,
  Task,
  Theme,
} from './types'
import { APP_FONTS, DEFAULT_SETTINGS, RTL_LANGS, SUBJECT_COLORS, isUiLang } from './types'
import type { AppFont, AppFontSize } from './types'
import { contrastInk, includesText, now, startOfDay, stripHtml, uid } from './utils'

interface StoreState {
  ready: boolean
  settings: AppSettings
  subjects: Subject[]
  folders: Folder[]
  recordings: Recording[]
  decks: Deck[]
  cards: Card[]
  tasks: Task[]
  notebooks: Notebook[]
  notes: Note[]
  links: Link[]
  downloads: DownloadItem[]
}

interface StoreApi extends StoreState {
  lang: Lang
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setSettings: (p: Partial<AppSettings>) => Promise<void>
  addSubject: (name: string, color?: string) => Promise<Subject>
  updateSubject: (id: string, p: Partial<Subject>) => Promise<void>
  deleteSubject: (id: string) => Promise<void>
  addFolder: (name: string, kind: Folder['kind'], subjectId?: string) => Promise<Folder>
  updateFolder: (id: string, p: Partial<Folder>) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  addRecording: (rec: Omit<Recording, 'id' | 'createdAt' | 'updatedAt' | 'noteIds' | 'tags' | 'description'> & Partial<Recording>, blob: Blob) => Promise<Recording>
  updateRecording: (id: string, p: Partial<Recording>) => Promise<void>
  deleteRecording: (id: string) => Promise<void>
  getAudioBlob: (id: string) => Promise<Blob | undefined>
  addDownload: (name: string, blob: Blob, mimeType?: string) => Promise<DownloadItem>
  getDownloadBlob: (id: string) => Promise<Blob | undefined>
  deleteDownload: (id: string) => Promise<void>
  addDeck: (name: string, extra?: Partial<Deck>) => Promise<Deck>
  updateDeck: (id: string, p: Partial<Deck>) => Promise<void>
  deleteDeck: (id: string) => Promise<void>
  addCard: (deckId: string, data: Partial<Card> & { front: string; back: string }) => Promise<Card>
  updateCard: (id: string, p: Partial<Card>) => Promise<void>
  deleteCard: (id: string) => Promise<void>
  duplicateCard: (id: string) => Promise<Card | undefined>
  rateCard: (id: string, rating: CardRating) => Promise<void>
  recordAnswer: (id: string, correct: boolean) => Promise<void>
  pickCards: (deckId: string, count: number) => Card[]
  addTask: (data: Partial<Task> & { title: string }) => Promise<Task>
  updateTask: (id: string, p: Partial<Task>) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  addNotebook: (name: string, extra?: Partial<Notebook>) => Promise<Notebook>
  updateNotebook: (id: string, p: Partial<Notebook>) => Promise<void>
  deleteNotebook: (id: string) => Promise<void>
  addNote: (notebookId: string, extra?: Partial<Note>) => Promise<Note>
  updateNote: (id: string, p: Partial<Note>) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  linkEntities: (fromType: Link['fromType'], fromId: string, toType: Link['toType'], toId: string) => Promise<void>
  unlinkEntities: (fromType: Link['fromType'], fromId: string, toType: Link['toType'], toId: string) => Promise<void>
  search: (q: string) => SearchHit[]
  reload: () => Promise<void>
  importData: (snap: db.Snapshot) => Promise<void>
  markBackup: () => Promise<void>
}

const StoreContext = createContext<StoreApi | null>(null)

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

function applyLang(lang: Lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'
}

const APPEAR_KEY = 'myspace-appear'

function loadAppear(): { fontFamily: AppFont; fontSize: AppFontSize; accentColor: string } {
  try {
    const raw = localStorage.getItem(APPEAR_KEY)
    if (!raw) return { fontFamily: DEFAULT_SETTINGS.fontFamily, fontSize: DEFAULT_SETTINGS.fontSize, accentColor: DEFAULT_SETTINGS.accentColor }
    const parsed = JSON.parse(raw) as Partial<{ fontFamily: AppFont; fontSize: AppFontSize; accentColor: string }>
    return {
      fontFamily: parsed.fontFamily === 'tajawal' || parsed.fontFamily === 'almarai' ? parsed.fontFamily : 'cairo',
      fontSize: parsed.fontSize === 'small' || parsed.fontSize === 'large' ? parsed.fontSize : 'medium',
      accentColor: parsed.accentColor || DEFAULT_SETTINGS.accentColor,
    }
  } catch {
    return { fontFamily: DEFAULT_SETTINGS.fontFamily, fontSize: DEFAULT_SETTINGS.fontSize, accentColor: DEFAULT_SETTINGS.accentColor }
  }
}

export function applyAppearance(p: { fontFamily?: AppFont; fontSize?: AppFontSize; accentColor?: string }) {
  const root = document.documentElement
  const font = APP_FONTS.find((f) => f.id === p.fontFamily) ?? APP_FONTS[0]
  if (p.fontFamily) root.style.setProperty('--font', font.stack)
  if (p.fontSize) {
    const size = p.fontSize === 'small' ? '14px' : p.fontSize === 'large' ? '18px' : '16px'
    root.style.fontSize = size
  }
  if (p.accentColor) {
    const ink = contrastInk(p.accentColor)
    const soft = `color-mix(in srgb, ${p.accentColor} 22%, var(--bg-elev))`
    root.style.setProperty('--primary-color', p.accentColor)
    root.style.setProperty('--primary-ink', ink)
    root.style.setProperty('--brand', p.accentColor)
    root.style.setProperty('--brand-ink', ink)
    root.style.setProperty('--brand-soft', soft)
    root.style.setProperty('--accent', p.accentColor)
    root.style.setProperty('--accent-soft', soft)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', p.accentColor)
  }
}

function persistAppear(p: { fontFamily: AppFont; fontSize: AppFontSize; accentColor: string }) {
  localStorage.setItem(APPEAR_KEY, JSON.stringify(p))
  applyAppearance(p)
}

if (typeof window !== 'undefined') applyAppearance(loadAppear())

async function seedIfEmpty(): Promise<void> {
  const subjects = await db.getAll<Subject>(STORES.subjects)
  const notebooks = await db.getAll<Notebook>(STORES.notebooks)
  const t = now()
  if (subjects.length === 0) {
    const defaults: Subject[] = [
      { id: uid(), name: 'English', color: SUBJECT_COLORS[0], icon: 'book', createdAt: t, updatedAt: t },
      { id: uid(), name: 'عربي', color: SUBJECT_COLORS[1], icon: 'pen', createdAt: t, updatedAt: t },
      { id: uid(), name: 'Study', color: SUBJECT_COLORS[3], icon: 'graduation', createdAt: t, updatedAt: t },
    ]
    await db.putMany(STORES.subjects, defaults)
  }
  if (notebooks.length === 0) {
    await db.putOne<Notebook>(STORES.notebooks, {
      id: uid(),
      name: 'Inbox',
      color: SUBJECT_COLORS[0],
      createdAt: t,
      updatedAt: t,
    })
  }
}

function normalizeDeckType(type?: string): Deck['type'] {
  if (type === 'phrases' || type === 'synonyms' || type === 'definitions' || type === 'antonyms' || type === 'vocab') return type
  return 'vocab'
}

function normalizeDeck(raw: Deck): Deck {
  return {
    ...raw,
    nativeLang: raw.nativeLang || 'ar',
    targetLang: raw.targetLang || 'en',
    type: normalizeDeckType(raw.type),
    cardCount: typeof raw.cardCount === 'number' ? raw.cardCount : 0,
    description: raw.description ?? '',
    tags: raw.tags ?? [],
  }
}

function normalizeTask(raw: Task): Task {
  const date = raw.date ?? raw.dueDate ?? raw.startDate
  return {
    ...raw,
    title: raw.title ?? '',
    description: raw.description ?? '',
    completed: !!raw.completed,
    priority: raw.priority ?? 'medium',
    date,
    dueDate: raw.dueDate ?? date,
    category: raw.category ?? '',
    parentId: raw.parentId,
    remind: !!raw.remind,
    recurring: raw.recurring ?? 'none',
    subtasks: raw.subtasks ?? [],
  }
}

function normalizeNote(raw: Note): Note {
  return {
    ...raw,
    title: raw.title ?? '',
    type: raw.type ?? '',
    content: raw.content ?? '',
    color: raw.color || '#FFF8E7',
    audioId: raw.audioId || raw.recordingIds?.[0],
    tags: raw.tags ?? [],
    pinned: !!raw.pinned,
    recordingIds: raw.recordingIds ?? [],
    taskIds: raw.taskIds ?? [],
    attachments: raw.attachments ?? [],
  }
}

function normalizeCard(raw: Card): Card {
  const mistakes = typeof raw.mistakes === 'number' ? raw.mistakes : raw.lapses || 0
  const due = raw.nextReviewDate || raw.dueAt || raw.createdAt || now()
  const image = raw.imageBlob || raw.imageDataUrl
  return {
    ...raw,
    front: raw.front ?? '',
    back: raw.back ?? '',
    translation: raw.translation ?? '',
    definition: raw.definition ?? '',
    example: raw.example ?? '',
    exampleTranslation: raw.exampleTranslation ?? '',
    explanation: raw.explanation ?? '',
    note: raw.note ?? '',
    imageBlob: image,
    imageDataUrl: image,
    status: raw.status ?? 'new',
    ease: raw.easeFactor || raw.ease || 2.5,
    easeFactor: raw.easeFactor || raw.ease || 2.5,
    interval: raw.interval || 0,
    repetitions: raw.repetitions || 0,
    reviews: raw.reviews ?? raw.repetitions ?? 0,
    dueAt: due,
    nextReviewDate: due,
    lapses: raw.lapses || 0,
    mistakes,
  }
}

function applySm2(card: Card, recalled: boolean): Card {
  const t = now()
  let easeFactor = card.easeFactor || card.ease || 2.5
  let interval = card.interval || 0
  let repetitions = card.repetitions || 0
  let lapses = card.lapses || 0
  let mistakes = card.mistakes || 0
  let status = card.status
  if (!recalled) {
    repetitions = 0
    interval = 1
    easeFactor = Math.max(1.3, easeFactor - 0.2)
    lapses += 1
    mistakes += 1
    status = 'learning'
  } else {
    repetitions += 1
    if (repetitions === 1) interval = 1
    else if (repetitions === 2) interval = 6
    else interval = Math.max(1, Math.round(interval * easeFactor))
    easeFactor = Math.min(2.5, easeFactor + 0.1)
    mistakes = Math.max(0, mistakes - 1)
    status = repetitions >= 3 ? 'learned' : 'review'
  }
  const due = startOfDay(t) + interval * 24 * 60 * 60 * 1000
  return {
    ...card,
    ease: easeFactor,
    easeFactor,
    interval,
    repetitions,
    reviews: (card.reviews || 0) + 1,
    lapses,
    mistakes,
    status,
    dueAt: due,
    nextReviewDate: due,
    updatedAt: t,
  }
}

function applyAnswer(card: Card, correct: boolean): Card {
  return applySm2(card, correct)
}

function schedule(card: Card, rating: CardRating): Card {
  return applySm2(card, rating !== 'again')
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoreState>({
    ready: false,
    settings: DEFAULT_SETTINGS,
    subjects: [],
    folders: [],
    recordings: [],
    decks: [],
    cards: [],
    tasks: [],
    notebooks: [],
    notes: [],
    links: [],
    downloads: [],
  })

  const reload = useCallback(async () => {
    await seedIfEmpty()
    const [settings, subjects, folders, recordings, decks, cards, tasks, notebooks, notes, links, downloads] =
      await Promise.all([
        db.loadSettings(),
        db.getAll<Subject>(STORES.subjects),
        db.getAll<Folder>(STORES.folders),
        db.getAll<Recording>(STORES.recordings),
        db.getAll<Deck>(STORES.decks),
        db.getAll<Card>(STORES.cards),
        db.getAll<Task>(STORES.tasks),
        db.getAll<Notebook>(STORES.notebooks),
        db.getAll<Note>(STORES.notes),
        db.getAll<Link>(STORES.links),
        db.getAll<DownloadItem>(STORES.downloads),
      ])
    const cardsN = cards.map(normalizeCard)
    const decksN = decks.map((d) => {
      const n = normalizeDeck(d)
      return { ...n, cardCount: cardsN.filter((c) => c.deckId === d.id).length }
    })
    const tasksN = tasks.map(normalizeTask)
    const notesN = notes.map(normalizeNote)
    const deckWrites = decksN.filter((_, idx) => {
      const raw = decks[idx]
      return !raw || !raw.nativeLang || !raw.targetLang || !raw.type || (raw as { type?: string }).type === 'vocabulary' || raw.cardCount !== decksN[idx]?.cardCount
    })
    const cardWrites = cardsN.filter((_, idx) => {
      const raw = cards[idx]
      return !raw || typeof raw.mistakes !== 'number' || raw.exampleTranslation === undefined || raw.note === undefined || raw.nextReviewDate === undefined || raw.easeFactor === undefined || (raw.imageDataUrl && !raw.imageBlob)
    })
    const taskWrites = tasksN.filter((_, idx) => {
      const raw = tasks[idx]
      return !raw || raw.date === undefined || raw.remind === undefined
    })
    const noteWrites = notesN.filter((_, idx) => {
      const raw = notes[idx]
      return !raw || raw.type === undefined || raw.color === undefined || raw.audioId === undefined
    })
    await Promise.all([
      ...deckWrites.map((d) => db.putOne(STORES.decks, d)),
      ...cardWrites.map((c) => db.putOne(STORES.cards, c)),
      ...taskWrites.map((tk) => db.putOne(STORES.tasks, tk)),
      ...noteWrites.map((n) => db.putOne(STORES.notes, n)),
    ])
    const appear = loadAppear()
    const settingsN: AppSettings = {
      ...settings,
      speakRepeats: settings.speakRepeats ?? 1,
      cardReminders: settings.cardReminders ?? false,
      notifySound: settings.notifySound ?? 'default',
      fontFamily: settings.fontFamily || appear.fontFamily,
      fontSize: settings.fontSize || appear.fontSize,
      accentColor: settings.accentColor || appear.accentColor,
      language: isUiLang(settings.language) ? settings.language : 'en',
      onboarded: !!settings.onboarded,
      nativeLang: settings.nativeLang && settings.nativeLang !== 'other' ? settings.nativeLang : '',
      nativeLangOther: settings.nativeLangOther ?? '',
      targetLangs: (settings.targetLangs || []).filter((c) => c && c !== 'other'),
      targetLangOther: settings.targetLangOther ?? '',
      goal:
        settings.goal === 'productivity' || settings.goal === 'record' || settings.goal === 'all'
          ? settings.goal
          : 'study',
      goalOther: settings.goalOther ?? '',
      fields: settings.fields ?? [],
      fieldOther: settings.fieldOther ?? '',
      dailyGoal: settings.dailyGoal === '10' || settings.dailyGoal === '60' ? settings.dailyGoal : '30',
      inputPref: settings.inputPref === 'type' || settings.inputPref === 'voice' ? settings.inputPref : 'both',
      userLevel:
        settings.userLevel === 'intermediate' || settings.userLevel === 'advanced' ? settings.userLevel : 'beginner',
    }
    persistAppear({
      fontFamily: settingsN.fontFamily,
      fontSize: settingsN.fontSize,
      accentColor: settingsN.accentColor,
    })
    if (
      settings.speakRepeats == null ||
      settings.cardReminders == null ||
      settings.notifySound == null ||
      settings.fontFamily == null ||
      settings.fontSize == null ||
      settings.accentColor == null
    ) {
      await db.saveSettings(settingsN)
    }
    setState({
      ready: true,
      settings: settingsN,
      subjects,
      folders,
      recordings,
      decks: decksN,
      cards: cardsN,
      tasks: tasksN,
      notebooks,
      notes: notesN,
      links,
      downloads,
    })
    applyLang(settings.language)
    applyTheme(settings.theme)
    applyAppearance({
      fontFamily: settingsN.fontFamily,
      fontSize: settingsN.fontSize,
      accentColor: settingsN.accentColor,
    })
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!state.ready) return
    applyLang(state.settings.language)
    applyTheme(state.settings.theme)
    applyAppearance({
      fontFamily: state.settings.fontFamily,
      fontSize: state.settings.fontSize,
      accentColor: state.settings.accentColor,
    })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (state.settings.theme === 'system') {
        applyTheme('system')
        applyAppearance({
          fontFamily: state.settings.fontFamily,
          fontSize: state.settings.fontSize,
          accentColor: state.settings.accentColor,
        })
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [state.ready, state.settings.language, state.settings.theme, state.settings.fontFamily, state.settings.fontSize, state.settings.accentColor])

  const patchList = useCallback(<T extends { id: string }>(key: keyof StoreState, id: string, p: Partial<T>) => {
    setState((s) => ({
      ...s,
      [key]: (s[key] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...p } : x)),
    }))
  }, [])

  const setSettings = useCallback(async (p: Partial<AppSettings>) => {
    const next = { ...state.settings, ...p }
    await db.saveSettings(next)
    setState((s) => ({ ...s, settings: next }))
    if (p.language) applyLang(p.language)
    if (p.theme) applyTheme(p.theme)
    persistAppear({
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      accentColor: next.accentColor,
    })
  }, [state.settings])

  const addSubject = useCallback(async (name: string, color?: string) => {
    const t = now()
    const item: Subject = {
      id: uid(),
      name,
      color: color ?? SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length],
      icon: 'book',
      createdAt: t,
      updatedAt: t,
    }
    await db.putOne(STORES.subjects, item)
    setState((s) => ({ ...s, subjects: [...s.subjects, item] }))
    return item
  }, [state.subjects.length])

  const updateSubject = useCallback(async (id: string, p: Partial<Subject>) => {
    const cur = state.subjects.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.subjects, next)
    patchList('subjects', id, next)
  }, [state.subjects, patchList])

  const deleteSubject = useCallback(async (id: string) => {
    await db.deleteById(STORES.subjects, id)
    setState((s) => ({ ...s, subjects: s.subjects.filter((x) => x.id !== id) }))
  }, [])

  const addFolder = useCallback(async (name: string, kind: Folder['kind'], subjectId?: string) => {
    const t = now()
    const item: Folder = { id: uid(), name, kind, subjectId, createdAt: t, updatedAt: t }
    await db.putOne(STORES.folders, item)
    setState((s) => ({ ...s, folders: [...s.folders, item] }))
    return item
  }, [])

  const updateFolder = useCallback(async (id: string, p: Partial<Folder>) => {
    const cur = state.folders.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.folders, next)
    patchList('folders', id, next)
  }, [state.folders, patchList])

  const deleteFolder = useCallback(async (id: string) => {
    await db.deleteById(STORES.folders, id)
    setState((s) => ({ ...s, folders: s.folders.filter((x) => x.id !== id) }))
  }, [])

  const addRecording = useCallback(
    async (
      rec: Omit<Recording, 'id' | 'createdAt' | 'updatedAt' | 'noteIds' | 'tags' | 'description'> & Partial<Recording>,
      blob: Blob,
    ) => {
      const t = now()
      const item: Recording = {
        id: uid(),
        name: rec.name,
        durationMs: rec.durationMs,
        mimeType: rec.mimeType,
        sizeBytes: rec.sizeBytes ?? blob.size,
        folderId: rec.folderId,
        subjectId: rec.subjectId,
        description: rec.description ?? '',
        tags: rec.tags ?? [],
        noteIds: rec.noteIds ?? [],
        createdAt: t,
        updatedAt: t,
      }
      await db.putOne(STORES.recordings, item)
      await db.putOne(STORES.audioBlobs, { id: item.id, blob })
      setState((s) => ({ ...s, recordings: [item, ...s.recordings] }))
      return item
    },
    [],
  )

  const updateRecording = useCallback(async (id: string, p: Partial<Recording>) => {
    const cur = state.recordings.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.recordings, next)
    patchList('recordings', id, next)
  }, [state.recordings, patchList])

  const deleteRecording = useCallback(async (id: string) => {
    await db.deleteById(STORES.recordings, id)
    await db.deleteById(STORES.audioBlobs, id)
    setState((s) => ({
      ...s,
      recordings: s.recordings.filter((x) => x.id !== id),
      notes: s.notes.map((n) =>
        n.recordingIds.includes(id) || n.audioId === id
          ? { ...n, recordingIds: n.recordingIds.filter((r) => r !== id), audioId: n.audioId === id ? undefined : n.audioId }
          : n,
      ),
    }))
  }, [])

  const getAudioBlob = useCallback(async (id: string) => {
    const row = await db.getById<{ id: string; blob: Blob }>(STORES.audioBlobs, id)
    return row?.blob
  }, [])

  const addDownload = useCallback(async (name: string, blob: Blob, mimeType?: string) => {
    const t = now()
    const item: DownloadItem = {
      id: uid(),
      name,
      mimeType: mimeType || blob.type || 'audio/webm',
      sizeBytes: blob.size,
      createdAt: t,
    }
    await db.putOne(STORES.downloads, item)
    await db.putOne(STORES.downloadBlobs, { id: item.id, blob })
    setState((s) => ({ ...s, downloads: [item, ...s.downloads] }))
    return item
  }, [])

  const getDownloadBlob = useCallback(async (id: string) => {
    const row = await db.getById<{ id: string; blob: Blob }>(STORES.downloadBlobs, id)
    return row?.blob
  }, [])

  const deleteDownload = useCallback(async (id: string) => {
    await db.deleteById(STORES.downloads, id)
    await db.deleteById(STORES.downloadBlobs, id)
    setState((s) => ({ ...s, downloads: s.downloads.filter((x) => x.id !== id) }))
  }, [])

  const addDeck = useCallback(async (name: string, extra?: Partial<Deck>) => {
    const t = now()
    const item: Deck = {
      id: uid(),
      name,
      type: normalizeDeckType(extra?.type),
      cardCount: extra?.cardCount ?? 0,
      description: extra?.description ?? '',
      subjectId: extra?.subjectId,
      tags: extra?.tags ?? [],
      noteId: extra?.noteId,
      nativeLang: extra?.nativeLang || 'ar',
      targetLang: extra?.targetLang || 'en',
      createdAt: t,
      updatedAt: t,
    }
    await db.putOne(STORES.decks, item)
    setState((s) => ({ ...s, decks: [...s.decks, item] }))
    return item
  }, [])

  const updateDeck = useCallback(async (id: string, p: Partial<Deck>) => {
    const cur = state.decks.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.decks, next)
    patchList('decks', id, next)
  }, [state.decks, patchList])

  const deleteDeck = useCallback(async (id: string) => {
    const cardIds = state.cards.filter((c) => c.deckId === id).map((c) => c.id)
    await db.deleteById(STORES.decks, id)
    await Promise.all(cardIds.map((cid) => db.deleteById(STORES.cards, cid)))
    setState((s) => ({
      ...s,
      decks: s.decks.filter((d) => d.id !== id),
      cards: s.cards.filter((c) => c.deckId !== id),
    }))
  }, [state.cards])

  const bumpDeckCount = useCallback(async (deckId: string, delta: number) => {
    const cur = state.decks.find((x) => x.id === deckId)
    if (!cur) return
    const next = { ...cur, cardCount: Math.max(0, (cur.cardCount || 0) + delta), updatedAt: now() }
    await db.putOne(STORES.decks, next)
    patchList('decks', deckId, next)
  }, [state.decks, patchList])

  const addCard = useCallback(async (deckId: string, data: Partial<Card> & { front: string; back: string }) => {
    const t = now()
    const image = data.imageBlob || data.imageDataUrl
    const item: Card = {
      id: uid(),
      deckId,
      front: data.front,
      back: data.back,
      translation: data.translation ?? '',
      definition: data.definition ?? '',
      example: data.example ?? '',
      exampleTranslation: data.exampleTranslation ?? '',
      explanation: data.explanation ?? '',
      note: data.note ?? '',
      imageBlob: image,
      imageDataUrl: image,
      status: 'new',
      ease: 2.5,
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      reviews: 0,
      dueAt: t,
      nextReviewDate: t,
      lapses: 0,
      mistakes: 0,
      createdAt: t,
      updatedAt: t,
    }
    await db.putOne(STORES.cards, item)
    setState((s) => ({ ...s, cards: [...s.cards, item] }))
    await bumpDeckCount(deckId, 1)
    return item
  }, [bumpDeckCount])

  const updateCard = useCallback(async (id: string, p: Partial<Card>) => {
    const cur = state.cards.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.cards, next)
    patchList('cards', id, next)
  }, [state.cards, patchList])

  const deleteCard = useCallback(async (id: string) => {
    const cur = state.cards.find((x) => x.id === id)
    await db.deleteById(STORES.cards, id)
    setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }))
    if (cur) await bumpDeckCount(cur.deckId, -1)
  }, [state.cards, bumpDeckCount])

  const duplicateCard = useCallback(async (id: string) => {
    const cur = state.cards.find((x) => x.id === id)
    if (!cur) return
    return addCard(cur.deckId, {
      front: cur.front,
      back: cur.back,
      translation: cur.translation,
      definition: cur.definition,
      example: cur.example,
      exampleTranslation: cur.exampleTranslation,
      explanation: cur.explanation,
      note: cur.note,
      imageBlob: cur.imageBlob || cur.imageDataUrl,
      imageDataUrl: cur.imageBlob || cur.imageDataUrl,
    })
  }, [state.cards, addCard])

  const recordAnswer = useCallback(async (id: string, correct: boolean) => {
    const cur = state.cards.find((x) => x.id === id)
    if (!cur) return
    const next = applyAnswer(cur, correct)
    await db.putOne(STORES.cards, next)
    patchList('cards', id, next)
  }, [state.cards, patchList])

  const pickCards = useCallback(
    (deckId: string, count: number) => {
      const pool = state.cards.filter((c) => c.deckId === deckId && c.front.trim() && c.back.trim())
      const ranked = [...pool].sort((a, b) => {
        const wa = (a.mistakes || 0) * 4 + (a.status === 'learned' ? -2 : 1) + Math.random()
        const wb = (b.mistakes || 0) * 4 + (b.status === 'learned' ? -2 : 1) + Math.random()
        return wb - wa
      })
      return ranked.slice(0, Math.max(0, count))
    },
    [state.cards],
  )

  const rateCard = useCallback(async (id: string, rating: CardRating) => {
    const cur = state.cards.find((x) => x.id === id)
    if (!cur) return
    const next = schedule(cur, rating)
    await db.putOne(STORES.cards, next)
    patchList('cards', id, next)
    const key = 'myspace-streak'
    const raw = localStorage.getItem(key)
    const today = startOfDay()
    let days = 1
    let last = today
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { days: number; last: number }
        if (parsed.last === today) {
          days = parsed.days
          last = parsed.last
        } else if (parsed.last === today - 86400000) {
          days = parsed.days + 1
        }
      } catch {
        days = 1
      }
    }
    localStorage.setItem(key, JSON.stringify({ days, last }))
  }, [state.cards, patchList])

  const addTask = useCallback(async (data: Partial<Task> & { title: string }) => {
    const t = now()
    const item: Task = {
      id: uid(),
      title: data.title,
      description: data.description ?? '',
      completed: false,
      priority: data.priority ?? 'medium',
      date: data.date ?? data.dueDate,
      startDate: data.startDate,
      dueDate: data.dueDate ?? data.date,
      category: data.category ?? '',
      subjectId: data.subjectId,
      noteId: data.noteId,
      recordingId: data.recordingId,
      deckId: data.deckId,
      parentId: data.parentId,
      remind: data.remind ?? false,
      recurring: data.recurring ?? 'none',
      subtasks: data.subtasks ?? [],
      createdAt: t,
      updatedAt: t,
    }
    await db.putOne(STORES.tasks, item)
    setState((s) => ({ ...s, tasks: [item, ...s.tasks] }))
    return item
  }, [])

  const syncParentCompletion = useCallback(
    async (parentId: string, list: Task[]) => {
      const parent = list.find((x) => x.id === parentId)
      if (!parent) return
      const nested = list.filter((x) => x.parentId === parentId)
      const hasKids = nested.length > 0 || parent.subtasks.length > 0
      if (!hasKids) return
      const done = nested.length > 0 ? nested.every((x) => x.completed) : parent.subtasks.every((s) => s.completed)
      if (!!parent.completed === done) return
      const t = now()
      const next: Task = { ...parent, completed: done, completedAt: done ? t : undefined, updatedAt: t }
      await db.putOne(STORES.tasks, next)
      patchList('tasks', parentId, next)
    },
    [patchList],
  )

  const updateTask = useCallback(async (id: string, p: Partial<Task>) => {
    const cur = state.tasks.find((x) => x.id === id)
    if (!cur) return
    const t = now()
    const next: Task = { ...cur, ...p, updatedAt: t }
    if (p.subtasks && p.subtasks.length > 0 && p.completed === undefined) {
      const done = p.subtasks.every((s) => s.completed)
      next.completed = done
      next.completedAt = done ? t : undefined
    }
    await db.putOne(STORES.tasks, next)
    patchList('tasks', id, next)
    if (cur.parentId && p.completed !== undefined) {
      const list = state.tasks.map((x) => (x.id === id ? next : x))
      await syncParentCompletion(cur.parentId, list)
    }
  }, [state.tasks, patchList, syncParentCompletion])

  const toggleTask = useCallback(async (id: string) => {
    const cur = state.tasks.find((x) => x.id === id)
    if (!cur) return
    const completed = !cur.completed
    const t = now()
    const next: Task = { ...cur, completed, completedAt: completed ? t : undefined, updatedAt: t }
    await db.putOne(STORES.tasks, next)
    patchList('tasks', id, next)
    if (cur.parentId) {
      const list = state.tasks.map((x) => (x.id === id ? next : x))
      await syncParentCompletion(cur.parentId, list)
    }
    if (completed && cur.recurring !== 'none') {
      const delta = cur.recurring === 'daily' ? 86400000 : 7 * 86400000
      await addTask({
        title: cur.title,
        description: cur.description,
        priority: cur.priority,
        startDate: cur.startDate ? cur.startDate + delta : undefined,
        dueDate: cur.dueDate ? cur.dueDate + delta : t + delta,
        category: cur.category,
        subjectId: cur.subjectId,
        noteId: cur.noteId,
        recordingId: cur.recordingId,
        deckId: cur.deckId,
        recurring: cur.recurring,
        subtasks: cur.subtasks.map((st) => ({ ...st, id: uid(), completed: false })),
      })
    }
  }, [state.tasks, patchList, addTask, syncParentCompletion])

  const deleteTask = useCallback(async (id: string) => {
    const childIds = state.tasks.filter((x) => x.parentId === id).map((x) => x.id)
    await db.deleteById(STORES.tasks, id)
    await Promise.all(childIds.map((cid) => db.deleteById(STORES.tasks, cid)))
    setState((s) => ({
      ...s,
      tasks: s.tasks.filter((x) => x.id !== id && x.parentId !== id),
    }))
  }, [state.tasks])

  const addNotebook = useCallback(async (name: string, extra?: Partial<Notebook>) => {
    const t = now()
    const item: Notebook = {
      id: uid(),
      name,
      color: extra?.color ?? SUBJECT_COLORS[state.notebooks.length % SUBJECT_COLORS.length],
      subjectId: extra?.subjectId,
      createdAt: t,
      updatedAt: t,
    }
    await db.putOne(STORES.notebooks, item)
    setState((s) => ({ ...s, notebooks: [...s.notebooks, item] }))
    return item
  }, [state.notebooks.length])

  const updateNotebook = useCallback(async (id: string, p: Partial<Notebook>) => {
    const cur = state.notebooks.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.notebooks, next)
    patchList('notebooks', id, next)
  }, [state.notebooks, patchList])

  const deleteNotebook = useCallback(async (id: string) => {
    const noteIds = state.notes.filter((n) => n.notebookId === id).map((n) => n.id)
    await db.deleteById(STORES.notebooks, id)
    await Promise.all(noteIds.map((nid) => db.deleteById(STORES.notes, nid)))
    setState((s) => ({
      ...s,
      notebooks: s.notebooks.filter((n) => n.id !== id),
      notes: s.notes.filter((n) => n.notebookId !== id),
    }))
  }, [state.notes])

  const addNote = useCallback(async (notebookId: string, extra?: Partial<Note>) => {
    const t = now()
    const item: Note = {
      id: uid(),
      notebookId,
      folderId: extra?.folderId,
      title: extra?.title ?? '',
      type: extra?.type ?? '',
      content: extra?.content ?? '',
      color: extra?.color ?? '#FFF8E7',
      audioId: extra?.audioId,
      tags: extra?.tags ?? [],
      pinned: extra?.pinned ?? false,
      subjectId: extra?.subjectId,
      recordingIds: extra?.recordingIds ?? (extra?.audioId ? [extra.audioId] : []),
      taskIds: extra?.taskIds ?? [],
      attachments: extra?.attachments ?? [],
      createdAt: t,
      updatedAt: t,
    }
    await db.putOne(STORES.notes, item)
    setState((s) => ({ ...s, notes: [item, ...s.notes] }))
    return item
  }, [])

  const updateNote = useCallback(async (id: string, p: Partial<Note>) => {
    const cur = state.notes.find((x) => x.id === id)
    if (!cur) return
    const next = { ...cur, ...p, updatedAt: now() }
    await db.putOne(STORES.notes, next)
    patchList('notes', id, next)
  }, [state.notes, patchList])

  const deleteNote = useCallback(async (id: string) => {
    await db.deleteById(STORES.notes, id)
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
  }, [])

  const linkEntities = useCallback(
    async (fromType: Link['fromType'], fromId: string, toType: Link['toType'], toId: string) => {
      const item: Link = { id: uid(), fromType, fromId, toType, toId, createdAt: now() }
      await db.putOne(STORES.links, item)
      setState((s) => ({ ...s, links: [...s.links, item] }))
      if (fromType === 'recording' && toType === 'note') {
        const rec = state.recordings.find((r) => r.id === fromId)
        const note = state.notes.find((n) => n.id === toId)
        if (rec && !rec.noteIds.includes(toId)) await updateRecording(fromId, { noteIds: [...rec.noteIds, toId] })
        if (note && !note.recordingIds.includes(fromId))
          await updateNote(toId, { recordingIds: [...note.recordingIds, fromId] })
      }
      if (fromType === 'note' && toType === 'recording') {
        const rec = state.recordings.find((r) => r.id === toId)
        const note = state.notes.find((n) => n.id === fromId)
        if (rec && !rec.noteIds.includes(fromId)) await updateRecording(toId, { noteIds: [...rec.noteIds, fromId] })
        if (note && !note.recordingIds.includes(toId))
          await updateNote(fromId, { recordingIds: [...note.recordingIds, toId] })
      }
      if (fromType === 'task' && toType === 'note') {
        await updateTask(fromId, { noteId: toId })
        const note = state.notes.find((n) => n.id === toId)
        if (note && !note.taskIds.includes(fromId)) await updateNote(toId, { taskIds: [...note.taskIds, fromId] })
      }
    },
    [state.recordings, state.notes, updateRecording, updateNote, updateTask],
  )

  const unlinkEntities = useCallback(
    async (fromType: Link['fromType'], fromId: string, toType: Link['toType'], toId: string) => {
      const found = state.links.filter(
        (l) =>
          (l.fromType === fromType && l.fromId === fromId && l.toType === toType && l.toId === toId) ||
          (l.fromType === toType && l.fromId === toId && l.toType === fromType && l.toId === fromId),
      )
      await Promise.all(found.map((l) => db.deleteById(STORES.links, l.id)))
      setState((s) => ({ ...s, links: s.links.filter((l) => !found.some((f) => f.id === l.id)) }))
    },
    [state.links],
  )

  const search = useCallback(
    (q: string): SearchHit[] => {
      const needle = q.trim()
      if (!needle) return []
      const hits: SearchHit[] = []
      for (const r of state.recordings) {
        if (includesText(r.name, needle) || includesText(r.description, needle) || r.tags.some((tg) => includesText(tg, needle))) {
          hits.push({ type: 'recording', id: r.id, title: r.name, snippet: r.description, extra: 'recording' })
        }
      }
      for (const n of state.notes) {
        const plain = stripHtml(n.content)
        if (
          includesText(n.title, needle) ||
          includesText(n.type, needle) ||
          includesText(plain, needle) ||
          n.tags.some((tg) => includesText(tg, needle))
        ) {
          hits.push({ type: 'note', id: n.id, title: n.title || '—', snippet: plain, extra: 'note' })
        }
      }
      for (const tk of state.tasks) {
        if (includesText(tk.title, needle) || includesText(tk.description, needle) || includesText(tk.category, needle)) {
          hits.push({ type: 'task', id: tk.id, title: tk.title, snippet: tk.description, extra: 'task' })
        }
      }
      for (const c of state.cards) {
        if (
          includesText(c.front, needle) ||
          includesText(c.back, needle) ||
          includesText(c.translation, needle) ||
          includesText(c.definition, needle)
        ) {
          hits.push({ type: 'card', id: c.id, title: c.front, snippet: c.back, extra: 'card' })
        }
      }
      for (const d of state.decks) {
        if (includesText(d.name, needle) || includesText(d.description, needle)) {
          hits.push({ type: 'deck', id: d.id, title: d.name, snippet: d.description, extra: 'deck' })
        }
      }
      for (const s of state.subjects) {
        if (includesText(s.name, needle)) {
          hits.push({ type: 'subject', id: s.id, title: s.name, snippet: '', extra: 'subject' })
        }
      }
      return hits
    },
    [state],
  )

  const importData = useCallback(async (snap: db.Snapshot) => {
    await db.importSnapshot(snap)
    await reload()
  }, [reload])

  const markBackup = useCallback(async () => {
    await setSettings({ lastBackupAt: now() })
  }, [setSettings])

  const resolvedTheme: 'light' | 'dark' =
    state.settings.theme === 'dark' ||
    (state.settings.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : state.settings.theme === 'light'
        ? 'light'
        : typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

  const api = useMemo<StoreApi>(
    () => ({
      ...state,
      lang: state.settings.language,
      theme: state.settings.theme,
      resolvedTheme,
      setSettings,
      addSubject,
      updateSubject,
      deleteSubject,
      addFolder,
      updateFolder,
      deleteFolder,
      addRecording,
      updateRecording,
      deleteRecording,
      getAudioBlob,
      addDownload,
      getDownloadBlob,
      deleteDownload,
      addDeck,
      updateDeck,
      deleteDeck,
      addCard,
      updateCard,
      deleteCard,
      duplicateCard,
      rateCard,
      recordAnswer,
      pickCards,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      addNotebook,
      updateNotebook,
      deleteNotebook,
      addNote,
      updateNote,
      deleteNote,
      linkEntities,
      unlinkEntities,
      search,
      reload,
      importData,
      markBackup,
    }),
    [
      state,
      resolvedTheme,
      setSettings,
      addSubject,
      updateSubject,
      deleteSubject,
      addFolder,
      updateFolder,
      deleteFolder,
      addRecording,
      updateRecording,
      deleteRecording,
      getAudioBlob,
      addDownload,
      getDownloadBlob,
      deleteDownload,
      addDeck,
      updateDeck,
      deleteDeck,
      addCard,
      updateCard,
      deleteCard,
      duplicateCard,
      rateCard,
      recordAnswer,
      pickCards,
      addTask,
      updateTask,
      toggleTask,
      deleteTask,
      addNotebook,
      updateNotebook,
      deleteNotebook,
      addNote,
      updateNote,
      deleteNote,
      linkEntities,
      unlinkEntities,
      search,
      reload,
      importData,
      markBackup,
    ],
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore outside provider')
  return ctx
}
