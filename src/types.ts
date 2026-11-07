export type Lang =
  | 'ar'
  | 'en'
  | 'fr'
  | 'de'
  | 'es'
  | 'tr'
  | 'it'
  | 'ru'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'pt'
  | 'hi'
  | 'ur'
  | 'fa'
  | 'nl'
  | 'pl'
  | 'id'

export const UI_LANGS: Lang[] = [
  'ar',
  'en',
  'fr',
  'de',
  'es',
  'tr',
  'it',
  'ru',
  'zh',
  'ja',
  'ko',
  'pt',
  'hi',
  'ur',
  'fa',
  'nl',
  'pl',
  'id',
]

export const RTL_LANGS: ReadonlySet<Lang> = new Set(['ar', 'ur', 'fa'])

export function isUiLang(code?: string): code is Lang {
  return !!code && (UI_LANGS as string[]).includes(code)
}

export type Labeled = { ar: string; en: string; ind?: string } & Partial<Record<Exclude<Lang, 'id'>, string>>

export function labeled(lang: Lang, o: Labeled): string {
  if (lang === 'id') return o.ind || o.en
  return o[lang] || o.en
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

export type RecDistance = 'near' | 'medium' | 'far'

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
  distance: RecDistance
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

export type QuoteField = string | Labeled

export function quoteField(value: QuoteField | undefined, lang: string): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const code = isUiLang(lang) ? lang : 'en'
  return labeled(code, value)
}

export interface QuoteCharacter {
  id: string
  name: QuoteField
  story: QuoteField
  challenge: QuoteField
  quote: QuoteField
  image?: string | Blob
  createdAt?: number
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
  swapped?: boolean
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
  easeFactor: number
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
export type DailyGoal = '10' | '30' | '60'
export type GoalKind = 'study' | 'productivity' | 'record' | 'all'
export type InputPref = 'type' | 'voice' | 'both'
export type UserLevel = 'beginner' | 'intermediate' | 'advanced'

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
  inputPref: InputPref
  userLevel: UserLevel
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
  nativeLang: '',
  nativeLangOther: '',
  targetLangs: [],
  targetLangOther: '',
  goal: 'study',
  goalOther: '',
  fields: [],
  fieldOther: '',
  dailyGoal: '30',
  inputPref: 'both',
  userLevel: 'beginner',
}

export const DECK_TYPES: DeckType[] = ['vocab', 'phrases', 'synonyms', 'definitions', 'antonyms']

export const NATIVE_LANG_OPTS = [
  { code: 'ar', ar: 'العربية', en: 'Arabic', fr: 'Arabe', de: 'Arabisch', es: 'Árabe', tr: 'Arapça', it: 'Arabo', ru: 'Арабский', zh: '阿拉伯语', ja: 'アラビア語', ko: '아랍어', pt: 'Árabe', hi: 'अरबी', ur: 'عربی', fa: 'عربی', nl: 'Arabisch', pl: 'Arabski', ind: 'Arab' },
  { code: 'en', ar: 'الإنجليزية', en: 'English', fr: 'Anglais', de: 'Englisch', es: 'Inglés', tr: 'İngilizce', it: 'Inglese', ru: 'Английский', zh: '英语', ja: '英語', ko: '영어', pt: 'Inglês', hi: 'अंग्रेज़ी', ur: 'انگریزی', fa: 'انگلیسی', nl: 'Engels', pl: 'Angielski', ind: 'Inggris' },
  { code: 'fr', ar: 'الفرنسية', en: 'French', fr: 'Français', de: 'Französisch', es: 'Francés', tr: 'Fransızca', it: 'Francese', ru: 'Французский', zh: '法语', ja: 'フランス語', ko: '프랑스어', pt: 'Francês', hi: 'फ़्रेंच', ur: 'فرانسیسی', fa: 'فرانسوی', nl: 'Frans', pl: 'Francuski', ind: 'Prancis' },
  { code: 'de', ar: 'الألمانية', en: 'German', fr: 'Allemand', de: 'Deutsch', es: 'Alemán', tr: 'Almanca', it: 'Tedesco', ru: 'Немецкий', zh: '德语', ja: 'ドイツ語', ko: '독일어', pt: 'Alemão', hi: 'जर्मन', ur: 'جرمن', fa: 'آلمانی', nl: 'Duits', pl: 'Niemiecki', ind: 'Jerman' },
  { code: 'es', ar: 'الإسبانية', en: 'Spanish', fr: 'Espagnol', de: 'Spanisch', es: 'Español', tr: 'İspanyolca', it: 'Spagnolo', ru: 'Испанский', zh: '西班牙语', ja: 'スペイン語', ko: '스페인어', pt: 'Espanhol', hi: 'स्पेनिश', ur: 'ہسپانوی', fa: 'اسپانیایی', nl: 'Spaans', pl: 'Hiszpański', ind: 'Spanyol' },
]

