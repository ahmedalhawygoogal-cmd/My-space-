import type { Layout, LayoutItem } from 'react-grid-layout'

export const HOME_WIDGET_IDS = [
  'header',
  'progress',
  'quick-record',
  'stat-recordings',
  'stat-due',
  'stat-tasks',
  'stat-notes',
] as const

export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number]

export const DEFAULT_HOME_LAYOUT: LayoutItem[] = [
  { i: 'header', x: 0, y: 0, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'progress', x: 0, y: 2, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'quick-record', x: 0, y: 5, w: 12, h: 2, minW: 4, minH: 2 },
  { i: 'stat-recordings', x: 0, y: 7, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'stat-due', x: 3, y: 7, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'stat-tasks', x: 6, y: 7, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'stat-notes', x: 9, y: 7, w: 3, h: 2, minW: 2, minH: 2 },
]

const LAYOUT_KEY = 'home_layout'
const HIDDEN_KEY = 'home_hidden'
const OLD_ORDER_KEY = 'home_widget_order'
const OLD_HIDDEN_KEY = 'home_hidden_widgets'

function isWidgetId(id: unknown): id is HomeWidgetId {
  return typeof id === 'string' && (HOME_WIDGET_IDS as readonly string[]).includes(id)
}

function cloneItem(item: LayoutItem): LayoutItem {
  return {
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
    maxW: item.maxW,
    maxH: item.maxH,
  }
}

export function cloneHomeLayout(layout: Layout = DEFAULT_HOME_LAYOUT): LayoutItem[] {
  return layout.map(cloneItem)
}

function parseItem(raw: unknown): LayoutItem | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>
  if (!isWidgetId(item.i)) return null
  const x = item.x
  const y = item.y
  const w = item.w
  const h = item.h
  if (typeof x !== 'number' || typeof y !== 'number' || typeof w !== 'number' || typeof h !== 'number') return null
  if (![x, y, w, h].every(Number.isFinite)) return null
  return {
    i: item.i,
    x: Math.max(0, x),
    y: Math.max(0, y),
    w: Math.max(1, w),
    h: Math.max(1, h),
    minW: typeof item.minW === 'number' ? item.minW : undefined,
    minH: typeof item.minH === 'number' ? item.minH : undefined,
  }
}

export function loadHomeLayout(): LayoutItem[] {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return cloneHomeLayout()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return cloneHomeLayout()
    const items = parsed.map(parseItem).filter((item): item is LayoutItem => !!item)
    const byId = new Map(items.map((item) => [item.i, item]))
    return DEFAULT_HOME_LAYOUT.map((def) => cloneItem(byId.get(def.i) ?? def))
  } catch {
    return cloneHomeLayout()
  }
}

export function loadHomeHidden(): HomeWidgetId[] {
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

export function saveHomeGrid(layout: Layout, hidden: HomeWidgetId[]): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(cloneHomeLayout(layout)))
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden))
  localStorage.removeItem(OLD_ORDER_KEY)
  localStorage.removeItem(OLD_HIDDEN_KEY)
}

export function clearHomeLayout(): void {
  localStorage.removeItem(LAYOUT_KEY)
  localStorage.removeItem(HIDDEN_KEY)
  localStorage.removeItem(OLD_ORDER_KEY)
  localStorage.removeItem(OLD_HIDDEN_KEY)
}

export function layoutsForAllBreakpoints(layout: Layout) {
  const next = cloneHomeLayout(layout)
  return { lg: next, md: next, sm: next, xs: next }
}
