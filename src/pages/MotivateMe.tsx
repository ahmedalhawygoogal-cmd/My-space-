import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Sparkles, Star } from 'lucide-react'
import * as db from '../db'
import { STORES } from '../db'
import { useStore } from '../store'
import { uid } from '../utils'
import { RTL_LANGS, quoteField, type QuoteCharacter } from '../types'
import { motion } from 'framer-motion'
import { Button, Empty, Sheet, Toast, listItem, listStagger, useT } from '../ui'
import { DEFAULT_QUOTES } from '../data/defaultQuotes'

export default function MotivateMePage() {
  const tr = useT()
  const nav = useNavigate()
  const { lang, settings } = useStore()
  const isRTL = RTL_LANGS.has(lang)
  const nativeLanguage = settings.nativeLang || lang || 'en'

  const [characters, setCharacters] = useState<QuoteCharacter[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [detail, setDetail] = useState<QuoteCharacter | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const urlRef = useRef<Map<string, string>>(new Map())
  const [draft, setDraft] = useState<{
    name: string
    story: string
    challenge: string
    quote: string
    imageFile: File | null
    imageUrl: string | null
  }>({ name: '', story: '', challenge: '', quote: '', imageFile: null, imageUrl: null })

  const emptyDraft = () => ({
    name: '',
    story: '',
    challenge: '',
    quote: '',
    imageFile: null as File | null,
    imageUrl: null as string | null,
  })

  function textOf(c: QuoteCharacter, key: 'name' | 'story' | 'challenge' | 'quote') {
    return quoteField(c[key], nativeLanguage)
  }

  async function load() {
    try {
      const [custom, favs] = await Promise.all([
        db.getAll<QuoteCharacter>(STORES.customQuotes),
        db.getAll<{ id: string }>(STORES.favoriteQuoteIds),
      ])
      setCharacters([...DEFAULT_QUOTES, ...custom])
      setFavoriteIds(new Set(favs.map((f) => f.id)))
    } catch {
      setCharacters([...DEFAULT_QUOTES])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    return () => {
      urlRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlRef.current.clear()
      if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl)
    }
  }, [draft.imageUrl])

  function imageUrl(c: QuoteCharacter): string | null {
    if (!c.image) return null
    if (typeof c.image === 'string') return c.image
    let url = urlRef.current.get(c.id)
    if (!url) {
      url = URL.createObjectURL(c.image)
      urlRef.current.set(c.id, url)
    }
    return url
  }

  const filtered = favoritesOnly
    ? characters.filter((c) => favoriteIds.has(c.id))
    : characters

  async function toggleFavorite(c: QuoteCharacter) {
    if (favoriteIds.has(c.id)) {
      await db.deleteById(STORES.favoriteQuoteIds, c.id)
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.delete(c.id)
        return next
      })
      setToast(tr('unfavorited'))
    } else {
      await db.putOne(STORES.favoriteQuoteIds, { id: c.id })
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        next.add(c.id)
        return next
      })
      setToast(tr('favorited'))
    }
  }

  async function saveCharacter() {
    if (!draft.name.trim() || !draft.quote.trim()) return
    const char: QuoteCharacter = {
      id: uid(),
      name: draft.name.trim(),
      story: draft.story.trim(),
      challenge: draft.challenge.trim(),
      quote: draft.quote.trim(),
      image: draft.imageFile ?? undefined,
      createdAt: Date.now(),
    }
    try {
      await db.putOne(STORES.customQuotes, char)
      setCharacters((prev) => [...prev, char])
      if (draft.imageUrl) URL.revokeObjectURL(draft.imageUrl)
      setDraft(emptyDraft())
      setAddOpen(false)
      setToast(tr('saved'))
    } catch {
      setToast(tr('noCharacters'))
    }
  }

  const detailName = detail ? textOf(detail, 'name') : undefined
  const detailQuote = detail ? textOf(detail, 'quote') : ''
  const detailStory = detail ? textOf(detail, 'story') : ''
  const detailChallenge = detail ? textOf(detail, 'challenge') : ''

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="spread">
        <h1 className="page-title">{tr('motivateMe')}</h1>
        <motion.button
          className="icon-btn"
          type="button"
          onClick={() => nav(-1)}
          aria-label={tr('back')}
          style={{ transform: isRTL ? 'scaleX(-1)' : undefined }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={18} />
        </motion.button>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button
          className={`btn ${favoritesOnly ? 'accent' : 'secondary'}`}
          onClick={() => setFavoritesOnly(!favoritesOnly)}
        >
          {favoritesOnly ? tr('all') : tr('favorites')}
        </Button>
      </div>

      {loading ? (
        <div className="muted" style={{ padding: 16, textAlign: 'center' }}>
          {tr('motivateMe')}
        </div>
      ) : filtered.length === 0 ? (
        <Empty
          icon={<Sparkles size={36} />}
          title={tr('noCharacters')}
          hint={tr('motivateSubtitle')}
        />
      ) : (
        <motion.div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}
          variants={listStagger}
          initial="hidden"
          animate="show"
        >
          {filtered.map((c) => {
            const name = textOf(c, 'name')
            const quote = textOf(c, 'quote')
            const challenge = textOf(c, 'challenge')
            return (
              <motion.div
                key={c.id}
                className="card pressable"
                style={{ display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer' }}
                onClick={() => setDetail(c)}
                variants={listItem}
              >
                {c.image && (
                  <img
                    src={imageUrl(c)!}
                    alt=""
                    style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, display: 'block' }}
                  />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <b style={{ fontSize: 15, overflowWrap: 'break-word' }}>{name}</b>
                  <motion.button
                    type="button"
                    className="icon-btn"
                    style={{ padding: 2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      void toggleFavorite(c)
                    }}
                    aria-label={favoriteIds.has(c.id) ? tr('unfavorited') : tr('favorites')}
                  >
                    <Star size={16} style={{ color: favoriteIds.has(c.id) ? 'var(--gold)' : 'var(--ink-soft)' }} />
                  </motion.button>
                </div>
                <div className="muted" style={{ fontSize: 13, lineHeight: 1.4, overflowWrap: 'break-word' }}>
                  “{quote}”
                </div>
                {challenge ? (
                  <div className="muted ellipsis" style={{ fontSize: 12 }}>
                    {tr('challenge')}: {challenge}
                  </div>
                ) : null}
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {toast && <Toast text={toast} onDone={() => setToast(null)} />}

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detailName}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {detail?.image && (
            <img src={imageUrl(detail)!} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 12, flexShrink: 0 }} />
          )}
          <div className="grow">
            {detailQuote ? (
              <div className="card-quiet" style={{ marginBottom: 12, fontSize: 15, lineHeight: 1.6, overflowWrap: 'break-word' }}>
                “{detailQuote}”
              </div>
            ) : null}
            {detailStory ? (
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{tr('story')}</div>
                {detailStory}
              </div>
            ) : null}
            {detailChallenge ? (
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
                <b>{tr('challenge')}:</b> {detailChallenge}
              </div>
            ) : null}
          </div>
        </div>
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={tr('addCharacter')}>
        <label className="label">{tr('name')}</label>
        <input className="field" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <label className="label">{tr('story')}</label>
        <textarea className="field" value={draft.story} onChange={(e) => setDraft({ ...draft, story: e.target.value })} rows={3} />
        <label className="label">{tr('challenge')}</label>
        <textarea className="field" value={draft.challenge} onChange={(e) => setDraft({ ...draft, challenge: e.target.value })} rows={3} />
        <label className="label">{tr('quote')}</label>
        <textarea className="field" value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} rows={3} />
        <label className="label">{tr('addImage')}</label>
        <input
          type="file"
          accept="image/*"
          className="field"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null
            if (!file) return
            setDraft({ ...draft, imageFile: file, imageUrl: URL.createObjectURL(file) })
          }}
        />
        {draft.imageUrl && (
          <img src={draft.imageUrl} alt="" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, marginTop: 8 }} />
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <Button className="btn ghost" onClick={() => setAddOpen(false)}>
            {tr('cancel')}
          </Button>
          <Button className="btn accent block" disabled={!draft.name.trim() || !draft.quote.trim()} onClick={saveCharacter}>
            {tr('save')}
          </Button>
        </div>
      </Sheet>

      <motion.button className="fab" type="button" onClick={() => setAddOpen(true)} aria-label={tr('addCharacter')} whileTap={{ scale: 0.95 }}>
        <Plus size={22} />
      </motion.button>
    </div>
  )
}