export const TARGET_LANG_OPTS = [
  { code: 'en', ar: 'الإنجليزية', en: 'English', fr: 'Anglais', de: 'Englisch', es: 'Inglés', tr: 'İngilizce', it: 'Inglese', ru: 'Английский', zh: '英语', ja: '英語', ko: '영어', pt: 'Inglês', hi: 'अंग्रेज़ी', ur: 'انگریزی', fa: 'انگلیسی', nl: 'Engels', pl: 'Angielski', ind: 'Inggris' },
  { code: 'fr', ar: 'الفرنسية', en: 'French', fr: 'Français', de: 'Französisch', es: 'Francés', tr: 'Fransızca', it: 'Francese', ru: 'Французский', zh: '法语', ja: 'フランス語', ko: '프랑스어', pt: 'Francês', hi: 'फ़्रेंच', ur: 'فرانسیسی', fa: 'فرانسوی', nl: 'Frans', pl: 'Francuski', ind: 'Prancis' },
  { code: 'es', ar: 'الإسبانية', en: 'Spanish', fr: 'Espagnol', de: 'Spanisch', es: 'Español', tr: 'İspanyolca', it: 'Spagnolo', ru: 'Испанский', zh: '西班牙语', ja: 'スペイン語', ko: '스페인어', pt: 'Espanhol', hi: 'स्पेनिश', ur: 'ہسپانوی', fa: 'اسپانیایی', nl: 'Spaans', pl: 'Hiszpański', ind: 'Spanyol' },
  { code: 'de', ar: 'الألمانية', en: 'German', fr: 'Allemand', de: 'Deutsch', es: 'Alemán', tr: 'Almanca', it: 'Tedesco', ru: 'Немецкий', zh: '德语', ja: 'ドイツ語', ko: '독일어', pt: 'Alemão', hi: 'जर्मन', ur: 'جرمن', fa: 'آلمانی', nl: 'Duits', pl: 'Niemiecki', ind: 'Jerman' },
]

