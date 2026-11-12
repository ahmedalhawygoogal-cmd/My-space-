import { useEffect, useState } from 'react'

export type BackgroundChoice = 'bg1' | 'bg2' | 'bg3' | 'none'

export const BACKGROUND_STORAGE_KEY = 'myspace-selected-background'
export const BACKGROUND_OPTIONS: Array<{ id: Exclude<BackgroundChoice, 'none'>; label: string; image: string }> = [
  {
    id: 'bg1',
    label: 'خلفية هادئة',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1794503636446-ssCymYQG3b516wom1ms49WpKUk2fxa.jpg',
  },
  {
    id: 'bg2',
    label: 'خلفية هندسية',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/e7b4b140-debd-11f1-a498-6da443c2f8c3-PVj6gKyX7Lb2ku80biomTnRfxV8X8q.png',
  },
  {
    id: 'bg3',
    label: 'خلفية انسيابية',
    image: 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/951a25a0-debd-11f1-a498-6da443c2f8c3-v6FRdbkkD8RMH5INIjTcuuPSB7Nwhj.png',
  },
]

const BACKGROUND_CHANGE_EVENT = 'myspace-background-change'

export function getSelectedBackground(): BackgroundChoice {
  try {
    const value = localStorage.getItem(BACKGROUND_STORAGE_KEY)
    return value === 'bg1' || value === 'bg2' || value === 'bg3' ? value : 'none'
  } catch {
    return 'none'
  }
}

export function setSelectedBackground(value: BackgroundChoice) {
  try {
    if (value === 'none') localStorage.removeItem(BACKGROUND_STORAGE_KEY)
    else localStorage.setItem(BACKGROUND_STORAGE_KEY, value)
  } catch {
    // Keep the in-memory preference usable when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(BACKGROUND_CHANGE_EVENT))
}

export default function AppBackground() {
  const [selectedBackground, setSelectedBackgroundState] = useState<BackgroundChoice>(getSelectedBackground)
  const selectedOption = BACKGROUND_OPTIONS.find((option) => option.id === selectedBackground)

  useEffect(() => {
    const syncBackground = () => setSelectedBackgroundState(getSelectedBackground())
    window.addEventListener(BACKGROUND_CHANGE_EVENT, syncBackground)
    window.addEventListener('storage', syncBackground)
    return () => {
      window.removeEventListener(BACKGROUND_CHANGE_EVENT, syncBackground)
      window.removeEventListener('storage', syncBackground)
    }
  }, [])

  useEffect(() => {
    if (selectedOption) document.documentElement.dataset.selectedBackground = selectedOption.id
    else delete document.documentElement.dataset.selectedBackground
    return () => {
      delete document.documentElement.dataset.selectedBackground
    }
  }, [selectedOption])

  if (!selectedOption) return null

  return (
    <div className="app-background" aria-hidden="true">
      <img className="app-background-image" src={selectedOption.image} alt="" />
      <div className="app-background-tint" />
      <div className="app-background-wash" />
    </div>
  )
}
