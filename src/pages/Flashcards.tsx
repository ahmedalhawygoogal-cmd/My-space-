import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bell, Ear, Layers, LayoutGrid, Pencil, PenLine, Play, Plus, Trash2, Volume2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, Toast, useT } from '../ui'
import type { ReactNode } from 'react'
import type { AppSettings, Card, Deck, DeckType, Lang } from '../types'
import { DECK_TYPES, LEARN_LANGS, NATIVE_LANG_OPTS, TARGET_LANG_OPTS, isRichDeck } from '../types'
import { fileToDataUrl, normalizeAnswer, shuffle, speakText } from '../utils'

function langLabel(code: string, ui: Lang, custom?: string) {
  if (code === 'other') return custom?.trim() || (ui === 'ar' ? 'أخرى' : 'Other')
  const native = NATIVE_LANG_OPTS.find((l) => l.code === code)
  if (native) return ui === 'ar' ? native.ar : native.en
  const target = TARGET_LANG_OPTS.find((l) => l.code === code)
  if (target) return ui === 'ar' ? target.ar : target.en
  const row = LEARN_LANGS.find((l) => l.code === code)
  if (!row) return custom?.trim() || code
  return ui === 'ar' ? row.ar : row.en
}

function nativeName(settings: AppSettings, ui: Lang) {
  return langLabel(settings.nativeLang || 'ar', ui, settings.nativeLangOther)
}

function targetName(settings: AppSettings, ui: Lang, deck?: Deck) {
  const code = deck?.targetLang || settings.targetLangs?.[0] || 'en'
  const custom = code === 'other' ? settings.targetLangOther : undefined
  return langLabel(code, ui, custom)
}

function typeLabel(type: DeckType, tr: (k: 'typeVocabulary' | 'typePhrases' | 'typeSynonyms' | 'typeDefinitions' | 'typeAntonyms') => string) {
  if (type === 'phrases') return tr('typePhrases')
  if (type === 'synonyms') return tr('typeSynonyms')
  if (type === 'definitions') return tr('typeDefinitions')
  if (type === 'antonyms') return tr('typeAntonyms')
  return tr('typeVocabulary')
}

function ListenAuto({ text, lang, repeats, round }: { text: string; lang: string; repeats: number; round: number }) {
  useEffect(() => {
    speakText(text, lang, repeats)
  }, [text, lang, repeats, round])
  return null
}

function SpeakBtn({ card, targetLang }: { card: Card; targetLang: string }) {
  const tr = useT()
  const { settings } = useStore()
  const targetWord = card.back
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window
  return (
    <button
      className="icon-btn"
      type="button"
      disabled={!ok || !targetWord.trim()}
      aria-label={tr('speak')}
      onClick={() => speakText(targetWord, targetLang, settings.speakRepeats ?? 1)}
    >
      <Volume2 size={16} />
    </button>
  )
}

type CardFormState = {
  front: string
  back: string
  example: string
  note: string
  imageDataUrl: string
}

const emptyForm: CardFormState = { front: '', back: '', example: '', note: '', imageDataUrl: '' }

