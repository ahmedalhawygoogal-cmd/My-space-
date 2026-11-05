export type Lang = 'ar' | 'en' | 'fr' | 'de' | 'es'

export const UI_LANGS: Lang[] = ['ar', 'en', 'fr', 'de', 'es']

export function isUiLang(code?: string): code is Lang {
  return code === 'ar' || code === 'en' || code === 'fr' || code === 'de' || code === 'es'
}

export type Labeled = { ar: string; en: string; fr?: string; de?: string; es?: string }

export function labeled(lang: Lang, o: Labeled): string {
  if (lang === 'ar') return o.ar
  if (lang === 'fr') return o.fr || o.en
  if (lang === 'de') return o.de || o.en
  if (lang === 'es') return o.es || o.en
  return o.en
}
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

export interface DownloadItem {
  id: string
  name: string
  mimeType: string
  sizeBytes: number
  createdAt: number
}

export interface Deck {
  id: string
  name: string
  type: DeckType
  cardCount: number
  description: string
  subjectId?: string
  tags: string[]
  noteId?: string
  nativeLang: string
  targetLang: string
  createdAt: number
  updatedAt: number
}

export interface Card {
  id: string
  deckId: string
  front: string
  back: string
  example?: string
  note?: string
  imageBlob?: string
  reviews: number
  nextReviewDate: number
  translation: string
  definition: string
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

export type AppFont = 'cairo' | 'tajawal' | 'almarai'
export type AppFontSize = 'small' | 'medium' | 'large'

export interface Note {
  id: string
  notebookId: string
  folderId?: string
  title: string
  type: string
  content: string
  color: string
  audioId?: string
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
export type DeckType = 'vocab' | 'phrases' | 'synonyms' | 'definitions' | 'antonyms'
export type DailyGoal = '5' | '15' | '30' | '60'
export type GoalKind = 'study' | 'languages' | 'work' | 'self' | 'other'

export interface AppSettings {
  language: Lang
  theme: Theme
  userName: string
  lastBackupAt?: number
  speakRepeats: 1 | 2 | 3 | 5
  cardReminders: boolean
  notifySound: NotifySound
  fontFamily: AppFont
  fontSize: AppFontSize
  accentColor: string
  onboarded: boolean
  nativeLang: string
  nativeLangOther: string
  targetLangs: string[]
  targetLangOther: string
  goal: GoalKind
  goalOther: string
  fields: string[]
  fieldOther: string
  dailyGoal: DailyGoal
}

export interface SearchHit {
  type: EntityType
  id: string
  title: string
  snippet: string
  extra?: string
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'system',
  userName: '',
  speakRepeats: 1,
  cardReminders: false,
  notifySound: 'default',
  fontFamily: 'cairo',
  fontSize: 'medium',
  accentColor: '#0F6E6B',
  onboarded: false,
  nativeLang: 'en',
  nativeLangOther: '',
  targetLangs: ['en'],
  targetLangOther: '',
  goal: 'study',
  goalOther: '',
  fields: [],
  fieldOther: '',
  dailyGoal: '15',
}

export const DECK_TYPES: DeckType[] = ['vocab', 'phrases', 'synonyms', 'definitions', 'antonyms']

export const NATIVE_LANG_OPTS = [
  { code: 'ar', ar: 'العربية', en: 'Arabic', fr: 'Arabe', de: 'Arabisch', es: 'Árabe' },
  { code: 'en', ar: 'English', en: 'English', fr: 'Anglais', de: 'Englisch', es: 'Inglés' },
  { code: 'fr', ar: 'Français', en: 'French', fr: 'Français', de: 'Französisch', es: 'Francés' },
  { code: 'de', ar: 'Deutsch', en: 'German', fr: 'Allemand', de: 'Deutsch', es: 'Alemán' },
  { code: 'es', ar: 'Español', en: 'Spanish', fr: 'Espagnol', de: 'Spanisch', es: 'Español' },
  { code: 'other', ar: 'أخرى', en: 'Other', fr: 'Autre', de: 'Andere', es: 'Otro' },
]

export const TARGET_LANG_OPTS = [
  { code: 'en', ar: 'English', en: 'English', fr: 'Anglais', de: 'Englisch', es: 'Inglés' },
  { code: 'fr', ar: 'Français', en: 'French', fr: 'Français', de: 'Französisch', es: 'Francés' },
  { code: 'es', ar: 'Español', en: 'Spanish', fr: 'Espagnol', de: 'Spanisch', es: 'Español' },
  { code: 'de', ar: 'Deutsch', en: 'German', fr: 'Allemand', de: 'Deutsch', es: 'Alemán' },
  { code: 'other', ar: 'أخرى', en: 'Other', fr: 'Autre', de: 'Andere', es: 'Otro' },
]

export const GOAL_OPTS: ({ id: GoalKind } & Labeled)[] = [
  { id: 'study', ar: 'مذاكرة', en: 'Study', fr: 'Études', de: 'Lernen', es: 'Estudio' },
  { id: 'languages', ar: 'تعلم لغات', en: 'Learn languages', fr: 'Apprendre des langues', de: 'Sprachen lernen', es: 'Aprender idiomas' },
  { id: 'work', ar: 'تنظيم شغل', en: 'Work organization', fr: 'Organisation du travail', de: 'Arbeitsorganisation', es: 'Organización del trabajo' },
  { id: 'self', ar: 'تطوير ذات', en: 'Self development', fr: 'Développement personnel', de: 'Persönliche Entwicklung', es: 'Desarrollo personal' },
  { id: 'other', ar: 'أخرى', en: 'Other', fr: 'Autre', de: 'Andere', es: 'Otro' },
]

export const FIELD_OPTS: ({ id: string } & Labeled)[] = [
  { id: 'languages', ar: 'لغات', en: 'Languages', fr: 'Langues', de: 'Sprachen', es: 'Idiomas' },
  { id: 'science', ar: 'علوم', en: 'Science', fr: 'Sciences', de: 'Wissenschaft', es: 'Ciencia' },
  { id: 'coding', ar: 'برمجة', en: 'Coding', fr: 'Programmation', de: 'Programmieren', es: 'Programación' },
  { id: 'business', ar: 'أعمال', en: 'Business', fr: 'Affaires', de: 'Wirtschaft', es: 'Negocios' },
  { id: 'medicine', ar: 'طب', en: 'Medicine', fr: 'Médecine', de: 'Medizin', es: 'Medicina' },
  { id: 'arts', ar: 'فنون', en: 'Arts', fr: 'Arts', de: 'Kunst', es: 'Artes' },
  { id: 'other', ar: 'أخرى', en: 'Other', fr: 'Autre', de: 'Andere', es: 'Otro' },
]

export const DAILY_OPTS: ({ id: DailyGoal } & Labeled)[] = [
  { id: '5', ar: '5 دقائق', en: '5 mins', fr: '5 min', de: '5 Min.', es: '5 min' },
  { id: '15', ar: '15 دقيقة', en: '15 mins', fr: '15 min', de: '15 Min.', es: '15 min' },
  { id: '30', ar: '30 دقيقة', en: '30 mins', fr: '30 min', de: '30 Min.', es: '30 min' },
  { id: '60', ar: '60+ دقيقة', en: '60+ mins', fr: '60+ min', de: '60+ Min.', es: '60+ min' },
]

export function isRichDeck(type?: DeckType) {
  return type === 'vocab' || type === 'phrases' || !type
}

export const NOTE_COLORS = ['#FFF8E7', '#E8F4F2', '#FDECE8', '#EEF1FB', '#F4F0E6']

export const APP_FONTS: { id: AppFont; label: string; stack: string }[] = [
  { id: 'cairo', label: 'Cairo', stack: "'Cairo', 'IBM Plex Sans Arabic', 'Inter', sans-serif" },
  { id: 'tajawal', label: 'Tajawal', stack: "'Tajawal', 'IBM Plex Sans Arabic', 'Inter', sans-serif" },
  { id: 'almarai', label: 'Almarai', stack: "'Almarai', 'IBM Plex Sans Arabic', 'Inter', sans-serif" },
]

export const NOTIFY_SOUNDS: ({ id: NotifySound } & Labeled)[] = [
  { id: 'default', ar: 'الافتراضية', en: 'Default', fr: 'Par défaut', de: 'Standard', es: 'Predeterminado' },
  { id: 'chime', ar: 'رنين خفيف', en: 'Chime', fr: 'Carillon', de: 'Glockenspiel', es: 'Campanilla' },
  { id: 'bell', ar: 'جرس', en: 'Bell', fr: 'Cloche', de: 'Glocke', es: 'Campana' },
]

export function uiLangFromNative(code: string): Lang {
  return isUiLang(code) ? code : 'en'
}

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
