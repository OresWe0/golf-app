'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, signUp } from './actions'

function LoginPageContent() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  return (
    <main>
      <div className="container auth-shell">
        <div
          className="card stack"
          style={{ maxWidth: 520, margin: '0 auto' }}
        >
          <div className="stack" style={{ gap: 8 }}>
            <span className="badge">🔐 Konto</span>

            <h1 style={{ margin: 0 }}>
              {mode === 'login'
                ? 'Välkommen tillbaka'
                : 'Skapa ditt konto'}
            </h1>

            <p className="muted" style={{ margin: 0 }}>
              {mode === 'login'
                ? 'Logga in för att fortsätta.'
                : 'Skapa ett konto för att spara HCP och standard-tee i din profil.'}
            </p>
          </div>

          {message ? (
            <div className="notice" role="status" aria-live="polite">
              {message}
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              background: '#f5f7f4',
              padding: 6,
              borderRadius: 12,
            }}
          >
            <button
              type="button"
              onClick={() => setMode('login')}
              className={mode === 'login' ? '' : 'secondary'}
              aria-pressed={mode === 'login'}
            >
              Logga in
            </button>

            <button
              type="button"
              onClick={() => setMode('signup')}
              className={mode === 'signup' ? '' : 'secondary'}
              aria-pressed={mode === 'signup'}
            >
              Skapa konto
            </button>
          </div>

          {mode === 'login' && (
            <form className="stack" action={signIn}>
              <div className="stack" style={{ gap: 6 }}>
                <label htmlFor="login-email">E-post</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="stack" style={{ gap: 6 }}>
                <label htmlFor="login-password">Lösenord</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  minLength={6}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button type="submit">Logga in</button>
            </form>
          )}

          {mode === 'signup' && (
            <div className="stack">
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #dbeedc',
                  borderRadius: 12,
                  padding: 12,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                <strong>Så går det till</strong>
                <br />
                1. Skapa konto
                <br />
                2. Bekräfta din e-post
                <br />
                3. Vänta på godkännande
              </div>

              <form className="stack" action={signUp}>
                <div className="stack" style={{ gap: 6 }}>
                  <label htmlFor="displayName">Namn</label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="stack" style={{ gap: 6 }}>
                  <label htmlFor="signup-email">E-post</label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="stack" style={{ gap: 6 }}>
                  <label htmlFor="signup-password">Lösenord</label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    Minst 6 tecken.
                  </p>
                </div>

                <div className="stack" style={{ gap: 6 }}>
                  <label htmlFor="handicapIndex">
                    Handicapindex (valfritt)
                  </label>
                  <input
                    id="handicapIndex"
                    name="handicapIndex"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="Till exempel 18.4"
                  />
                </div>

                <div className="stack" style={{ gap: 6 }}>
                  <label htmlFor="defaultTee">Standardtee</label>
                  <select
                    id="defaultTee"
                    name="defaultTee"
                    defaultValue="yellow"
                  >
                    <option value="yellow">Gul</option>
                    <option value="red">Röd</option>
                  </select>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    Används som förvalt val när du spelar.
                  </p>
                </div>

                <button type="submit" className="secondary">
                  Skapa konto
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  )
}