function CardForm({
  form,
  setForm,
  rich,
  frontLabel,
  backLabel,
}: {
  form: CardFormState
  setForm: (f: CardFormState) => void
  rich: boolean
  frontLabel: string
  backLabel: string
}) {
  const tr = useT()
  return (
    <div className="stack">
      <label className="label">{frontLabel}</label>
      <input className="field" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} />
      <label className="label">{backLabel}</label>
      <input className="field" value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} />
      {rich ? (
        <>
          <label className="label">
            {tr('exampleSentence')} · {tr('optional')}
          </label>
          <input className="field" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
        </>
      ) : null}
      <label className="label">
        {tr('cardNote')} · {tr('optional')}
      </label>
      <input className="field" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      {rich ? (
        <>
          <label className="label">
            {tr('image')} · {tr('optional')}
          </label>
          <input
            className="field"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setForm({ ...form, imageDataUrl: await fileToDataUrl(f) })
            }}
          />
          {form.imageDataUrl ? (
            <>
              <img src={form.imageDataUrl} alt="" className="fc-thumb" />
              <button className="btn ghost" type="button" onClick={() => setForm({ ...form, imageDataUrl: '' })}>
                {tr('removeImage')}
              </button>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function PlayRing({ due, total, onClick, label }: { due: number; total: number; onClick: () => void; label: string }) {
  const r = 18
  const c = 2 * Math.PI * r
  const v = total ? Math.max(0, Math.min(100, ((total - due) / total) * 100)) : 0
  return (
    <button className="fc-play" type="button" onClick={onClick} aria-label={label}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(199,169,107,0.22)" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="#C7A96B"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="fc-play-icon">
        <Play size={16} fill="currentColor" />
      </span>
    </button>
  )
}

export default function FlashcardsPage() {
  const tr = useT()
  const { decks, cards, addDeck, updateDeck, lang, settings } = useStore()
  const [open, setOpen] = useState(false)
  const [unify, setUnify] = useState(false)
  const [games, setGames] = useState<Deck | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<DeckType>('vocabulary')
  const [nativeLang, setNativeLang] = useState(settings.nativeLang || 'ar')
  const [targetLang, setTargetLang] = useState(settings.targetLangs?.[0] || 'en')
  const [reminderTime, setReminderTime] = useState('09:00')
  const [unifyTime, setUnifyTime] = useState('09:00')

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title" style={{ margin: 0 }}>
          {tr('flashcards')}
        </h1>
        {decks.length > 0 ? (
          <button className="chip" type="button" onClick={() => setUnify(true)}>
            <Bell size={14} /> {tr('unifiedReminder')}
          </button>
        ) : null}
      </div>
      {decks.length === 0 ? (
        <Empty
          icon={<Layers size={36} />}
          title={tr('noDecks')}
          hint={tr('noCardsHint')}
          action={
            <button className="btn" type="button" onClick={() => setOpen(true)}>
              {tr('createDeck')}
            </button>
          }
        />
      ) : (
        decks.map((d) => {
          const dc = cards.filter((c) => c.deckId === d.id)
          const due = dc.filter((c) => (c.nextReviewDate || c.dueAt) <= Date.now()).length
          return (
            <div key={d.id} className="fc-deck">
              <Link className="fc-deck-body" to={`/cards/${d.id}`}>
                <div>
                  <div className="ellipsis">{d.name}</div>
                  <div className="meta">
                    {typeLabel(d.type || 'vocabulary', tr)} · {langLabel(d.nativeLang, lang, settings.nativeLangOther)} →{' '}
                    {langLabel(d.targetLang, lang, settings.targetLangOther)}
                  </div>
                  <div className="meta">
                    {dc.length} {tr('cards')}
                    {due ? ` · ${due} ${tr('dueNow')}` : ''}
                  </div>
                </div>
              </Link>
              <PlayRing due={due} total={dc.length} label={tr('playDeck')} onClick={() => setGames(d)} />
            </div>
          )
        })
      )}
      <button className="fab" type="button" onClick={() => setOpen(true)} aria-label={tr('newDeck')}>
        <Plus size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newDeck')}>
        <label className="label">{tr('deckType')}</label>
        <select className="field" value={type} onChange={(e) => setType(e.target.value as DeckType)}>
          {DECK_TYPES.map((id) => (
            <option key={id} value={id}>
              {typeLabel(id, tr)}
            </option>
          ))}
        </select>
        <label className="label">{tr('nativeLang')}</label>
        <select className="field" value={nativeLang} onChange={(e) => setNativeLang(e.target.value)}>
          {LEARN_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {langLabel(l.code, lang)}
            </option>
          ))}
        </select>
        <label className="label">{tr('targetLang')}</label>
        <select className="field" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          {LEARN_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {langLabel(l.code, lang)}
            </option>
          ))}
        </select>
        <label className="label">{tr('deckName')}</label>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">{tr('deckReminder')}</label>
        <input className="field" type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!name.trim()) return
            await addDeck(name.trim(), { nativeLang, targetLang, reminderTime, type })
            setName('')
            setOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
      <Sheet open={unify} onClose={() => setUnify(false)} title={tr('unifiedReminder')}>
        <label className="label">{tr('reminderTime')}</label>
        <input className="field" type="time" value={unifyTime} onChange={(e) => setUnifyTime(e.target.value)} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            await Promise.all(decks.map((d) => updateDeck(d.id, { reminderTime: unifyTime })))
            setUnify(false)
          }}
        >
          {tr('applyAllDecks')}
        </button>
      </Sheet>
      <Sheet open={!!games} onClose={() => setGames(null)} title={tr('games')}>
        {games ? (
          <div className="stack">
            <Link className="list-item pressable" to={`/cards/${games.id}/study`} onClick={() => setGames(null)}>
              <Layers size={16} />
              <div className="grow">{tr('review')}</div>
            </Link>
            <Link className="list-item pressable" to={`/cards/${games.id}/game/choice`} onClick={() => setGames(null)}>
              <LayoutGrid size={16} />
              <div className="grow">{tr('gameChoice')}</div>
            </Link>
            <Link className="list-item pressable" to={`/cards/${games.id}/game/match`} onClick={() => setGames(null)}>
              <Layers size={16} />
              <div className="grow">{tr('gameMatch')}</div>
            </Link>
            <Link className="list-item pressable" to={`/cards/${games.id}/game/write`} onClick={() => setGames(null)}>
              <PenLine size={16} />
              <div className="grow">{tr('gameWrite')}</div>
            </Link>
            <Link className="list-item pressable" to={`/cards/${games.id}/game/listen`} onClick={() => setGames(null)}>
              <Ear size={16} />
              <div className="grow">{tr('gameListen')}</div>
            </Link>
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}

export function DeckPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deckId } = useParams()
  const { decks, cards, updateDeck, deleteDeck, addCard, updateCard, deleteCard, lang, settings } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const dc = cards.filter((c) => c.deckId === deckId)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Card | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [games, setGames] = useState(false)
  const [form, setForm] = useState<CardFormState>(emptyForm)
  const rich = isRichDeck(deck?.type)
  const frontLabel = nativeName(settings, lang)
  const backLabel = targetName(settings, lang, deck)
  const shown = dc.filter((c) => {
    if (!q.trim()) return true
    const n = q.toLowerCase()
    return [c.front, c.back, c.example, c.note].some((x) => x.toLowerCase().includes(n))
  })

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />

  return (
    <div className="stack">
      <input className="note-title" value={deck.name} onChange={(e) => void updateDeck(deck.id, { name: e.target.value })} />
      <div className="muted">
        {typeLabel(deck.type || 'vocabulary', tr)} · {langLabel(deck.nativeLang, lang, settings.nativeLangOther)} →{' '}
        {langLabel(deck.targetLang, lang, settings.targetLangOther)}
      </div>
      <label className="label">{tr('deckType')}</label>
      <select className="field" value={deck.type || 'vocabulary'} onChange={(e) => void updateDeck(deck.id, { type: e.target.value as DeckType })}>
        {DECK_TYPES.map((id) => (
          <option key={id} value={id}>
            {typeLabel(id, tr)}
          </option>
        ))}
      </select>
      <label className="label">{tr('deckReminder')}</label>
      <input
        className="field"
        type="time"
        value={deck.reminderTime || ''}
        onChange={(e) => void updateDeck(deck.id, { reminderTime: e.target.value || undefined })}
      />
      <button className="btn block" type="button" onClick={() => setGames(true)}>
        <Play size={16} /> {tr('playDeck')}
      </button>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('search')} />
      {dc.length === 0 ? (
        <Empty
          icon={<Layers size={32} />}
          title={tr('emptyDeck')}
          hint={tr('emptyDeckHint')}
          action={
            <button
              className="btn"
              type="button"
              onClick={() => {
                setForm(emptyForm)
                setOpen(true)
              }}
            >
              {tr('addFlashcard')}
            </button>
          }
        />
      ) : (
        shown.map((c) => (
          <div key={c.id} className="list-item">
            {c.imageDataUrl ? (
              <img src={c.imageDataUrl} alt="" className="fc-mini" />
            ) : (
              <div className="dot" style={{ background: 'var(--brand)' }} />
            )}
            <div className="grow">
              <div className="ellipsis">{c.front}</div>
              <div className="meta ellipsis">{c.back}</div>
            </div>
            <SpeakBtn card={c} targetLang={deck.targetLang} />
            <button
              className="icon-btn"
              type="button"
              onClick={() => {
                setEdit(c)
                setForm({
                  front: c.front,
                  back: c.back,
                  example: c.example,
                  note: c.note,
                  imageDataUrl: c.imageDataUrl ?? '',
                })
              }}
              aria-label={tr('edit')}
            >
              <Pencil size={16} />
            </button>
            <button className="icon-btn" type="button" onClick={() => void deleteCard(c.id)} aria-label={tr('delete')}>
              <Trash2 size={16} />
            </button>
          </div>
        ))
      )}
      <button className="btn danger block" type="button" onClick={() => setConfirm(true)}>
        {tr('delete')}
      </button>
      <button
        className="fab"
        type="button"
        onClick={() => {
          setForm(emptyForm)
          setOpen(true)
        }}
        aria-label={tr('newCard')}
      >
        <Plus size={22} />
      </button>
      <Confirm
        open={confirm}
        title={tr('deleteDeckConfirm')}
        danger
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await deleteDeck(deck.id)
          nav('/cards')
        }}
      />
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newCard')}>
        <CardForm form={form} setForm={setForm} rich={rich} frontLabel={frontLabel} backLabel={backLabel} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!form.front.trim() || !form.back.trim()) return
            await addCard(deck.id, rich ? form : { ...form, example: '', imageDataUrl: undefined })
            setForm(emptyForm)
            setOpen(false)
          }}
        >
          {tr('save')}
        </button>
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={tr('editCard')}>
        <CardForm form={form} setForm={setForm} rich={rich} frontLabel={frontLabel} backLabel={backLabel} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!edit || !form.front.trim() || !form.back.trim()) return
            await updateCard(edit.id, rich ? form : { ...form, example: '', imageDataUrl: undefined })
            setEdit(null)
          }}
        >
          {tr('save')}
        </button>
      </Sheet>
      <Sheet open={games} onClose={() => setGames(false)} title={tr('games')}>
        <div className="stack">
          <Link className="list-item pressable" to={`/cards/${deck.id}/study`} onClick={() => setGames(false)}>
            <Layers size={16} />
            <div className="grow">{tr('review')}</div>
          </Link>
          <Link className="list-item pressable" to={`/cards/${deck.id}/game/choice`} onClick={() => setGames(false)}>
            <LayoutGrid size={16} />
            <div className="grow">{tr('gameChoice')}</div>
          </Link>
          <Link className="list-item pressable" to={`/cards/${deck.id}/game/match`} onClick={() => setGames(false)}>
            <Layers size={16} />
            <div className="grow">{tr('gameMatch')}</div>
          </Link>
          <Link className="list-item pressable" to={`/cards/${deck.id}/game/write`} onClick={() => setGames(false)}>
            <PenLine size={16} />
            <div className="grow">{tr('gameWrite')}</div>
          </Link>
          <Link className="list-item pressable" to={`/cards/${deck.id}/game/listen`} onClick={() => setGames(false)}>
            <Ear size={16} />
            <div className="grow">{tr('gameListen')}</div>
          </Link>
        </div>
      </Sheet>
    </div>
  )
}

