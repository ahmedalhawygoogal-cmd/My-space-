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

export function formatDate(ts: number, lang: string, opts?: Intl.DateTimeFormatOptions): string {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  return new Intl.DateTimeFormat(locale, opts ?? { day: 'numeric', month: 'short' }).format(new Date(ts))
}

export function formatDateTime(ts: number, lang: string): string {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

export function weekdayLong(ts: number, lang: string): string {
  const locale = lang === 'ar' ? 'ar-EG' : 'en-GB'
  return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(ts))
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

export function relativeDay(ts: number, lang: string, todayLabel: string, yesterdayLabel: string): string {
  const diff = startOfDay() - startOfDay(ts)
  if (diff === 0) return todayLabel
  if (diff === 24 * 60 * 60 * 1000) return yesterdayLabel
  return formatDate(ts, lang, { day: 'numeric', month: 'short', year: 'numeric' })
}