export const GOAL_OPTS: ({ id: GoalKind } & Labeled)[] = [
  { id: 'study', ar: 'مذاكرة', en: 'Study', fr: 'Études', de: 'Lernen', es: 'Estudio', tr: 'Çalışma', it: 'Studio', ru: 'Учёба', zh: '学习', ja: '学習', ko: '학습', pt: 'Estudo', hi: 'अध्ययन', ur: 'مطالعہ', fa: 'مطالعه', nl: 'Studie', pl: 'Nauka', ind: 'Belajar' },
  { id: 'productivity', ar: 'إنتاجية', en: 'Productivity', fr: 'Productivité', de: 'Produktivität', es: 'Productividad', tr: 'Verimlilik', it: 'Produttività', ru: 'Продуктивность', zh: '效率', ja: '生産性', ko: '생산성', pt: 'Produtividade', hi: 'उत्पादकता', ur: 'پیداواری صلاحیت', fa: 'بهره‌وری', nl: 'Productiviteit', pl: 'Produktywność', ind: 'Produktivitas' },
  { id: 'record', ar: 'تسجيل', en: 'Recording', fr: 'Enregistrement', de: 'Aufnahme', es: 'Grabación', tr: 'Kayıt', it: 'Registrazione', ru: 'Запись', zh: '录音', ja: '録音', ko: '녹음', pt: 'Gravação', hi: 'रिकॉर्डिंग', ur: 'ریکارڈنگ', fa: 'ضبط', nl: 'Opname', pl: 'Nagrywanie', ind: 'Rekaman' },
  { id: 'all', ar: 'الكل', en: 'All', fr: 'Tout', de: 'Alles', es: 'Todo', tr: 'Tümü', it: 'Tutto', ru: 'Все', zh: '全部', ja: 'すべて', ko: '전체', pt: 'Tudo', hi: 'सभी', ur: 'سب', fa: 'همه', nl: 'Alles', pl: 'Wszystko', ind: 'Semua' },
]

export const FIELD_OPTS: ({ id: string } & Labeled)[] = [
  { id: 'languages', ar: 'لغات', en: 'Languages', fr: 'Langues', de: 'Sprachen', es: 'Idiomas', tr: 'Diller', it: 'Lingue', ru: 'Языки', zh: '语言', ja: '言語', ko: '언어', pt: 'Idiomas', hi: 'भाषाएँ', ur: 'زبانیں', fa: 'زبان‌ها', nl: 'Talen', pl: 'Języki', ind: 'Bahasa' },
  { id: 'science', ar: 'علوم', en: 'Science', fr: 'Sciences', de: 'Wissenschaft', es: 'Ciencia', tr: 'Bilim', it: 'Scienza', ru: 'Наука', zh: '科学', ja: '科学', ko: '과학', pt: 'Ciência', hi: 'विज्ञान', ur: 'سائنس', fa: 'علوم', nl: 'Wetenschap', pl: 'Nauka', ind: 'Sains' },
  { id: 'coding', ar: 'برمجة', en: 'Coding', fr: 'Programmation', de: 'Programmieren', es: 'Programación', tr: 'Kodlama', it: 'Programmazione', ru: 'Программирование', zh: '编程', ja: 'プログラミング', ko: '코딩', pt: 'Programação', hi: 'कोडिंग', ur: 'کوڈنگ', fa: 'برنامه‌نویسی', nl: 'Programmeren', pl: 'Programowanie', ind: 'Pemrograman' },
  { id: 'business', ar: 'أعمال', en: 'Business', fr: 'Affaires', de: 'Wirtschaft', es: 'Negocios', tr: 'İş', it: 'Business', ru: 'Бизнес', zh: '商务', ja: 'ビジネス', ko: '비즈니스', pt: 'Negócios', hi: 'व्यवसाय', ur: 'کاروبار', fa: 'کسب‌وکار', nl: 'Zakelijk', pl: 'Biznes', ind: 'Bisnis' },
  { id: 'medicine', ar: 'طب', en: 'Medicine', fr: 'Médecine', de: 'Medizin', es: 'Medicina', tr: 'Tıp', it: 'Medicina', ru: 'Медицина', zh: '医学', ja: '医学', ko: '의학', pt: 'Medicina', hi: 'चिकित्सा', ur: 'طب', fa: 'پزشکی', nl: 'Geneeskunde', pl: 'Medycyna', ind: 'Kedokteran' },
  { id: 'arts', ar: 'فنون', en: 'Arts', fr: 'Arts', de: 'Kunst', es: 'Artes', tr: 'Sanat', it: 'Arti', ru: 'Искусство', zh: '艺术', ja: '芸術', ko: '예술', pt: 'Artes', hi: 'कला', ur: 'فنون', fa: 'هنر', nl: 'Kunst', pl: 'Sztuka', ind: 'Seni' },
  { id: 'other', ar: 'أخرى', en: 'Other', fr: 'Autre', de: 'Andere', es: 'Otro', tr: 'Diğer', it: 'Altro', ru: 'Другое', zh: '其他', ja: 'その他', ko: '기타', pt: 'Outro', hi: 'अन्य', ur: 'دیگر', fa: 'سایر', nl: 'Overig', pl: 'Inne', ind: 'Lainnya' },
]