function NeedCards({ n, deckId }: { n: number; deckId: string }) {
  const tr = useT()
  const nav = useNavigate()
  return (
    <Empty
      icon={<Layers size={36} />}
      title={tr('needMoreCards')}
      hint={tr('needCardsForGame', { n })}
      action={
        <button className="btn" type="button" onClick={() => nav(`/cards/${deckId}`)}>
          {tr('addFlashcard')}
        </button>
      }
    />
  )
}

function GameShell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  const nav = useNavigate()
  const tr = useT()
  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button className="chip" type="button" onClick={() => nav(-1)}>
          {tr('back')}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {hint}
      </p>
      {children}
    </div>
  )
}

function HintImage({ src }: { src?: string }) {
  if (!src) return null
  return <img src={src} alt="" className="fc-hint" />
}

function useDeckCards() {
  const { deckId } = useParams()
  const { decks, cards } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const dc = cards.filter((c) => c.deckId === deckId && c.front.trim() && c.back.trim())
  return { deckId: deckId ?? '', deck, dc }
}

export function ChoiceGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer } = useStore()
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const pack = useMemo(() => {
    const { deck: d, dc: cards, pickCards: pick } = live.current
    if (!d || cards.length < 4) return null
    const [target] = pick(d.id, 1)
    if (!target) return null
    const others = shuffle(cards.filter((c) => c.id !== target.id)).slice(0, 3)
    return { target, options: shuffle([target, ...others]) }
  }, [round, deckId])

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 4) return <NeedCards n={4} deckId={deckId} />
  if (!pack) return <NeedCards n={4} deckId={deckId} />

  return (
    <GameShell title={tr('gameChoice')} hint={tr('gameChoiceHint')}>
      <div className="flash-card">
        <HintImage src={pack.target.imageDataUrl} />
        <h2>{pack.target.front}</h2>
      </div>
      <div className="stack">
        {pack.options.map((o) => {
          const cls = picked ? (o.id === pack.target.id ? 'choice ok' : o.id === picked ? 'choice bad' : 'choice') : 'choice'
          return (
            <button
              key={o.id}
              className={cls}
              type="button"
              disabled={!!picked}
              onClick={async () => {
                const ok = o.id === pack.target.id
                setPicked(o.id)
                await recordAnswer(pack.target.id, ok)
              }}
            >
              {o.imageDataUrl ? <img src={o.imageDataUrl} alt="" className="fc-opt" /> : null}
              {o.back}
            </button>
          )
        })}
      </div>
      {picked ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            setPicked(null)
            setRound((n) => n + 1)
          }}
        >
          {tr('next')}
        </button>
      ) : null}
    </GameShell>
  )
}

