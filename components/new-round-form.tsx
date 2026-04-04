'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Course } from '@/lib/types'

type PlayerInput = {
  kind: 'registered' | 'guest'
  name: string
  email: string
  handicapIndex: string
  teeKey: 'yellow' | 'red'
}

export function NewRoundForm({
  courses,
  currentUser,
}: {
  courses: Course[]
  currentUser: {
    email: string
    displayName: string
    handicapIndex: number | null
    defaultTee: string
  }
}) {
  const router = useRouter()

  const [title, setTitle] = useState('Lördagsrundan')
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [scoringMode, setScoringMode] = useState<'strokeplay' | 'stableford'>('stableford')

  const [holesMode, setHolesMode] = useState<9 | 18>(18)
  const [nineHoleSide, setNineHoleSide] = useState<'front' | 'back'>('front')

  const [players, setPlayers] = useState<PlayerInput[]>([
    {
      kind: 'registered',
      name: currentUser.displayName,
      email: currentUser.email,
      handicapIndex: currentUser.handicapIndex == null ? '' : String(currentUser.handicapIndex),
      teeKey: currentUser.defaultTee === 'red' ? 'red' : 'yellow',
    },
    { kind: 'registered', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
  ])

  const [recentPlayers, setRecentPlayers] = useState<string[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recentPlayersStorageKey = useMemo(
    () => `recent-players:${currentUser.email.toLowerCase()}`,
    [currentUser.email]
  )

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(recentPlayersStorageKey)
      if (!raw) {
        setRecentPlayers([])
        setLoadingRecent(false)
        return
      }

      const parsed = JSON.parse(raw)

      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map((name) => (typeof name === 'string' ? name.trim() : ''))
          .filter(Boolean)
          .filter(
            (name, index, arr) =>
              arr.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === index
          )
          .filter((name) => name.toLowerCase() !== currentUser.displayName.trim().toLowerCase())
          .slice(0, 6)

        setRecentPlayers(cleaned)
      } else {
        setRecentPlayers([])
      }
    } catch {
      setRecentPlayers([])
    } finally {
      setLoadingRecent(false)
    }
  }, [recentPlayersStorageKey, currentUser.displayName])

  const updatePlayer = (index: number, key: keyof PlayerInput, value: string) => {
    setPlayers((prev) =>
      prev.map((player, i) => (i === index ? { ...player, [key]: value } : player))
    )
  }

  const addRegisteredPlayer = () => {
    setPlayers((prev) => [
      ...prev,
      { kind: 'registered', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
    ])
  }

  const addGuestPlayer = () => {
    setPlayers((prev) => [
      ...prev,
      { kind: 'guest', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
    ])
  }

  const removePlayer = (index: number) => {
    if (index === 0) return
    setPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  const addRecentPlayer = (name: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const alreadyExists = players.some(
      (player) => player.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )

    if (alreadyExists) return

    setPlayers((prev) => [
      ...prev,
      {
        kind: 'guest',
        name: trimmedName,
        email: '',
        handicapIndex: '',
        teeKey: 'yellow',
      },
    ])
  }

  const saveRecentPlayers = (names: string[]) => {
    try {
      const cleaned = names
        .map((name) => name.trim())
        .filter(Boolean)
        .filter(
          (name, index, arr) =>
            arr.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === index
        )
        .filter((name) => name.toLowerCase() !== currentUser.displayName.trim().toLowerCase())
        .slice(0, 6)

      window.localStorage.setItem(recentPlayersStorageKey, JSON.stringify(cleaned))
      setRecentPlayers(cleaned)
    } catch {
      // Ignorera localStorage-fel
    }
  }

  const normalizedPlayersPreview = players
    .map((player, index) => ({
      ...player,
      sortOrder: index + 1,
      name: player.name.trim(),
      email: player.email.trim().toLowerCase(),
      handicapIndex: player.handicapIndex ? Number(player.handicapIndex) : null,
    }))
    .filter((player) => player.name)

  const selectedCourseName =
    courses.find((course) => course.id === courseId)?.name ?? 'Ingen bana vald'

  const roundModeLabel =
    scoringMode === 'stableford' ? 'Poängbogey' : 'Slagspel'

  const holesModeLabel =
    holesMode === 18 ? '18 hål' : nineHoleSide === 'front' ? '9 hål · Främre 9' : '9 hål · Bakre 9'

  const submit = async () => {
    setLoading(true)
    setError(null)

    const normalizedPlayers = normalizedPlayersPreview

    const response = await fetch('/api/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        courseId,
        scoringMode,
        holesMode,
        nineHoleSide,
        players: normalizedPlayers,
      }),
    })

    const result = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(result.error || 'Kunde inte skapa rundan.')
      return
    }

    const namesToRemember = normalizedPlayers.map((player) => player.name).filter(Boolean)
    saveRecentPlayers(namesToRemember)

    const firstHole = holesMode === 18 ? 1 : nineHoleSide === 'front' ? 1 : 10
    router.push(`/rounds/${result.roundId}?hole=${firstHole}`)
  }

  const sectionCardStyle: React.CSSProperties = {
    background: '#f8fbf7',
    border: '1px solid #dbeedc',
    marginBottom: 0,
  }

  return (
    <div className="stack">
      <div
        className="card"
        style={{
          background: 'linear-gradient(180deg, #f8fbf7 0%, #ffffff 100%)',
          border: '1px solid #dbeedc',
          marginBottom: 0,
        }}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                background: '#ecfdf3',
                color: '#166534',
                fontSize: 13,
                fontWeight: 900,
                marginBottom: 12,
              }}
            >
              ⛳ Ny runda
            </div>

            <h2 style={{ margin: 0, marginBottom: 8 }}>Grundinställningar</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Välj rundnamn, bana och scoring mode. När du sparar skickas ni direkt till rätt starthål.
            </p>
          </div>

          <div className="stack">
            <div>
              <label htmlFor="title">Rundnamn</label>
              <input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="T.ex. Lördagsrundan"
              />
            </div>

            <div className="grid grid-2">
              <div>
                <label htmlFor="course">Bana</label>
                <select
                  id="course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                >
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="mode">Scoring mode</label>
                <select
                  id="mode"
                  value={scoringMode}
                  onChange={(e) =>
                    setScoringMode(e.target.value as 'strokeplay' | 'stableford')
                  }
                >
                  <option value="stableford">Poängbogey</option>
                  <option value="strokeplay">Slagspel</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={sectionCardStyle}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Rundinställningar</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Välj antal hål. Vid 9 hål bestämmer du om ni startar på främre eller bakre 9.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <label>Antal hål</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => setHolesMode(18)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 16,
                    border: holesMode === 18 ? '2px solid #166534' : '1px solid #d1d5db',
                    background: holesMode === 18 ? '#ecfdf3' : '#fff',
                    color: '#0f172a',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  18 hål
                </button>

                <button
                  type="button"
                  onClick={() => setHolesMode(9)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 16,
                    border: holesMode === 9 ? '2px solid #166534' : '1px solid #d1d5db',
                    background: holesMode === 9 ? '#ecfdf3' : '#fff',
                    color: '#0f172a',
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  9 hål
                </button>
              </div>
            </div>

            {holesMode === 9 ? (
              <div>
                <label>Vilka 9 hål?</label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setNineHoleSide('front')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border:
                        nineHoleSide === 'front'
                          ? '2px solid #166534'
                          : '1px solid #d1d5db',
                      background: nineHoleSide === 'front' ? '#ecfdf3' : '#fff',
                      color: '#0f172a',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Främre 9
                  </button>

                  <button
                    type="button"
                    onClick={() => setNineHoleSide('back')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border:
                        nineHoleSide === 'back'
                          ? '2px solid #166534'
                          : '1px solid #d1d5db',
                      background: nineHoleSide === 'back' ? '#ecfdf3' : '#fff',
                      color: '#0f172a',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    Bakre 9
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card" style={sectionCardStyle}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Spelare i bollen</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Ange e-post för registrerade spelare. Gäster kan läggas till utan e-post.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr',
                gap: 10,
                width: '100%',
              }}
            >
              <button
                type="button"
                className="button"
                onClick={addRegisteredPlayer}
                style={{ width: '100%' }}
              >
                + Registrerad vän
              </button>

              <button
                type="button"
                className="secondary"
                onClick={addGuestPlayer}
                style={{ width: '100%' }}
              >
                + Gäst
              </button>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 18,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                marginBottom: 10,
                letterSpacing: 0.4,
              }}
            >
              Senast spelade med
            </div>

            {loadingRecent ? (
              <div style={{ fontSize: 14, color: '#64748b' }}>Laddar spelare...</div>
            ) : recentPlayers.length === 0 ? (
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                Dina senaste spelare dyker upp här efter att du skapat några rundor.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {recentPlayers.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addRecentPlayer(name)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 999,
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      color: '#166534',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    + {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="stack">
            {players.map((player, index) => (
              <div
                className="card"
                style={{
                  marginBottom: 0,
                  background: '#fff',
                  border: index === 0 ? '1px solid #bbf7d0' : '1px solid #e5e7eb',
                }}
                key={index}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 900,
                        lineHeight: 1.1,
                      }}
                    >
                      {index === 0
                        ? 'Du'
                        : player.kind === 'registered'
                        ? 'Registrerad spelare'
                        : 'Gästspelare'}
                    </div>

                    <div className="muted" style={{ marginTop: 4 }}>
                      {player.kind === 'registered'
                        ? 'Använd e-post för registrerad vän'
                        : 'Lämna e-post tomt för gäst'}
                    </div>
                  </div>

                  {index > 0 ? (
                    <button
                      type="button"
                      onClick={() => removePlayer(index)}
                      style={{
                        border: '1px solid #fecaca',
                        background: '#fff1f2',
                        color: '#b91c1c',
                        borderRadius: 12,
                        padding: '10px 12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Ta bort
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: '#dcfce7',
                        color: '#166534',
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      Huvudspelare
                    </div>
                  )}
                </div>

                <div className="grid grid-4">
                  <div>
                    <label>Namn</label>
                    <input
                      placeholder="Namn"
                      value={player.name}
                      onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                    />
                  </div>

                  <div>
                    <label>
                      E-post {player.kind === 'registered' ? '(krävs)' : '(valfritt)'}
                    </label>
                    <input
                      placeholder={
                        player.kind === 'registered' ? 'vän@epost.se' : 'tomt = gäst'
                      }
                      type="email"
                      value={player.email}
                      onChange={(e) => updatePlayer(index, 'email', e.target.value)}
                      disabled={index === 0}
                    />
                  </div>

                  <div>
                    <label>Exakt HCP</label>
                    <input
                      placeholder="t.ex. 24.1"
                      type="number"
                      step="0.1"
                      value={player.handicapIndex}
                      onChange={(e) => updatePlayer(index, 'handicapIndex', e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Tee</label>
                    <select
                      value={player.teeKey}
                      onChange={(e) =>
                        updatePlayer(index, 'teeKey', e.target.value as 'yellow' | 'red')
                      }
                    >
                      <option value="yellow">Gul tee</option>
                      <option value="red">Röd tee</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{
          background: 'linear-gradient(180deg, #f8fbf7 0%, #ffffff 100%)',
          border: '1px solid #dbeedc',
          marginBottom: 0,
        }}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Sammanfattning</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Kontrollera upplägget innan du startar rundan.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 10,
            }}
          >
            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Bana
              </div>
              <div style={{ fontWeight: 900 }}>{selectedCourseName}</div>
            </div>

            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Mode
              </div>
              <div style={{ fontWeight: 900 }}>{roundModeLabel}</div>
            </div>

            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Hål
              </div>
              <div style={{ fontWeight: 900 }}>{holesModeLabel}</div>
            </div>

            <div
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 12,
              }}
            >
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Spelare
              </div>
              <div style={{ fontWeight: 900 }}>{normalizedPlayersPreview.length}</div>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                marginBottom: 8,
              }}
            >
              Spelarlista
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {normalizedPlayersPreview.map((player, index) => (
                <div
                  key={`${player.name}-${index}`}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: index === 0 ? '#dcfce7' : '#f3f4f6',
                    color: index === 0 ? '#166534' : '#334155',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  {player.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <div
          style={{
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#b91c1c',
            borderRadius: 16,
            padding: 14,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        style={{
          minHeight: 56,
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        {loading ? 'Skapar...' : 'Starta runda'}
      </button>
    </div>
  )
}