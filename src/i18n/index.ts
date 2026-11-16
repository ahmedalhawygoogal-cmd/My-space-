import { isUiLang, type Lang } from '../types'
import ar from './locales/ar'
import en from './locales/en'

export type I18nKey = keyof typeof ar
type Table = Record<I18nKey, string>
type LocaleModule = { default: Table }

const dict: Partial<Record<Lang, Table>> = { ar, en }
const inFlight = new Map<Lang, Promise<void>>()
let version = 0
const listeners = new Set<() => void>()

function notify() {
  version += 1
  for (const listener of listeners) listener()
}

export function subscribeI18n(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getI18nVersion(): number {
  return version
}

const loaders: Record<Exclude<Lang, 'ar' | 'en'>, () => Promise<LocaleModule>> = {
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  es: () => import('./locales/es'),
  tr: () => import('./locales/tr'),
  it: () => import('./locales/it'),
  ru: () => import('./locales/ru'),
  zh: () => import('./locales/zh'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  pt: () => import('./locales/pt'),
  hi: () => import('./locales/hi'),
  ur: () => import('./locales/ur'),
  fa: () => import('./locales/fa'),
  nl: () => import('./locales/nl'),
  pl: () => import('./locales/pl'),
  id: () => import('./locales/id'),
}

/**
 * Load and cache a UI locale. `ar` and `en` are bundled eagerly; every other
 * locale is fetched on demand. Resolves even when the chunk fails, so callers
 * can render with the English fallback instead of blocking the UI.
 */
export function loadLocale(lang: string): Promise<void> {
  if (!isUiLang(lang) || lang === 'ar' || lang === 'en' || dict[lang]) return Promise.resolve()
  const pending = inFlight.get(lang)
  if (pending) return pending
  const promise = loaders[lang]()
    .then((module) => {
      dict[lang] = module.default
      inFlight.delete(lang)
      notify()
    })
    .catch((error) => {
      inFlight.delete(lang)
      console.error(`Failed to load locale "${lang}"`, error)
    })
  inFlight.set(lang, promise)
  return promise
}

export function t(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  const table = dict[lang]
  let s = (table && table[key]) || dict.en?.[key] || dict.ar?.[key] || key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  }
  return s
}
