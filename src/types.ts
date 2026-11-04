export type Lang = 'ar' | 'en'
export type Theme = 'light' | 'dark' | 'system'
export type Priority = 'low' | 'medium' | 'high'
export type Recurrence = 'none' | 'daily' | 'weekly'
export type CardRating = 'again' | 'hard' | 'good' | 'easy'
export type CardStatus = 'new' | 'learning' | 'review' | 'learned'
export type FolderKind = 'recording' | 'note' | 'mixed'
export type EntityType = 'recording' | 'note' | 'task' | 'deck' | 'card' | 'subject' | 'notebook'

export interface Subject {
  id: string
  name: string
  color: string
  icon: string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  kind: FolderKind
  subjectId?: string
  parentId?: string
  createdAt: number
  updatedAt: number
}

export interface Recording {
  id: string
  name: string
  durationMs: number
  mimeType: string
  sizeBytes: number
  folderId?: string
  subjectId?: string
  description: string
  tags: string[]
  noteIds: string[]
  createdAt: number
  updatedAt: number
}

export interface AudioBlobRecord {
  id: string
  blob: Blob
}

export interface Deck {
  id: string
  name: string
  description: string
  subjectId?: string
  tags: string[]
  noteId?: string
  nativeLang: string
  targetLang: string
  reminderTime?: string
  createdAt: number
  updatedAt: number
}

export interface Card {
  id: string
  deckId: string
  front: string
  back: string
  translation: string
  definition: string
  example: string
  exampleTranslation: string
  explanation: string
  imageDataUrl?: string
  status: CardStatus
  ease: number
  interval: number
  repetitions: number
  dueAt: number
  lapses: number
  mistakes: number
  createdAt: number
  updatedAt: number
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  completed: boolean
  priority: Priority
  date?: number
  startDate?: number
  dueDate?: number
  category: string
  subjectId?: string
  noteId?: string
  recordingId?: string
  deckId?: string
  parentId?: string
  remind: boolean
  recurring: Recurrence
  subtasks: Subtask[]
  createdAt: number
  updatedAt: number
  completedAt?: number
}

export interface Notebook {
  id: string
  name: string
  color: string
  subjectId?: string
  createdAt: number
  updatedAt: number
}

export interface NoteAttachment {
  id: string
  name: string
  mime: string
  dataUrl: string
}

export interface Note {
  id: string
  notebookId: string
  folderId?: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  subjectId?: string
  recordingIds: string[]
  taskIds: string[]
  attachments: NoteAttachment[]
  createdAt: number
  updatedAt: number
}

export interface Link {
  id: string
  fromType: EntityType
  fromId: string
  toType: EntityType
  toId: string
  createdAt: number
}

export type NotifySound = 'default' | 'chime' | 'bell'

export interface AppSettings {
  language: Lang
  theme: Theme
  userName: string
  lastBackupAt?: number
  speakRepeats: 1 | 2 | 3 | 5
  cardReminders: boolean
  notifySound: NotifySound
}

export interface SearchHit {
  type: EntityType
  id: string
  title: string
  snippet: string
  extra?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'ar',
  theme: 'system',
  userName: '',
  speakRepeats: 1,
  cardReminders: false,
  notifySound: 'default',
}

export const NOTIFY_SOUNDS: { id: NotifySound; ar: string; en: string }[] = [
  { id: 'default', ar: 'الافتراضية', en: 'Default' },
  { id: 'chime', ar: 'رنين خفيف', en: 'Chime' },
  { id: 'bell', ar: 'جرس', en: 'Bell' },
]

export const LEARN_LANGS: { code: string; ar: string; en: string }[] = [
  { code: 'ar', ar: 'العربية', en: 'Arabic' },
  { code: 'en', ar: 'الإنجليزية', en: 'English' },
  { code: 'fr', ar: 'الفرنسية', en: 'French' },
  { code: 'es', ar: 'الإسبانية', en: 'Spanish' },
  { code: 'de', ar: 'الألمانية', en: 'German' },
  { code: 'tr', ar: 'التركية', en: 'Turkish' },
  { code: 'it', ar: 'الإيطالية', en: 'Italian' },
  { code: 'ru', ar: 'الروسية', en: 'Russian' },
  { code: 'zh', ar: 'الصينية', en: 'Chinese' },
  { code: 'ja', ar: 'اليابانية', en: 'Japanese' },
  { code: 'ko', ar: 'الكورية', en: 'Korean' },
  { code: 'pt', ar: 'البرتغالية', en: 'Portuguese' },
  { code: 'hi', ar: 'الهندية', en: 'Hindi' },
  { code: 'ur', ar: 'الأردية', en: 'Urdu' },
  { code: 'fa', ar: 'الفارسية', en: 'Persian' },
  { code: 'nl', ar: 'الهولندية', en: 'Dutch' },
  { code: 'pl', ar: 'البولندية', en: 'Polish' },
  { code: 'id', ar: 'الإندونيسية', en: 'Indonesian' },
]

export const SUBJECT_COLORS = [
  '#0F6E6B',
  '#E85D4C',
  '#C9A227',
  '#4C6FE8',
  '#7B5EA7',
  '#2A9D8F',
  '#E76F51',
  '#457B9D',
]
