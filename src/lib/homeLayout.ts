export const HOME_WIDGET_IDS = ['progress', 'quickRecord', 'stats'] as const
export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number]

export const DEFAULT_HOME_ORDER: HomeWidgetId[] = [...HOME_WIDGET_IDS]

const ORDER_KEY = 'home_widget_order'
const HIDDEN_KEY = 'home_hidden_widgets'

function isWidgetId(id: unknown): id is HomeWidgetId {
  return typeof id === 'string' && (HOME_WIDGET_IDS as readonly string[]).includes(id)
}

export function loadHomeWidgetOrder(): HomeWidgetId[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    if (!raw) return [...DEFAULT_HOME_ORDER]
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return [...DEFAULT_HOME_ORDER]
    const valid = parsed.filter(isWidgetId)
    for (const id of HOME_WIDGET_IDS) {
      if (!valid.includes(id)) valid.push(id)
    }
    return valid
  } catch {
    return [...DEFAULT_HOME_ORDER]
  }
}

export function loadHomeHiddenWidgets(): HomeWidgetId[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isWidgetId)
  } catch {
    return []
  }
}

export function saveHomeLayout(order: HomeWidgetId[], hidden: HomeWidgetId[]): void {
  localStorage.setItem(ORDER_KEY, JSON.stringify(order))
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
}

export function clearHomeLayout(): void {
  localStorage.removeItem(ORDER_KEY)
  localStorage.removeItem(HIDDEN_KEY)
}
