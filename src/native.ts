export type NativeApis = {
  exitApp: () => Promise<void>
  onBack: (handler: (canGoBack: boolean) => void) => Promise<() => void>
  requestNotify: () => Promise<boolean>
  syncCardReminders: (opts: {
    count: number
    title: string
    body: string
    hour: number
    minute: number
    enabled: boolean
  }) => Promise<void>
}

let cached: NativeApis | null | undefined

export function isNative(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof cap?.isNativePlatform === 'function' && cap.isNativePlatform()
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

  void LocalNotifications.addListener('localNotificationActionPerformed', () => {
    if (window.location.pathname.startsWith('/cards')) return
    window.location.assign('/cards')
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
    syncCardReminders: async ({ count, title, body, hour, minute, enabled }) => {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }] })
      } catch {
        /* ignore */
      }
      if (!enabled || count <= 0) return
      const perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1001,
            title,
            body,
            schedule: { on: { hour, minute }, allowWhileIdle: true, repeats: true },
            extra: { path: '/cards' },
          },
        ],
      })
    },
  }
  return cached
}
