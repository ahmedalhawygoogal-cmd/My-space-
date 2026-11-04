import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Splash } from './layout'
import { StoreProvider, useStore } from './store'
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
import NotebookPage, { NoteEditorPage } from './pages/Notebook'
import SearchPage from './pages/Search'
import SettingsPage from './pages/Settings'
import { getNative, parseReminderTime } from './native'
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
      const items = decks.flatMap((d, i) => {
        const time = parseReminderTime(d.reminderTime)
        if (!time) return []
        const due = cards.filter((c) => c.deckId === d.id && c.dueAt <= Date.now()).length
        if (due <= 0) return []
        return [
          {
            id: 2000 + i,
            title: t(settings.language, 'reminderTitle'),
            body: t(settings.language, 'reminderBody', { n: due, name: d.name }),
            hour: time.hour,
            minute: time.minute,
            path: `/cards/${d.id}`,
          },
        ]
      })
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
  const { ready } = useStore()
  if (!ready) return <Splash />
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
        <Route path="/notes/:id" element={<NoteEditorPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <NativeBack />
        <CardReminders />
        <Gate />
      </BrowserRouter>
    </StoreProvider>
  )
}
