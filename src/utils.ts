export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function now(): number {
  return Date.now()
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function startOfDay(ts = Date.now()): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function endOfDay(ts = Date.now()): number {
  const d = new Date(ts)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  return ts + days * 24 * 60 * 60 * 1000
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b)
}

const AR_COLOR_BASE: [string, string][] = [
  ['تركواز', 'teal'],
  ['فيروزي', 'turquoise'],
  ['برتقالي', 'orange'],
  ['بنفسجي', 'purple'],
  ['سماوي', 'skyblue'],
  ['كهرماني', 'goldenrod'],
  ['مرجاني', 'coral'],
  ['ليموني', 'lime'],
  ['ذهبي', 'gold'],
  ['رمادي', 'gray'],
  ['فضي', 'silver'],
  ['كحلي', 'navy'],
  ['نيلي', 'indigo'],
  ['زيتي', 'olivedrab'],
  ['نحاسي', 'peru'],
  ['احمر', 'red'],
  ['أحمر', 'red'],
  ['اخضر', 'green'],
  ['أخضر', 'green'],
  ['ازرق', 'blue'],
  ['أزرق', 'blue'],
  ['اصفر', 'yellow'],
  ['أصفر', 'yellow'],
  ['اسود', 'black'],
  ['أسود', 'black'],
  ['ابيض', 'white'],
  ['أبيض', 'white'],
  ['وردي', 'pink'],
  ['بني', 'brown'],
  ['cyan', 'cyan'],
]

function colorSupported(value: string): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('color', value)
  } catch {
    return false
  }
}

export function resolveColor(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (colorSupported(value)) return value
  let text = value.replace(/\s+/g, ' ')
  let shade: 'light' | 'dark' | '' = ''
  if (/(فاتح|\blight\b)/i.test(text)) {
    shade = 'light'
    text = text.replace(/فاتح|\blight\b/gi, '').trim()
  } else if (/(غامق|داكن|\bdark\b)/i.test(text)) {
    shade = 'dark'
    text = text.replace(/غامق|داكن|\bdark\b/gi, '').trim()
  }
  for (const [ar, en] of AR_COLOR_BASE) {
    if (text === ar || text.includes(ar)) {
      const named = shade ? `${shade}${en}` : en
      if (colorSupported(named)) return named
      if (colorSupported(en)) return en
    }
  }
  const lower = text.toLowerCase()
  const shaded = shade ? `${shade}${lower.replace(/\s+/g, '')}` : lower
  if (colorSupported(shaded)) return shaded
  if (colorSupported(lower)) return lower
  return null
}

export function contrastInk(color: string): string {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return '#ffffff'
  ctx.fillStyle = '#000000'
  ctx.fillStyle = color
  const parsed = ctx.fillStyle
  let r = 0
  let g = 0
  let b = 0
  if (parsed.startsWith('#')) {
    const h = parsed.slice(1)
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    r = parseInt(full.slice(0, 2), 16)
    g = parseInt(full.slice(2, 4), 16)
    b = parseInt(full.slice(4, 6), 16)
  } else {
    const m = parsed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!m) return '#ffffff'
    r = Number(m[1])
    g = Number(m[2])
    b = Number(m[3])
  }
  const lin = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!
  return luminance > 0.55 ? '#111827' : '#ffffff'
}

export function firstNoteImage(html: string): string | undefined {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return m?.[1]
}

function dateLocale(lang: string): string {
  if (lang === 'ar') return 'ar-EG'
  if (lang === 'fr') return 'fr-FR'
  if (lang === 'de') return 'de-DE'
  if (lang === 'es') return 'es-ES'
  return 'en-GB'
}

export function formatDate(ts: number, lang: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(dateLocale(lang), opts ?? { day: 'numeric', month: 'short' }).format(new Date(ts))
}