export function MatchGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer } = useStore()
  const [round, setRound] = useState(0)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const pack = useMemo(() => {
    const { deck: d, pickCards: pick } = live.current
    if (!d || live.current.dc.length < 4) return []
    return pick(d.id, 4)
  }, [round, deckId])
  const left = useMemo(() => shuffle(pack), [pack])
  const right = useMemo(() => shuffle(pack), [pack])
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 4) return <NeedCards n={4} deckId={deckId} />

  async function tryMatch(l: string | null, r: string | null) {
    if (!l || !r || busy) return
    setBusy(true)
    const ok = l === r
    await recordAnswer(l, ok)
    if (ok) setDone((d) => [...d, l])
    setSelL(null)
    setSelR(null)
    setBusy(false)
  }

  return (
    <GameShell title={tr('gameMatch')} hint={tr('gameMatchHint')}>
      <div className="match-grid">
        <div className="match-col">
          {left.map((c) => (
            <button
              key={`l-${c.id}`}
              className={`match-item ${selL === c.id ? 'sel' : ''} ${done.includes(c.id) ? 'done' : ''}`}
              type="button"
              disabled={done.includes(c.id)}
              onClick={() => {
                setSelL(c.id)
                void tryMatch(c.id, selR)
              }}
            >
              {c.imageDataUrl ? <img src={c.imageDataUrl} alt="" className="fc-opt" /> : null}
              {c.front}
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map((c) => (
            <button
              key={`r-${c.id}`}
              className={`match-item ${selR === c.id ? 'sel' : ''} ${done.includes(c.id) ? 'done' : ''}`}
              type="button"
              disabled={done.includes(c.id)}
              onClick={() => {
                setSelR(c.id)
                void tryMatch(selL, c.id)
              }}
            >
              {c.back}
            </button>
          ))}
        </div>
      </div>
      {done.length === pack.length && pack.length > 0 ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            setDone([])
            setRound((n) => n + 1)
          }}
        >
          {tr('next')}
        </button>
      ) : null}
    </GameShell>
  )
}

