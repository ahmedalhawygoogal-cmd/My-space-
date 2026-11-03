import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ear, Layers, LayoutGrid, Pencil, PenLine, Plus, Trash2, Volume2 } from 'lucide-react'
import { useStore } from '../store'
import { Confirm, Empty, Sheet, useT } from '../ui'
import type { ReactNode } from 'react'
import type { Card, Lang } from '../types'
import { LEARN_LANGS } from '../types'
import { fileToDataUrl, normalizeAnswer, shuffle, speakText } from '../utils'

function langLabel(code: string, ui: Lang) {
  const row = LEARN_LANGS.find((l) => l.code === code)
  if (!row) return code
  return ui === 'ar' ? row.ar : row.en
}

function ListenAuto({ text, lang, repeats, round }: { text: string; lang: string; repeats: number; round: number }) {
  useEffect(() => {
    speakText(text, lang, repeats)
  }, [text, lang, repeats, round])
  return null
}

function SpeakBtn({ text, lang }: { text: string; lang: string }) {
  const tr = useT()
  const { settings } = useStore()
  const ok = typeof window !== 'undefined' && 'speechSynthesis' in window
  return (
    <button
      className="icon-btn"
      type="button"
      disabled={!ok || !text.trim()}
      aria-label={tr('speak')}
      onClick={() => speakText(text, lang, settings.speakRepeats ?? 1)}
    >
      <Volume2 size={16} />
    </button>
  )
}

type CardFormState = {
  front: string
  back: string
  example: string
  exampleTranslation: string
  imageDataUrl: string
}

const emptyForm: CardFormState = { front: '', back: '', example: '', exampleTranslation: '', imageDataUrl: '' }

function CardForm({ form, setForm }: { form: CardFormState; setForm: (f: CardFormState) => void }) {
  const tr = useT()
  return (
    <div className="stack">
      <label className="label">{tr('nativeWord')}</label>
      <input className="field" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} />
      <label className="label">{tr('targetWord')}</label>
      <input className="field" value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} />
      <label className="label">
        {tr('exampleSentence')} · {tr('optional')}
      </label>
      <input className="field" value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} />
      <label className="label">
        {tr('exampleTranslation')} · {tr('optional')}
      </label>
      <input
        className="field"
        value={form.exampleTranslation}
        onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })}
      />
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
          <img src={form.imageDataUrl} alt="" style={{ borderRadius: 12, maxHeight: 140, objectFit: 'cover' }} />
          <button className="btn ghost" type="button" onClick={() => setForm({ ...form, imageDataUrl: '' })}>
            {tr('removeImage')}
          </button>
        </>
      ) : null}
    </div>
  )
}

export default function FlashcardsPage() {
  const tr = useT()
  const { decks, cards, addDeck, lang } = useStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [nativeLang, setNativeLang] = useState('ar')
  const [targetLang, setTargetLang] = useState('en')

  return (
    <div className="stack">
      <h1 className="page-title">{tr('flashcards')}</h1>
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
          return (
            <Link key={d.id} className="list-item pressable" to={`/cards/${d.id}`}>
              <div className="dot" style={{ background: 'var(--brand)' }} />
              <div className="grow">
                <div className="ellipsis">{d.name}</div>
                <div className="meta">
                  {langLabel(d.nativeLang, lang)} → {langLabel(d.targetLang, lang)} · {dc.length} {tr('cards')}
                </div>
              </div>
            </Link>
          )
        })
      )}
      <button className="fab" type="button" onClick={() => setOpen(true)} aria-label={tr('newDeck')}>
        <Plus size={22} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={tr('newDeck')}>
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
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!name.trim()) return
            await addDeck(name.trim(), { nativeLang, targetLang })
            setName('')
            setOpen(false)
          }}
        >
          {tr('create')}
        </button>
      </Sheet>
    </div>
  )
}