export const DAILY_OPTS: ({ id: DailyGoal } & Labeled)[] = [
  { id: '10', ar: '5–10 دقائق', en: '5–10 min', fr: '5–10 min', de: '5–10 Min.', es: '5–10 min', tr: '5–10 dk', it: '5–10 min', ru: '5–10 мин', zh: '5–10 分钟', ja: '5–10分', ko: '5–10분', pt: '5–10 min', hi: '5–10 मिनट', ur: '5–10 منٹ', fa: '۵–۱۰ دقیقه', nl: '5–10 min', pl: '5–10 min', ind: '5–10 mnt' },
  { id: '30', ar: '15–30 دقيقة', en: '15–30 min', fr: '15–30 min', de: '15–30 Min.', es: '15–30 min', tr: '15–30 dk', it: '15–30 min', ru: '15–30 мин', zh: '15–30 分钟', ja: '15–30分', ko: '15–30분', pt: '15–30 min', hi: '15–30 मिनट', ur: '15–30 منٹ', fa: '۱۵–۳۰ دقیقه', nl: '15–30 min', pl: '15–30 min', ind: '15–30 mnt' },
  { id: '60', ar: 'أكثر من 60 دقيقة', en: '60+ min', fr: '60+ min', de: '60+ Min.', es: 'Más de 60 min', tr: '60+ dk', it: '60+ min', ru: '60+ мин', zh: '60+ 分钟', ja: '60分以上', ko: '60분 이상', pt: '60+ min', hi: '60+ मिनट', ur: '60+ منٹ', fa: '۶۰+ دقیقه', nl: '60+ min', pl: '60+ min', ind: '60+ mnt' },
]

export const INPUT_PREF_OPTS: ({ id: InputPref } & Labeled)[] = [
  { id: 'type', ar: 'كتابة', en: 'Typing', fr: 'Écriture', de: 'Tippen', es: 'Escritura', tr: 'Yazma', it: 'Digitazione', ru: 'Ввод', zh: '打字', ja: '入力', ko: '입력', pt: 'Digitação', hi: 'टाइपिंग', ur: 'ٹائپنگ', fa: 'تایپ', nl: 'Typen', pl: 'Pisanie', ind: 'Mengetik' },
  { id: 'voice', ar: 'صوت', en: 'Voice', fr: 'Voix', de: 'Stimme', es: 'Voz', tr: 'Ses', it: 'Voce', ru: 'Голос', zh: '语音', ja: '音声', ko: '음성', pt: 'Voz', hi: 'आवाज़', ur: 'آواز', fa: 'صدا', nl: 'Stem', pl: 'Głos', ind: 'Suara' },
  { id: 'both', ar: 'الاثنين', en: 'Both', fr: 'Les deux', de: 'Beides', es: 'Ambos', tr: 'İkisi', it: 'Entrambi', ru: 'Оба', zh: '两者', ja: '両方', ko: '둘 다', pt: 'Ambos', hi: 'दोनों', ur: 'دونوں', fa: 'هر دو', nl: 'Beide', pl: 'Oba', ind: 'Keduanya' },
]