export function WriteGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer } = useStore()
  const [round, setRound] = useState(0)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<'ok' | 'bad' | null>(null)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const card = useMemo(() => {
    const { deck: d, pickCards: pick } = live.current
    return d && live.current.dc.length ? pick(d.id, 1)[0] : undefined
  }, [round, deckId])

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 1) return <NeedCards n={1} deckId={deckId} />
  if (!card) return <NeedCards n={1} deckId={deckId} />

  return (
    <GameShell title={tr('gameWrite')} hint={tr('gameWriteHint')}>
      <div className="flash-card">
        <HintImage src={card.imageDataUrl} />
        <h2>{card.front}</h2>
      </div>
      <input
        className="field"
        value={value}
        placeholder={tr('typeAnswer')}
        disabled={!!result}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !result) {
            e.preventDefault()
            void (async () => {
              const ok = normalizeAnswer(value) === normalizeAnswer(card.back)
              setResult(ok ? 'ok' : 'bad')
              await recordAnswer(card.id, ok)
            })()
          }
        }}
      />
      {!result ? (
        <button
          className="btn block"
          type="button"
          onClick={async () => {
            const ok = normalizeAnswer(value) === normalizeAnswer(card.back)
            setResult(ok ? 'ok' : 'bad')
            await recordAnswer(card.id, ok)
          }}
        >
          {tr('check')}
        </button>
      ) : (
        <>
          <div className={result === 'ok' ? 'choice ok' : 'choice bad'}>{result === 'ok' ? tr('correct') : `${tr('wrong')}: ${card.back}`}</div>
          <button
            className="btn block"
            type="button"
            onClick={() => {
              setValue('')
              setResult(null)
              setRound((n) => n + 1)
            }}
          >
            {tr('next')}
          </button>
        </>
      )}
    </GameShell>
  )
}

