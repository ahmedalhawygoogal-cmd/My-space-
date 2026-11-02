import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout, Splash } from './layout'
import { StoreProvider, useStore } from './store'
import HomePage from './pages/Home'
import RecorderPage, { LiveRecordPage, RecordingDetailPage } from './pages/Recorder'
import FlashcardsPage, { DeckPage, StudyPage, TestPage } from './pages/Flashcards'
import TasksPage, { TaskDetailPage } from './pages/Tasks'
import NotebookPage, { NoteEditorPage } from './pages/Notebook'
import SearchPage from './pages/Search'
import SettingsPage from './pages/Settings'

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
        <Gate />
      </BrowserRouter>
    </StoreProvider>
  )
}
