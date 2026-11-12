import { useEffect, useState } from 'react'

export type BackgroundChoice = 'none' | 'bg1' | 'bg2' | 'bg3'

export const BACKGROUND_STORAGE_KEY = 'myspace-selected-background'
export const BACKGROUND_OPTIONS: Array<{ id: BackgroundChoice; label: string }> = [
  { id: 'none', label: 'الافتراضي' },
  { id: 'bg1', label: 'خلفية 1' },
  { id: 'bg2', label: 'خلفية 2' },
  { id: 'bg3', label: 'خلفية 3' },
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

type BackgroundArtworkProps = {
  variant: BackgroundChoice
  className: string
  idPrefix: string
}

export function BackgroundArtwork({ variant, className, idPrefix }: BackgroundArtworkProps) {
  if (variant === 'none') {
    return <div className={`${className} background-artwork-default`} aria-hidden="true" />
  }

  const safeId = idPrefix.replace(/[^a-zA-Z0-9_-]/g, '-')
  const paperId = `${safeId}-paper`
  const fieldId = `${safeId}-field`
  const flowId = `${safeId}-flow`

  return (
    <svg className={className} viewBox="0 0 100 160" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        {variant === 'bg1' ? (
          <>
            <linearGradient id={paperId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--bg-elev)" />
              <stop offset="0.58" stopColor="var(--bg)" />
              <stop offset="1" stopColor="var(--primary-color)" stopOpacity="0.14" />
            </linearGradient>
            <radialGradient id={fieldId} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="var(--primary-color)" stopOpacity="0.24" />
              <stop offset="1" stopColor="var(--primary-color)" stopOpacity="0" />
            </radialGradient>
          </>
        ) : null}
        {variant === 'bg2' ? (
          <linearGradient id={fieldId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--primary-color)" stopOpacity="0.82" />
            <stop offset="1" stopColor="var(--primary-color)" stopOpacity="0.24" />
          </linearGradient>
        ) : null}
        {variant === 'bg3' ? (
          <>
            <linearGradient id={flowId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="var(--primary-color)" stopOpacity="0.78" />
              <stop offset="0.54" stopColor="var(--primary-color)" stopOpacity="0.48" />
              <stop offset="1" stopColor="var(--bg-elev)" stopOpacity="0.76" />
            </linearGradient>
            <linearGradient id={fieldId} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--bg-elev)" stopOpacity="0.94" />
              <stop offset="0.56" stopColor="var(--primary-color)" stopOpacity="0.18" />
              <stop offset="1" stopColor="var(--primary-color)" stopOpacity="0.72" />
            </linearGradient>
          </>
        ) : null}
      </defs>
      <rect width="100" height="160" fill="var(--bg)" />
      {variant === 'bg1' ? (
        <>
          <rect width="100" height="160" fill={`url(#${paperId})`} />
          <circle cx="-8" cy="34" r="63" fill="var(--primary-color)" opacity="0.14" />
          <circle cx="13" cy="76" r="52" fill={`url(#${fieldId})`} />
          <circle cx="87" cy="39" r="48" fill="var(--bg-elev)" opacity="0.82" />
          <path d="M-12 94 C13 81 31 83 47 101 C66 123 60 147 35 170 L-12 170 Z" fill="var(--primary-color)" opacity="0.12" />
          <path d="M29 160 C46 134 65 127 82 139 C91 145 99 151 110 154 L110 170 L29 170 Z" fill="var(--bg-elev)" opacity="0.72" />
          <circle cx="80" cy="109" r="44" fill={`url(#${fieldId})`} opacity="0.72" />
        </>
      ) : null}
      {variant === 'bg2' ? (
        <>
          <rect x="0" y="0" width="25" height="160" fill={`url(#${fieldId})`} />
          <rect x="25" y="0" width="15" height="160" fill="var(--primary-color)" opacity="0.42" />
          <rect x="40" y="0" width="12" height="160" fill="var(--primary-color)" opacity="0.18" />
          <path d="M0 0 H37 V55 C37 76 25 89 0 94 Z" fill="var(--primary-color)" opacity="0.72" />
          <circle cx="87" cy="23" r="49" fill="var(--bg-elev)" opacity="0.9" />
          <path d="M31 38 C56 35 78 43 99 65 V92 C78 75 58 67 35 69 C18 70 6 78 0 87 V60 C8 48 18 41 31 38 Z" fill="var(--primary-color)" opacity="0.36" />
          <path d="M0 103 C21 91 42 95 57 110 C73 126 81 145 100 149 V170 H0 Z" fill="var(--primary-color)" opacity="0.3" />
          <path d="M-4 122 C20 110 36 114 50 129 C63 143 72 157 86 163 H-4 Z" fill="var(--bg-elev)" opacity="0.72" />
        </>
      ) : null}
      {variant === 'bg3' ? (
        <>
          <path d="M-12 6 C16 7 18 22 34 33 C51 45 71 40 112 62 L112 97 C76 79 56 91 36 75 C13 56 12 43 -12 39 Z" fill={`url(#${flowId})`} />
          <path d="M-12 41 C18 48 27 72 47 81 C68 91 81 81 112 102 L112 135 C82 115 59 129 37 112 C15 95 6 78 -12 75 Z" fill={`url(#${fieldId})`} />
          <path d="M-12 83 C15 91 27 117 48 127 C68 137 86 122 112 143 L112 170 H-12 Z" fill="var(--primary-color)" opacity="0.58" />
          <path d="M-12 20 C15 27 19 43 39 54 C60 65 79 60 112 81" fill="none" stroke="var(--bg-elev)" strokeOpacity="0.76" strokeWidth="2" />
          <path d="M-12 65 C13 72 22 90 43 101 C64 112 82 101 112 122" fill="none" stroke="var(--bg-elev)" strokeOpacity="0.64" strokeWidth="1.5" />
          <path d="M-12 108 C14 116 26 136 47 146 C67 155 83 142 112 160" fill="none" stroke="var(--bg-elev)" strokeOpacity="0.48" strokeWidth="1.2" />
        </>
      ) : null}
    </svg>
  )
}

export default function AppBackground() {
  const [selectedBackground, setSelectedBackgroundState] = useState<BackgroundChoice>(getSelectedBackground)

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
    if (selectedBackground !== 'none') document.documentElement.dataset.selectedBackground = selectedBackground
    else delete document.documentElement.dataset.selectedBackground
    return () => {
      delete document.documentElement.dataset.selectedBackground
    }
  }, [selectedBackground])

  if (selectedBackground === 'none') return null

  return (
    <div className="app-background fixed inset-0 -z-10 pointer-events-none" aria-hidden="true">
      <BackgroundArtwork variant={selectedBackground} className="app-background-artwork" idPrefix="app-background" />
    </div>
  )
}