export function ListenGamePage() {
  const tr = useT()
  const { deck, dc, deckId } = useDeckCards()
  const { pickCards, recordAnswer, settings } = useStore()
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const live = useRef({ deck, dc, pickCards })
  live.current = { deck, dc, pickCards }
  const pack = useMemo(() => {
    const { deck: d, dc: cards, pickCards: pick } = live.current
    if (!d || cards.length < 4) return null
    const [target] = pick(d.id, 1)
    if (!target) return null
    const others = shuffle(cards.filter((c) => c.id !== target.id)).slice(0, 3)
    return { target, options: shuffle([target, ...others]) }
  }, [round, deckId])

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (dc.length < 4) return <NeedCards n={4} deckId={deckId} />
  if (!pack) return <NeedCards n={4} deckId={deckId} />

  return (
    <GameShell title={tr('gameListen')} hint={tr('gameListenHint')}>
      <ListenAuto text={pack.target.back} lang={deck.targetLang} repeats={settings.speakRepeats ?? 1} round={round} />
      <div className="flash-card">
        <HintImage src={pack.target.imageDataUrl} />
        <button className="btn" type="button" onClick={() => speakText(pack.target.back, deck.targetLang, settings.speakRepeats ?? 1)}>
          <Volume2 size={18} /> {tr('speak')}
        </button>
        {typeof window === 'undefined' || !('speechSynthesis' in window) ? <div className="muted">{tr('noSpeech')}</div> : null}
      </div>
      <div className="stack">
        {pack.options.map((o) => {
          const cls = picked ? (o.id === pack.target.id ? 'choice ok' : o.id === picked ? 'choice bad' : 'choice') : 'choice'
          return (
            <button
              key={o.id}
              className={cls}
              type="button"
              disabled={!!picked}
              onClick={async () => {
                const ok = o.id === pack.target.id
                setPicked(o.id)
                await recordAnswer(pack.target.id, ok)
              }}
            >
              {o.imageDataUrl ? <img src={o.imageDataUrl} alt="" className="fc-opt" /> : null}
              {o.front}
            </button>
          )
        })}
      </div>
      {picked ? (
        <button
          className="btn block"
          type="button"
          onClick={() => {
            setPicked(null)
            setRound((n) => n + 1)
          }}
        >
          {tr('next')}
        </button>
      ) : null}
    </GameShell>
  )
}

