'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn, signUp } from './actions'

function AuthModeSwitch({
  mode,
  setMode,
}: {
  mode: 'login' | 'signup'
  setMode: (mode: 'login' | 'signup') => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        background: 'rgba(255,255,255,0.08)',
        padding: 6,
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <button
        type="button"
        onClick={() => setMode('login')}
        aria-pressed={mode === 'login'}
        style={{
          minHeight: 52,
          borderRadius: 12,
          border: mode === 'login' ? '1px solid rgba(255,255,255,0.14)' : 'none',
          background:
            mode === 'login'
              ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
              : 'transparent',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: 16,
          cursor: 'pointer',
          boxShadow:
            mode === 'login'
              ? '0 14px 28px rgba(34, 197, 94, 0.28)'
              : 'none',
          transition: 'all 0.18s ease',
        }}
      >
        Jag har konto
      </button>

      <button
        type="button"
        onClick={() => setMode('signup')}
        aria-pressed={mode === 'signup'}
        style={{
          minHeight: 52,
          borderRadius: 12,
          border: mode === 'signup' ? '1px solid rgba(255,255,255,0.14)' : 'none',
          background:
            mode === 'signup'
              ? 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)'
              : 'transparent',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: 16,
          cursor: 'pointer',
          boxShadow:
            mode === 'signup'
              ? '0 14px 28px rgba(34, 197, 94, 0.28)'
              : 'none',
          transition: 'all 0.18s ease',
        }}
      >
        Skapa konto
      </button>
    </div>
  )
}