export const LEVEL_OPTS: ({ id: UserLevel } & Labeled)[] = [
  { id: 'beginner', ar: 'مبتدئ', en: 'Beginner', fr: 'Débutant', de: 'Anfänger', es: 'Principiante', tr: 'Başlangıç', it: 'Principiante', ru: 'Начальный', zh: '初级', ja: '初級', ko: '초급', pt: 'Iniciante', hi: 'शुरुआती', ur: 'مبتدی', fa: 'مبتدی', nl: 'Beginner', pl: 'Początkujący', ind: 'Pemula' },
  { id: 'intermediate', ar: 'متوسط', en: 'Intermediate', fr: 'Intermédiaire', de: 'Mittelstufe', es: 'Intermedio', tr: 'Orta', it: 'Intermedio', ru: 'Средний', zh: '中级', ja: '中級', ko: '중급', pt: 'Intermediário', hi: 'मध्यम', ur: 'متوسط', fa: 'متوسط', nl: 'Gemiddeld', pl: 'Średniozaawansowany', ind: 'Menengah' },
  { id: 'advanced', ar: 'متقدم', en: 'Advanced', fr: 'Avancé', de: 'Fortgeschritten', es: 'Avanzado', tr: 'İleri', it: 'Avanzato', ru: 'Продвинутый', zh: '高级', ja: '上級', ko: '고급', pt: 'Avançado', hi: 'उन्नत', ur: 'اعلی', fa: 'پیشرفته', nl: 'Gevorderd', pl: 'Zaawansowany', ind: 'Lanjutan' },
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
  { id: 'default', ar: 'الافتراضية', en: 'Default', fr: 'Par défaut', de: 'Standard', es: 'Predeterminado', tr: 'Varsayılan', it: 'Predefinito', ru: 'По умолчанию', zh: '默认', ja: 'デフォルト', ko: '기본', pt: 'Padrão', hi: 'डिफ़ॉल्ट', ur: 'طے شدہ', fa: 'پیش‌فرض', nl: 'Standaard', pl: 'Domyślny', ind: 'Default' },
  { id: 'chime', ar: 'رنين خفيف', en: 'Chime', fr: 'Carillon', de: 'Glockenspiel', es: 'Campanilla', tr: 'Çan', it: 'Campanello', ru: 'Перезвон', zh: '风铃', ja: 'チャイム', ko: '차임', pt: 'Sino', hi: 'घंटी', ur: 'چائم', fa: 'زنگ ملایم', nl: 'Beltoon', pl: 'Dzwonek', ind: 'Lonceng' },
  { id: 'bell', ar: 'جرس', en: 'Bell', fr: 'Cloche', de: 'Glocke', es: 'Campana', tr: 'Zil', it: 'Campana', ru: 'Колокол', zh: '铃声', ja: 'ベル', ko: '벨', pt: 'Campainha', hi: 'घंटा', ur: 'گھنٹی', fa: 'زنگ', nl: 'Bel', pl: 'Dzwon', ind: 'Bel' },
]

export function uiLangFromNative(code: string): Lang {
  return isUiLang(code) ? code : 'en'
}

