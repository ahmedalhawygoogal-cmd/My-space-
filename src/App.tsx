import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout, Splash } from './layout'
import { StoreProvider, useStore } from './store'
import { AuthProvider, useAuth } from './auth'
import { supabase } from './lib/supabase'
import { fetchProfile } from './lib/profileSync'
import HomePage from './pages/Home'
import OnboardingPage from './pages/Onboarding'
import AuthPage from './pages/Auth'
import { getNative } from './native'
import { t } from './i18n'
import AppBackground from './components/AppBackground'

const RecorderPage = lazy(() => import('./pages/Recorder'))
const LiveRecordPage = lazy(() => import('./pages/Recorder').then((m) => ({ default: m.LiveRecordPage })))
const RecordingDetailPage = lazy(() => import('./pages/Recorder').then((m) => ({ default: m.RecordingDetailPage })))
const FlashcardsPage = lazy(() => import('./pages/Flashcards'))
const DeckPage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.DeckPage })))
const StudyPage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.StudyPage })))
const TestPage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.TestPage })))
const ChoiceGamePage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.ChoiceGamePage })))
const MatchGamePage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.MatchGamePage })))
const WriteGamePage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.WriteGamePage })))
const ListenGamePage = lazy(() => import('./pages/Flashcards').then((m) => ({ default: m.ListenGamePage })))
const TasksPage = lazy(() => import('./pages/Tasks'))
const TaskDetailPage = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.TaskDetailPage })))
const NotebookPage = lazy(() => import('./pages/Notebook'))
const NoteEditorPage = lazy(() => import('./pages/Notebook').then((m) => ({ default: m.NoteEditorPage })))
const NoteReadPage = lazy(() => import('./pages/Notebook').then((m) => ({ default: m.NoteReadPage })))
const SearchPage = lazy(() => import('./pages/Search'))
const SettingsPage = lazy(() => import('./pages/Settings'))
const DownloadsPage = lazy(() => import('./pages/Downloads'))
const MotivateMePage = lazy(() => import('./pages/MotivateMe'))
const HabitsPage = lazy(() => import('./pages/Habits'))
const HabitDetailsPage = lazy(() => import('./pages/HabitDetails'))
const AIChatPage = lazy(() => import('./pages/AIChat'))

let hardResetInProgress = false

async function hardReset() {
  if (hardResetInProgress) return
  hardResetInProgress = true

  try {
    try {
      localStorage.clear()
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    try {
      sessionStorage.clear()
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    const cleanupTasks: Promise<unknown>[] = []

    if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
      cleanupTasks.push(
        (async () => {
          const databases = await indexedDB.databases()
          await Promise.all(
            databases.map(({ name }) => {
              if (!name) return Promise.resolve()
              return new Promise<void>((resolve) => {
                const finish = () => resolve()
                try {
                  const request = indexedDB.deleteDatabase(name)
                  request.onsuccess = finish
                  request.onerror = finish
                  request.onblocked = finish
                } catch {
                  finish()
                }
              })
            }),
          )
        })(),
      )
    }

    try {
      if ('serviceWorker' in navigator) {
        cleanupTasks.push(
          navigator.serviceWorker.getRegistrations().then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister())),
          ),
        )
      }
    } catch {
      // Continue to the reload even if service-worker access is blocked.
    }

    try {
      if ('caches' in window) {
        cleanupTasks.push(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))))
      }
    } catch {
      // CacheStorage is optional and may be unavailable in restricted contexts.
    }

    await Promise.race([
      Promise.allSettled(cleanupTasks).then(() => undefined),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
    ])
  } catch (error) {
    console.error('Failed to clear app data during hard reset', error)
  } finally {
    // @ts-expect-error Legacy reload argument requests a fresh document in browsers that support it.
    window.location.reload(true)
  }
}