export function formatDateTime(ts: number, lang: string): string {
  return new Intl.DateTimeFormat(dateLocale(lang), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function weekdayLong(ts: number, lang: string): string {
  return new Intl.DateTimeFormat(dateLocale(lang), { weekday: 'long' }).format(new Date(ts))
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function audioExt(mimeType: string): string {
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a'
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

export function audioFileName(name: string, mimeType: string): string {
  const ext = audioExt(mimeType)
  const base = name.replace(/[<>:"/\\|?*]+/g, '').trim() || 'audio'
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`
}

export function formatBytes(bytes: number, kb: string, mb: string): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} ${mb}`
  return `${Math.max(1, Math.round(bytes / 1024))} ${kb}`
}

export function stripHtml(html: string): string {
  const d = document.createElement('div')
  d.innerHTML = html
  return (d.textContent || '').replace(/\s+/g, ' ').trim()
}

export function excerpt(text: string, n = 90): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

export function includesText(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle.toLowerCase())
}

export function pickMime(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ]
  if (typeof MediaRecorder === 'undefined') return 'audio/webm'
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

const SPEAK_LOCALES: Record<string, string> = {
  ar: 'ar-SA',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
  tr: 'tr-TR',
  it: 'it-IT',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  pt: 'pt-PT',
  hi: 'hi-IN',
  ur: 'ur-PK',
  fa: 'fa-IR',
  nl: 'nl-NL',
  pl: 'pl-PL',
  id: 'id-ID',
}

export function speakLocale(code: string): string {
  return SPEAK_LOCALES[code] || code || 'en-US'
}

let speakHold: SpeechSynthesisUtterance[] = []
let speakTimer = 0
let voiceTimer = 0
let speakGen = 0
let cachedVoices: SpeechSynthesisVoice[] = []

function normLang(s: string): string {
  return s.replace('_', '-').toLowerCase()
}

function pickVoice(voices: SpeechSynthesisVoice[], langCode: string, locale: string): SpeechSynthesisVoice | undefined {
  const want = langCode.toLowerCase()
  const loc = locale.toLowerCase()
  const match = (v: SpeechSynthesisVoice) => {
    const l = normLang(v.lang || '')
    return l === loc || l === want || l.startsWith(`${want}-`)
  }
  return voices.find((v) => normLang(v.lang || '') === loc) || voices.find((v) => match(v) && v.localService) || voices.find(match)
}

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return cachedVoices
  const voices = window.speechSynthesis.getVoices()
  if (voices.length) cachedVoices = voices
  return cachedVoices
}

export function stopSpeak(): void {
  speakGen += 1
  if (speakTimer) window.clearTimeout(speakTimer)
  if (voiceTimer) window.clearTimeout(voiceTimer)
  speakHold = []
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
}

export function speakText(text: string, langCode: string, repeats = 1): void {
  if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) return
  const synth = window.speechSynthesis
  const locale = speakLocale(langCode)
  const n = Math.max(1, Math.min(5, repeats))
  const gen = ++speakGen
  speakHold = []
  if (speakTimer) window.clearTimeout(speakTimer)
  if (voiceTimer) window.clearTimeout(voiceTimer)

  try {
    synth.cancel()
  } catch {
    /* ignore */
  }
  try {
    synth.resume()
  } catch {
    /* ignore */
  }

  const playWithVoices = (voices: SpeechSynthesisVoice[]) => {
    if (gen !== speakGen) return
    const voice = pickVoice(voices, langCode, locale)
    let left = n
    const play = () => {
      if (gen !== speakGen || left <= 0) return
      left -= 1
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = locale
      utterance.rate = 0.92
      utterance.pitch = 1
      if (voice) utterance.voice = voice
      utterance.onend = () => {
        if (gen === speakGen) play()
      }
      utterance.onerror = () => {
        if (gen === speakGen) left = 0
      }
      speakHold.push(utterance)
      try {
        synth.resume()
      } catch {
        /* ignore */
      }
      try {
        synth.speak(utterance)
      } catch {
        left = 0
      }
    }
    play()
  }

  const start = () => {
    if (gen !== speakGen) return
    playWithVoices(loadVoices())
  }

  const onVoices = () => {
    loadVoices()
    if (gen === speakGen) start()
  }

  const voices = loadVoices()
  if (voices.length) {
    speakTimer = window.setTimeout(start, 80)
    return
  }

  synth.addEventListener('voiceschanged', onVoices, { once: true })
  voiceTimer = window.setTimeout(start, 400)
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    loadVoices()
  })
}

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[ًٌٍَُِّْـ]/g, '')
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]!
    a[j] = t!
  }
  return a
}

export function relativeDay(ts: number, lang: string, todayLabel: string, yesterdayLabel: string): string {
  const diff = startOfDay() - startOfDay(ts)
  if (diff === 0) return todayLabel
  if (diff === 24 * 60 * 60 * 1000) return yesterdayLabel
  return formatDate(ts, lang, { day: 'numeric', month: 'short', year: 'numeric' })
}
