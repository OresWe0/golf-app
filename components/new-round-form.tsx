'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Course } from '@/lib/types'

type PlayerInput = {
  kind: 'registered' | 'guest'
  name: string
  email: string
  handicapIndex: string
  teeKey: 'yellow' | 'red'
}

type FriendInput = {
  id: string
  friend_email: string
  friend_name: string | null
  friend_handicap_index?: number | null
  friend_default_tee?: string | null
}

export function NewRoundForm({
  courses,
  friends,
  currentUser,
}: {
  courses: Course[]
  friends: FriendInput[]
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
  ])

  const [recentPlayers, setRecentPlayers] = useState<string[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightedPlayerIndex, setHighlightedPlayerIndex] = useState<number | null>(null)
  const [recentlyAddedType, setRecentlyAddedType] = useState<'guest' | 'registered' | null>(null)
  const [recentlyAddedFriendEmail, setRecentlyAddedFriendEmail] = useState<string | null>(null)

  const playerRefs = useRef<(HTMLDivElement | null)[]>([])

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

  const showButtonFeedback = (type: 'guest' | 'registered') => {
    setRecentlyAddedType(type)

    setTimeout(() => {
      setRecentlyAddedType((current) => (current === type ? null : current))
    }, 1800)
  }

  const showFriendFeedback = (friendEmail: string) => {
    setRecentlyAddedFriendEmail(friendEmail)

    setTimeout(() => {
      setRecentlyAddedFriendEmail((current) => (current === friendEmail ? null : current))
    }, 1800)
  }

  const highlightAndScrollToPlayer = (newIndex: number) => {
    setTimeout(() => {
      playerRefs.current[newIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      setHighlightedPlayerIndex(newIndex)

      setTimeout(() => {
        setHighlightedPlayerIndex((current) => (current === newIndex ? null : current))
      }, 2500)
    }, 120)
  }

  const addRegisteredPlayer = () => {
    showButtonFeedback('registered')

    setPlayers((prev) => {
      const newIndex = prev.length
      highlightAndScrollToPlayer(newIndex)

      return [
        ...prev,
        { kind: 'registered', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
      ]
    })
  }

  const addGuestPlayer = () => {
    showButtonFeedback('guest')

    setPlayers((prev) => {
      const newIndex = prev.length
      highlightAndScrollToPlayer(newIndex)

      return [
        ...prev,
        { kind: 'guest', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
      ]
    })
  }

  const removePlayer = (index: number) => {
    if (index === 0) return
    setPlayers((prev) => prev.filter((_, i) => i !== index))
    setHighlightedPlayerIndex((current) => (current === index ? null : current))
  }

  const addRecentPlayer = (name: string) => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const alreadyExists = players.some(
      (player) => player.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )

    if (alreadyExists) return

    setPlayers((prev) => {
      const newIndex = prev.length
      highlightAndScrollToPlayer(newIndex)

      return [
        ...prev,
        {
          kind: 'guest',
          name: trimmedName,
          email: '',
          handicapIndex: '',
          teeKey: 'yellow',
        },
      ]
    })
  }

  const addFriendToRound = (friend: FriendInput) => {
    const friendEmail = friend.friend_email.trim().toLowerCase()
    if (!friendEmail) return

    const alreadyExists = players.some(
      (player) => player.email.trim().toLowerCase() === friendEmail
    )

    if (alreadyExists) return

    const fallbackName = friend.friend_email.split('@')[0] || 'Vän'
    const teeKey: 'yellow' | 'red' =
      friend.friend_default_tee === 'red' ? 'red' : 'yellow'

    showFriendFeedback(friendEmail)

    setPlayers((prev) => {
      const newIndex = prev.length
      highlightAndScrollToPlayer(newIndex)

      return [
        ...prev,
        {
          kind: 'registered',
          name: friend.friend_name?.trim() || fallbackName,
          email: friendEmail,
          handicapIndex:
            friend.friend_handicap_index == null
              ? ''
              : String(friend.friend_handicap_index),
          teeKey,
        },
      ]
    })
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

  const selectedFriendsCount = Math.max(0, players.length - 1)

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

      <div
        className="card"
        style={{
          ...sectionCardStyle,
          background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
          border: '1px solid #bbf7d0',
        }}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#dcfce7',
                  color: '#166534',
                  fontSize: 12,
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                👥 Mina vänner
              </div>

              <h3 style={{ marginTop: 0, marginBottom: 6 }}>
                Välj spelare från dina vänner
              </h3>

              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Tryck för att lägga till spelare direkt i rundan.
              </p>

              {selectedFriendsCount > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#166534',
                  }}
                >
                  {selectedFriendsCount} spelare tillagda
                </div>
              )}
            </div>

            <div
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: '#ffffff',
                border: '1px solid #d1fae5',
                color: '#166534',
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              Snabbval
            </div>
          </div>

          {friends.length === 0 ? (
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: '#ffffff',
                border: '1px dashed #d1d5db',
                color: '#64748b',
              }}
            >
              Du har inga sparade vänner ännu. Lägg till vänner under Min profil.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              {friends.map((friend) => {
                const friendEmail = friend.friend_email.trim().toLowerCase()
                const alreadyAdded = players.some(
                  (player) => player.email.trim().toLowerCase() === friendEmail
                )
                const wasJustAdded = recentlyAddedFriendEmail === friendEmail

                return (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => addFriendToRound(friend)}
                    disabled={alreadyAdded}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 999,
                      border: alreadyAdded ? '1px solid #d1d5db' : '1px solid #86efac',
                      background: wasJustAdded ? '#dcfce7' : alreadyAdded ? '#ecfdf5' : '#ffffff',
                      color: '#166534',
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: alreadyAdded ? 'not-allowed' : 'pointer',
                      boxShadow: wasJustAdded
                        ? '0 0 0 4px rgba(34, 197, 94, 0.12)'
                        : alreadyAdded
                        ? 'none'
                        : '0 4px 12px rgba(22, 101, 52, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transform: wasJustAdded ? 'scale(1.02)' : 'scale(1)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {wasJustAdded ? '✓' : alreadyAdded ? '✅' : '➕'}
                    <span>
                      {wasJustAdded
                        ? `${friend.friend_name?.trim() || friend.friend_email.split('@')[0]} · Tillagd nu`
                        : friend.friend_name?.trim() || friend.friend_email.split('@')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
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
                style={{
                  width: '100%',
                  transition: 'all 0.2s ease',
                }}
              >
                {recentlyAddedType === 'registered'
                  ? 'Spelare tillagd ↓'
                  : '+ Lägg till registrerad spelare'}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={addGuestPlayer}
                style={{
                  width: '100%',
                  transition: 'all 0.2s ease',
                }}
              >
                {recentlyAddedType === 'guest' ? 'Gäst tillagd ↓' : '+ Lägg till gäst'}
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
              SENAST SPELADE MED
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
                ref={(el) => {
                  playerRefs.current[index] = el
                }}
                className="card"
                style={{
                  marginBottom: 0,
                  background: highlightedPlayerIndex === index ? '#f0fdf4' : '#fff',
                  border:
                    highlightedPlayerIndex === index
                      ? '2px solid #22c55e'
                      : index === 0
                      ? '1px solid #bbf7d0'
                      : '1px solid #e5e7eb',
                  boxShadow:
                    highlightedPlayerIndex === index
                      ? '0 0 0 4px rgba(34, 197, 94, 0.12)'
                      : 'none',
                  transition: 'all 0.25s ease',
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

                    {highlightedPlayerIndex === index && index > 0 ? (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'inline-flex',
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: '#dcfce7',
                          color: '#166534',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        {player.kind === 'guest' ? 'Ny gäst tillagd' : 'Ny spelare tillagd'}
                      </div>
                    ) : null}

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