export function DeckPage() {
  const tr = useT()
  const nav = useNavigate()
  const { deckId } = useParams()
  const { decks, cards, updateDeck, deleteDeck, addCard, updateCard, deleteCard, lang } = useStore()
  const deck = decks.find((d) => d.id === deckId)
  const dc = cards.filter((c) => c.deckId === deckId)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Card | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [form, setForm] = useState<CardFormState>(emptyForm)
  const shown = dc.filter((c) => {
    if (!q.trim()) return true
    const n = q.toLowerCase()
    return [c.front, c.back, c.example, c.exampleTranslation].some((x) => x.toLowerCase().includes(n))
  })

  if (!deck) return <Empty icon={<Layers />} title={tr('noDecks')} />

  return (
    <div className="stack">
      <input className="note-title" value={deck.name} onChange={(e) => void updateDeck(deck.id, { name: e.target.value })} />
      <div className="muted">
        {langLabel(deck.nativeLang, lang)} → {langLabel(deck.targetLang, lang)}
      </div>
      <div className="grid-2">
        <GameLink to={`/cards/${deck.id}/game/choice`} icon={<LayoutGrid size={16} />} label={tr('gameChoice')} />
        <GameLink to={`/cards/${deck.id}/game/match`} icon={<Layers size={16} />} label={tr('gameMatch')} />
        <GameLink to={`/cards/${deck.id}/game/write`} icon={<PenLine size={16} />} label={tr('gameWrite')} />
        <GameLink to={`/cards/${deck.id}/game/listen`} icon={<Ear size={16} />} label={tr('gameListen')} />
      </div>
      <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('search')} />
      {dc.length === 0 ? (
        <Empty
          icon={<Layers size={32} />}
          title={tr('emptyDeck')}
          hint={tr('emptyDeckHint')}
          action={
            <button className="btn" type="button" onClick={() => { setForm(emptyForm); setOpen(true) }}>
              {tr('addFlashcard')}
            </button>
          }
        />
      ) : (
        shown.map((c) => (
          <div key={c.id} className="list-item">
            {c.imageDataUrl ? (
              <img src={c.imageDataUrl} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
            ) : (
              <div className="dot" style={{ background: 'var(--brand)' }} />
            )}
            <div className="grow">
              <div className="ellipsis">{c.front}</div>
              <div className="meta ellipsis">{c.back}</div>
            </div>
            <SpeakBtn text={c.back} lang={deck.targetLang} />
            <button
              className="icon-btn"
              type="button"
              onClick={() => {
                setEdit(c)
                setForm({
                  front: c.front,
                  back: c.back,
                  example: c.example,
                  exampleTranslation: c.exampleTranslation,
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
      <button className="fab" type="button" onClick={() => { setForm(emptyForm); setOpen(true) }} aria-label={tr('newCard')}>
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
        <CardForm form={form} setForm={setForm} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!form.front.trim() || !form.back.trim()) return
            await addCard(deck.id, form)
            setForm(emptyForm)
            setOpen(false)
          }}
        >
          {tr('save')}
        </button>
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={tr('editCard')}>
        <CardForm form={form} setForm={setForm} />
        <button
          className="btn block"
          style={{ marginTop: 12 }}
          type="button"
          onClick={async () => {
            if (!edit || !form.front.trim() || !form.back.trim()) return
            await updateCard(edit.id, form)
            setEdit(null)
          }}
        >
          {tr('save')}
        </button>
      </Sheet>
    </div>
  )
}

function GameLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link className="card pressable" to={to} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="row">
        {icon}
        <b>{label}</b>
      </div>
    </Link>
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
        {pack.target.imageDataUrl ? <img src={pack.target.imageDataUrl} alt="" style={{ maxHeight: 100, margin: '0 auto', borderRadius: 12 }} /> : null}
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
        {card.imageDataUrl ? <img src={card.imageDataUrl} alt="" style={{ maxHeight: 100, margin: '0 auto', borderRadius: 12 }} /> : null}
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
        <button
          className="btn"
          type="button"
          onClick={() => speakText(pack.target.back, deck.targetLang, settings.speakRepeats ?? 1)}
        >
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
  const { deckId } = useParams()
  const nav = useNavigate()
  useEffect(() => {
    if (deckId) nav(`/cards/${deckId}/game/choice`, { replace: true })
  }, [deckId, nav])
  return null
}

export function TestPage() {
  const { deckId } = useParams()
  const nav = useNavigate()
  useEffect(() => {
    if (deckId) nav(`/cards/${deckId}/game/write`, { replace: true })
  }, [deckId, nav])
  return null
}
