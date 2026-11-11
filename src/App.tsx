import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout, Splash } from './layout'
import { StoreProvider, useStore } from './store'
import { AuthProvider, useAuth } from './auth'
import { supabase } from './lib/supabase'
import { fetchProfile } from './lib/profileSync'
import HomePage from './pages/Home'
import RecorderPage, { LiveRecordPage, RecordingDetailPage } from './pages/Recorder'
import FlashcardsPage, {
  ChoiceGamePage,
  DeckPage,
  ListenGamePage,
  MatchGamePage,
  StudyPage,
  TestPage,
  WriteGamePage,
} from './pages/Flashcards'
import TasksPage, { TaskDetailPage } from './pages/Tasks'
import NotebookPage, { NoteEditorPage, NoteReadPage } from './pages/Notebook'
import SearchPage from './pages/Search'
import SettingsPage from './pages/Settings'
import DownloadsPage from './pages/Downloads'
import OnboardingPage from './pages/Onboarding'
import MotivateMePage from './pages/MotivateMe'
import HabitsPage from './pages/Habits'
import AuthPage from './pages/Auth'
import { getNative } from './native'
import { t } from './i18n'

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

  useEffect(() => {
    let alive = true
    setIsAppLoading(true)
    void (async () => {
      try {
        if (!supabase) {
          if (alive) setCloudOnboarded(null)
          return
        }
        const { data } = await supabase.auth.getSession()
        if (!data.session) {
          if (alive) setCloudOnboarded(null)
          return
        }
        const row = await fetchProfile()
        if (!alive) return
        setCloudOnboarded(!!row?.onboarding_completed)
      } finally {
        if (alive) setIsAppLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user?.id])

  if (isAppLoading || !ready || loading) return <Splash />
  if (!user) {
    if (loc.pathname !== '/auth') return <Navigate to="/auth" replace />
    return <AuthPage />
  }
  if (loc.pathname === '/auth') return <Navigate to="/" replace />
  if (!(cloudOnboarded || settings.onboarded)) return <OnboardingPage />
  return (
    <Routes>
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
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <BrowserRouter>
          <NativeBack />
          <CardReminders />
          <Gate />
        </BrowserRouter>
      </StoreProvider>
    </AuthProvider>
  )
}