function NativeBack() {
  useEffect(() => {
    let alive = true
    let remove: (() => void) | undefined
    void getNative().then((native) => {
      if (!native || !alive) return
      void native
        .onBack((canGoBack) => {
          if (canGoBack && window.location.pathname !== '/') {
            window.history.back()
            return
          }
          void native.exitApp()
        })
        .then((fn) => {
          if (!alive) {
            fn()
            return
          }
          remove = fn
        })
    })
    return () => {
      alive = false
      remove?.()
    }
  }, [])
  return null
}

function CardReminders() {
  const { ready, cards, decks, settings } = useStore()
  useEffect(() => {
    if (!ready) return
    void getNative().then((native) => {
      if (!native) return
      const due = cards.filter((c) => (c.nextReviewDate || c.dueAt) <= Date.now()).length
      const items =
        due > 0
          ? [
              {
                id: 2000,
                title: t(settings.language, 'reminderTitle'),
                body: t(settings.language, 'reminderBody', { n: due, name: decks[0]?.name || '' }),
                hour: 9,
                minute: 0,
                path: '/cards',
              },
            ]
          : []
      void native.syncDeckReminders({
        enabled: !!settings.cardReminders,
        sound: settings.notifySound ?? 'default',
        items,
      })
    })
  }, [ready, cards, decks, settings.cardReminders, settings.notifySound, settings.language])
  return null
}

function Gate() {
  const { ready, settings } = useStore()
  const { user, loading } = useAuth()
  const loc = useLocation()
  const [isAppLoading, setIsAppLoading] = useState(true)
  const [cloudOnboarded, setCloudOnboarded] = useState<boolean | null>(null)
  const isLoading = isAppLoading || !ready || loading

  useEffect(() => {
    if (!isLoading) return
    const timeout = window.setTimeout(() => {
      void hardReset()
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [isLoading])

  useEffect(() => {
    let alive = true
    setIsAppLoading(true)
    void (async () => {
      try {
        if (!supabase) {
          if (alive) setCloudOnboarded(null)
          return
        }
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        if (!data.session) {
          if (alive) setCloudOnboarded(null)
          return
        }
        const row = await fetchProfile()
        if (!alive) return
        setCloudOnboarded(!!row?.onboarding_completed)
      } catch (error) {
        if (alive) {
          console.error('Failed to initialize app session', error)
          setCloudOnboarded(null)
        }
      } finally {
        if (alive) setIsAppLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user?.id])

  if (isLoading) return <Splash showResetHint />
  if (!user) {
    if (loc.pathname !== '/auth') return <Navigate to="/auth" replace />
    return <AuthPage />
  }
  if (loc.pathname === '/auth') return <Navigate to="/" replace />
  if (!(cloudOnboarded || settings.onboarded)) return <OnboardingPage />
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/ai" element={<AIChatPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/record" element={<RecorderPage />} />
          <Route path="/record/live" element={<LiveRecordPage />} />
          <Route path="/record/:id" element={<RecordingDetailPage />} />
          <Route path="/cards" element={<FlashcardsPage />} />
          <Route path="/cards/:deckId" element={<DeckPage />} />
          <Route path="/cards/:deckId/study" element={<StudyPage />} />
          <Route path="/cards/:deckId/test" element={<TestPage />} />
          <Route path="/cards/:deckId/game/choice" element={<ChoiceGamePage />} />
          <Route path="/cards/:deckId/game/match" element={<MatchGamePage />} />
          <Route path="/cards/:deckId/game/write" element={<WriteGamePage />} />
          <Route path="/cards/:deckId/game/listen" element={<ListenGamePage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/notes" element={<NotebookPage />} />
          <Route path="/notes/new" element={<NoteEditorPage />} />
          <Route path="/notes/:id" element={<NoteReadPage />} />
          <Route path="/notes/:id/edit" element={<NoteEditorPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/motivate" element={<MotivateMePage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/habits/:id" element={<HabitDetailsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppBackground />
        <BrowserRouter>
          <NativeBack />
          <CardReminders />
          <Gate />
        </BrowserRouter>
      </StoreProvider>
    </AuthProvider>
  )
}