function LoginForm() {
  return (
    <form className="stack" action={signIn} style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="login-email" style={{ color: '#f8fafc', fontWeight: 800 }}>
          E-post
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="namn@epost.se"
          required
          style={{
            minHeight: 56,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.08)',
            color: '#ffffff',
            padding: '0 16px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <label
          htmlFor="login-password"
          style={{ color: '#f8fafc', fontWeight: 800 }}
        >
          Lösenord
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          minLength={6}
          autoComplete="current-password"
          placeholder="Ditt lösenord"
          required
          style={{
            minHeight: 56,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.08)',
            color: '#ffffff',
            padding: '0 16px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        type="submit"
        style={{
          minHeight: 58,
          borderRadius: 18,
          fontWeight: 900,
          fontSize: 18,
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
          color: '#ffffff',
          boxShadow: '0 18px 34px rgba(34, 197, 94, 0.28)',
          cursor: 'pointer',
        }}
      >
        Fortsätt
      </button>
    </form>
  )
}

function SignupForm() {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: 14,
          fontSize: 14,
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.88)',
        }}
      >
        <strong style={{ color: '#ffffff' }}>Så går det till</strong>
        <br />
        1. Skapa ditt konto
        <br />
        2. Bekräfta din e-post
        <br />
        3. Vänta på godkännande
      </div>

      <form className="stack" action={signUp} style={{ gap: 16 }}>
        <div className="stack" style={{ gap: 6 }}>
          <label htmlFor="displayName" style={{ color: '#f8fafc', fontWeight: 800 }}>
            Namn
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            autoComplete="name"
            placeholder="Ditt namn"
            required
            style={{
              minHeight: 56,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label htmlFor="signup-email" style={{ color: '#f8fafc', fontWeight: 800 }}>
            E-post
          </label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="namn@epost.se"
            required
            style={{
              minHeight: 56,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label
            htmlFor="signup-password"
            style={{ color: '#f8fafc', fontWeight: 800 }}
          >
            Lösenord
          </label>
          <input
            id="signup-password"
            name="password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            placeholder="Minst 6 tecken"
            required
            style={{
              minHeight: 56,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            Minst 6 tecken.
          </p>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label
            htmlFor="handicapIndex"
            style={{ color: '#f8fafc', fontWeight: 800 }}
          >
            Handicapindex (valfritt)
          </label>
          <input
            id="handicapIndex"
            name="handicapIndex"
            type="number"
            step="0.1"
            min="0"
            placeholder="Till exempel 18.4"
            style={{
              minHeight: 56,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <label htmlFor="defaultTee" style={{ color: '#f8fafc', fontWeight: 800 }}>
            Standardtee
          </label>
          <select
            id="defaultTee"
            name="defaultTee"
            defaultValue="yellow"
            style={{
              minHeight: 56,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              padding: '0 16px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          >
            <option value="yellow" style={{ color: '#111827' }}>
              Gul
            </option>
            <option value="red" style={{ color: '#111827' }}>
              Röd
            </option>
          </select>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            Används som förvalt val när du spelar.
          </p>
        </div>

        <button
          type="submit"
          style={{
            minHeight: 58,
            borderRadius: 18,
            fontWeight: 900,
            fontSize: 18,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
            color: '#ffffff',
            boxShadow: '0 18px 34px rgba(34, 197, 94, 0.28)',
            cursor: 'pointer',
          }}
        >
          Skapa konto
        </button>
      </form>
    </div>
  )
}

function LoginPageContent() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  return (
    <main
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top left, rgba(56, 189, 98, 0.14) 0%, transparent 28%), linear-gradient(135deg, #0f2f20 0%, #163b2a 45%, #1f6b45 100%)',
        padding: '32px 16px',
        display: 'grid',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1120,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr',
          gap: 28,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            color: '#ffffff',
            display: 'grid',
            gap: 20,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              width: 'fit-content',
              padding: '10px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.14)',
              fontWeight: 900,
              backdropFilter: 'blur(12px)',
            }}
          >
            ⛳ Din golfapp
          </span>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2.8rem, 7vw, 5.4rem)',
                lineHeight: 0.94,
                letterSpacing: -2,
              }}
            >
              Spela smart.
              <br />
              Följ varje runda.
            </h1>

            <p
              style={{
                marginTop: 20,
                marginBottom: 0,
                maxWidth: 640,
                fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
                lineHeight: 1.7,
                color: 'rgba(255,255,255,0.84)',
              }}
            >
              Håll koll på score, HCP, vänner och banor i en ren och snabb
              golfupplevelse som känns som en riktig app.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 12,
              maxWidth: 760,
            }}
          >
            <div
              style={{
                borderRadius: 20,
                padding: 16,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.72)',
                  marginBottom: 8,
                }}
              >
                ⚡ Snabbt
              </div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Starta rundor direkt
              </div>
            </div>

            <div
              style={{
                borderRadius: 20,
                padding: 16,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.72)',
                  marginBottom: 8,
                }}
              >
                📍 Precision
              </div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Följ hål och avstånd
              </div>
            </div>

            <div
              style={{
                borderRadius: 20,
                padding: 16,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.72)',
                  marginBottom: 8,
                }}
              >
                👥 Socialt
              </div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Spela med vänner
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: 560,
            justifySelf: 'center',
          }}
        >
          <div
            style={{
              borderRadius: 30,
              padding: 28,
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 30px 80px rgba(0,0,0,0.24)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <div className="stack" style={{ gap: 24 }}>
              <div className="stack" style={{ gap: 10 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    width: 'fit-content',
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: '#ffffff',
                    fontWeight: 900,
                  }}
                >
                  🔐 Konto
                </span>

                <h2
                  style={{
                    margin: 0,
                    fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                    lineHeight: 0.98,
                    letterSpacing: -1,
                    color: '#ffffff',
                  }}
                >
                  {mode === 'login' ? 'Välkommen tillbaka' : 'Skapa ditt konto'}
                </h2>

                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    lineHeight: 1.65,
                    color: 'rgba(255,255,255,0.82)',
                  }}
                >
                  {mode === 'login'
                    ? 'Logga in för att fortsätta spela, följa rundor och hålla koll på din profil.'
                    : 'Skapa ett konto för att spara HCP och standard-tee i din profil.'}
                </p>
              </div>

              {message ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{
                    borderRadius: 16,
                    padding: '14px 16px',
                    background: 'rgba(255,255,255,0.10)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: '#ffffff',
                    lineHeight: 1.55,
                  }}
                >
                  {message}
                </div>
              ) : null}

              <AuthModeSwitch mode={mode} setMode={setMode} />

              {mode === 'login' ? <LoginForm /> : <SignupForm />}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          main > div {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }

        @media (max-width: 640px) {
          main {
            padding: 20px 14px !important;
          }

          main h1 {
            font-size: clamp(2.3rem, 11vw, 3.4rem) !important;
          }

          main h2 {
            font-size: clamp(1.9rem, 8vw, 2.4rem) !important;
          }

          main > div > div:first-child > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }

        input::placeholder {
          color: rgba(255, 255, 255, 0.44);
        }

        select,
        input,
        button {
          font: inherit;
        }
      `}</style>
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