export function StudyPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deck, dc, deckId } = useDeckCards()
  const { rateCard } = useStore()
  const due = useMemo(
    () => dc.filter((c) => (c.nextReviewDate || c.dueAt) <= Date.now()).sort((a, b) => (a.nextReviewDate || a.dueAt) - (b.nextReviewDate || b.dueAt)),
    [dc],
  )
  const [flipped, setFlipped] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const card = due[0]

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />
  if (!card) {
    return (
      <Empty
        icon={<Layers size={36} />}
        title={tr('noDueCards')}
        action={
          <button className="btn" type="button" onClick={() => nav(`/cards/${deckId}`)}>
            {tr('back')}
          </button>
        }
      />
    )
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1 className="page-title" style={{ margin: 0 }}>
          {tr('review')}
        </h1>
        <button className="chip" type="button" onClick={() => nav(-1)}>
          {tr('back')}
        </button>
      </div>
      <div className="muted">
        {due.length} {tr('remaining')}
      </div>
      <div className="flash-card fc-review">
        {card.imageDataUrl ? <img src={card.imageDataUrl} alt="" className="fc-hint" /> : null}
        <h2>{flipped ? card.back : card.front}</h2>
        {flipped && card.example ? <p className="muted">{card.example}</p> : null}
        {flipped && card.note ? <p className="muted">{card.note}</p> : null}
      </div>
      {!flipped ? (
        <button className="btn block" type="button" onClick={() => setFlipped(true)}>
          {tr('flip')}
        </button>
      ) : (
        <div className="grid-3">
          <button
            className="btn ghost"
            type="button"
            onClick={async () => {
              await rateCard(card.id, 'hard')
              setToast(tr('reviewed'))
              setFlipped(false)
            }}
          >
            {tr('rateHard')}
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={async () => {
              await rateCard(card.id, 'good')
              setToast(tr('reviewed'))
              setFlipped(false)
            }}
          >
            {tr('rateGood')}
          </button>
          <button
            className="btn"
            type="button"
            onClick={async () => {
              await rateCard(card.id, 'easy')
              setToast(tr('reviewed'))
              setFlipped(false)
            }}
          >
            {tr('rateEasy')}
          </button>
        </div>
      )}
      <Toast text={toast} onDone={() => setToast(null)} />
    </div>
  )
}

export function TestPage() {
  const { deckId } = useParams()
  const nav = useNavigate()
  useEffect(() => {
    if (deckId) nav(`/cards/${deckId}/game/write`, { replace: true })
  }, [deckId, nav])
  return null
}
