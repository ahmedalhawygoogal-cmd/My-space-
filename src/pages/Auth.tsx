import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogIn } from 'lucide-react'
import { Segment, Toast, useT } from '../ui'
import { PageLayout } from '../components/PageLayout'

type Tab = 'login' | 'signup'

export default function AuthPage() {
  const tr = useT()
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  async function submit() {
    if (!supabase) {
      setToast(tr('authMissing'))
      return
    }
    const mail = email.trim()
    if (!mail) {
      setToast(tr('emailRequired'))
      return
    }
    if (!password) {
      setToast(tr('passwordRequired'))
      return
    }
    setBusy(true)
    try {
      if (tab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password })
        if (error) {
          setToast(error.message || tr('invalidCredentials'))
          return
        }
        nav('/', { replace: true })
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      if (error) {
        setToast(error.message || tr('error'))
        return
      }
      if (data.session) {
        nav('/', { replace: true })
        return
      }
      setToast(tr('confirmEmail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageLayout icon={LogIn} fill className="onboard">
      <div className="onboard-card">
        <div className="brand" style={{ marginBottom: 18 }}>
          <div className="brand-mark">M</div>
          <span>{tr('appName')}</span>
        </div>
        <div className="card stack">
          <h1 className="page-title" style={{ margin: 0 }}>
            {tr('authWelcome')}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            {tr('authHint')}
          </p>
          <Segment
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { id: 'login', label: tr('login') },
              { id: 'signup', label: tr('signup') },
            ]}
          />
          {tab === 'signup' ? (
            <>
              <label className="label">{tr('fullName')}</label>
              <input
                className="field"
                value={fullName}
                autoComplete="name"
                onChange={(e) => setFullName(e.target.value)}
              />
            </>
          ) : null}
          <label className="label">{tr('email')}</label>
          <input
            className="field"
            type="email"
            value={email}
            autoComplete="email"
            inputMode="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="label">{tr('password')}</label>
          <input
            className="field"
            type="password"
            value={password}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
          />
          <button className="btn block" type="button" disabled={busy} onClick={() => void submit()}>
            {tab === 'login' ? tr('login') : tr('signup')}
          </button>
        </div>
      </div>
      <Toast text={toast} onDone={() => setToast(null)} />
    </PageLayout>
  )
}