export const LEARN_LANGS: ({ code: string } & Labeled)[] = [
  { code: 'ar', ar: 'العربية', en: 'Arabic', fr: 'Arabe', de: 'Arabisch', es: 'Árabe', tr: 'Arapça', it: 'Arabo', ru: 'Арабский', zh: '阿拉伯语', ja: 'アラビア語', ko: '아랍어', pt: 'Árabe', hi: 'अरबी', ur: 'عربی', fa: 'عربی', nl: 'Arabisch', pl: 'Arabski', ind: 'Arab' },
  { code: 'en', ar: 'الإنجليزية', en: 'English', fr: 'Anglais', de: 'Englisch', es: 'Inglés', tr: 'İngilizce', it: 'Inglese', ru: 'Английский', zh: '英语', ja: '英語', ko: '영어', pt: 'Inglês', hi: 'अंग्रेज़ी', ur: 'انگریزی', fa: 'انگلیسی', nl: 'Engels', pl: 'Angielski', ind: 'Inggris' },
  { code: 'fr', ar: 'الفرنسية', en: 'French', fr: 'Français', de: 'Französisch', es: 'Francés', tr: 'Fransızca', it: 'Francese', ru: 'Французский', zh: '法语', ja: 'フランス語', ko: '프랑스어', pt: 'Francês', hi: 'फ़्रेंच', ur: 'فرانسیسی', fa: 'فرانسوی', nl: 'Frans', pl: 'Francuski', ind: 'Prancis' },
  { code: 'es', ar: 'الإسبانية', en: 'Spanish', fr: 'Espagnol', de: 'Spanisch', es: 'Español', tr: 'İspanyolca', it: 'Spagnolo', ru: 'Испанский', zh: '西班牙语', ja: 'スペイン語', ko: '스페인어', pt: 'Espanhol', hi: 'स्पेनिश', ur: 'ہسپانوی', fa: 'اسپانیایی', nl: 'Spaans', pl: 'Hiszpański', ind: 'Spanyol' },
  { code: 'de', ar: 'الألمانية', en: 'German', fr: 'Allemand', de: 'Deutsch', es: 'Alemán', tr: 'Almanca', it: 'Tedesco', ru: 'Немецкий', zh: '德语', ja: 'ドイツ語', ko: '독일어', pt: 'Alemão', hi: 'जर्मन', ur: 'جرمن', fa: 'آلمانی', nl: 'Duits', pl: 'Niemiecki', ind: 'Jerman' },
  { code: 'tr', ar: 'التركية', en: 'Turkish', fr: 'Turc', de: 'Türkisch', es: 'Turco', tr: 'Türkçe', it: 'Turco', ru: 'Турецкий', zh: '土耳其语', ja: 'トルコ語', ko: '터키어', pt: 'Turco', hi: 'तुर्की', ur: 'ترکی', fa: 'ترکی', nl: 'Turks', pl: 'Turecki', ind: 'Turki' },
  { code: 'it', ar: 'الإيطالية', en: 'Italian', fr: 'Italien', de: 'Italienisch', es: 'Italiano', tr: 'İtalyanca', it: 'Italiano', ru: 'Итальянский', zh: '意大利语', ja: 'イタリア語', ko: '이탈리아어', pt: 'Italiano', hi: 'इतालवी', ur: 'اطالوی', fa: 'ایتالیایی', nl: 'Italiaans', pl: 'Włoski', ind: 'Italia' },
  { code: 'ru', ar: 'الروسية', en: 'Russian', fr: 'Russe', de: 'Russisch', es: 'Ruso', tr: 'Rusça', it: 'Russo', ru: 'Русский', zh: '俄语', ja: 'ロシア語', ko: '러시아어', pt: 'Russo', hi: 'रूसी', ur: 'روسی', fa: 'روسی', nl: 'Russisch', pl: 'Rosyjski', ind: 'Rusia' },
  { code: 'zh', ar: 'الصينية', en: 'Chinese', fr: 'Chinois', de: 'Chinesisch', es: 'Chino', tr: 'Çince', it: 'Cinese', ru: 'Китайский', zh: '中文', ja: '中国語', ko: '중국어', pt: 'Chinês', hi: 'चीनी', ur: 'چینی', fa: 'چینی', nl: 'Chinees', pl: 'Chiński', ind: 'Mandarin' },
  { code: 'ja', ar: 'اليابانية', en: 'Japanese', fr: 'Japonais', de: 'Japanisch', es: 'Japonés', tr: 'Japonca', it: 'Giapponese', ru: 'Японский', zh: '日语', ja: '日本語', ko: '일본어', pt: 'Japonês', hi: 'जापानी', ur: 'جاپانی', fa: 'ژاپنی', nl: 'Japans', pl: 'Japoński', ind: 'Jepang' },
  { code: 'ko', ar: 'الكورية', en: 'Korean', fr: 'Coréen', de: 'Koreanisch', es: 'Coreano', tr: 'Korece', it: 'Coreano', ru: 'Корейский', zh: '韩语', ja: '韓国語', ko: '한국어', pt: 'Coreano', hi: 'कोरियाई', ur: 'کوریائی', fa: 'کره‌ای', nl: 'Koreaans', pl: 'Koreański', ind: 'Korea' },
  { code: 'pt', ar: 'البرتغالية', en: 'Portuguese', fr: 'Portugais', de: 'Portugiesisch', es: 'Portugués', tr: 'Portekizce', it: 'Portoghese', ru: 'Португальский', zh: '葡萄牙语', ja: 'ポルトガル語', ko: '포르투갈어', pt: 'Português', hi: 'पुर्तगाली', ur: 'پرتگالی', fa: 'پرتغالی', nl: 'Portugees', pl: 'Portugalski', ind: 'Portugis' },
  { code: 'hi', ar: 'الهندية', en: 'Hindi', fr: 'Hindi', de: 'Hindi', es: 'Hindi', tr: 'Hintçe', it: 'Hindi', ru: 'Хинди', zh: '印地语', ja: 'ヒンディー語', ko: '힌디어', pt: 'Hindi', hi: 'हिन्दी', ur: 'ہندی', fa: 'هندی', nl: 'Hindi', pl: 'Hindi', ind: 'Hindi' },
  { code: 'ur', ar: 'الأردية', en: 'Urdu', fr: 'Ourdou', de: 'Urdu', es: 'Urdu', tr: 'Urduca', it: 'Urdu', ru: 'Урду', zh: '乌尔都语', ja: 'ウルドゥー語', ko: '우르두어', pt: 'Urdu', hi: 'उर्दू', ur: 'اردو', fa: 'اردو', nl: 'Urdu', pl: 'Urdu', ind: 'Urdu' },
  { code: 'fa', ar: 'الفارسية', en: 'Persian', fr: 'Persan', de: 'Persisch', es: 'Persa', tr: 'Farsça', it: 'Persiano', ru: 'Персидский', zh: '波斯语', ja: 'ペルシア語', ko: '페르시아어', pt: 'Persa', hi: 'फ़ारसी', ur: 'فارسی', fa: 'فارسی', nl: 'Perzisch', pl: 'Perski', ind: 'Persia' },
  { code: 'nl', ar: 'الهولندية', en: 'Dutch', fr: 'Néerlandais', de: 'Niederländisch', es: 'Neerlandés', tr: 'Felemenkçe', it: 'Olandese', ru: 'Нидерландский', zh: '荷兰语', ja: 'オランダ語', ko: '네덜란드어', pt: 'Holandês', hi: 'डच', ur: 'ڈچ', fa: 'هلندی', nl: 'Nederlands', pl: 'Niderlandzki', ind: 'Belanda' },
  { code: 'pl', ar: 'البولندية', en: 'Polish', fr: 'Polonais', de: 'Polnisch', es: 'Polaco', tr: 'Lehçe', it: 'Polacco', ru: 'Польский', zh: '波兰语', ja: 'ポーランド語', ko: '폴란드어', pt: 'Polonês', hi: 'पोलिश', ur: 'پولش', fa: 'لهستانی', nl: 'Pools', pl: 'Polski', ind: 'Polandia' },
  { code: 'id', ar: 'الإندونيسية', en: 'Indonesian', fr: 'Indonésien', de: 'Indonesisch', es: 'Indonesio', tr: 'Endonezce', it: 'Indonesiano', ru: 'Индонезийский', zh: '印尼语', ja: 'インドネシア語', ko: '인도네시아어', pt: 'Indonésio', hi: 'इंडोनेशियाई', ur: 'انڈونیشیائی', fa: 'اندونزیایی', nl: 'Indonesisch', pl: 'Indonezyjski', ind: 'Indonesia' },
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
