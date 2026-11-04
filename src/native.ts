export type NativeApis = {
  exitApp: () => Promise<void>
  onBack: (handler: (canGoBack: boolean) => void) => Promise<() => void>
  requestNotify: () => Promise<boolean>
  syncDeckReminders: (opts: {
    enabled: boolean
    sound: string
    items: { id: number; title: string; body: string; hour: number; minute: number; path: string }[]
  }) => Promise<void>
}

let cached: NativeApis | null | undefined

export function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()
}

export function parseReminderTime(value?: string): { hour: number; minute: number } | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null
  const [h, m] = value.split(':').map(Number)
  if (h == null || m == null || h > 23 || m > 59) return null
  return { hour: h, minute: m }
}

export async function getNative(): Promise<NativeApis | null> {
  if (cached !== undefined) return cached
  if (!isNative()) {
    cached = null
    return null
  }
  const [{ App }, { LocalNotifications }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/local-notifications'),
  ])

  void LocalNotifications.addListener('localNotificationActionPerformed', (ev) => {
    const path = String(ev.notification.extra?.path || '/cards')
    if (window.location.pathname === path) return
    window.location.assign(path)
  })

  cached = {
    exitApp: () => App.exitApp(),
    onBack: async (handler) => {
      const sub = await App.addListener('backButton', ({ canGoBack }) => handler(canGoBack))
      return () => {
        void sub.remove()
      }
    },
    requestNotify: async () => {
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted'
    },
    syncDeckReminders: async ({ enabled, sound, items }) => {
      try {
        const pending = await LocalNotifications.getPending()
        const ids = pending.notifications.map((n) => ({ id: n.id }))
        if (ids.length) await LocalNotifications.cancel({ notifications: ids })
      } catch {
        /* ignore */
      }
      if (!enabled || items.length === 0) return
      const perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: items.map((it) => ({
          id: it.id,
          title: it.title,
          body: it.body,
          sound,
          schedule: { on: { hour: it.hour, minute: it.minute }, allowWhileIdle: true, repeats: true },
          extra: { path: it.path },
        })),
      })
    },
  }
  return cached
}
