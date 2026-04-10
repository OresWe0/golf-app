'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Course } from '@/lib/types'
import { getTeeDisplayLabel, normalizeTeeKey, type TeeKey } from '@/lib/scoring'

type PlayerInput = {
  kind: 'registered' | 'guest'
  name: string
  email: string
  handicapIndex: string
  teeKey: TeeKey
}

type FriendInput = {
  id: string
  friend_email: string
  friend_name: string | null
  friend_handicap_index?: number | null
  friend_default_tee?: string | null
}

type SavedRoundSetup = {
  title: string
  courseId: string
  scoringMode: 'strokeplay' | 'stableford'
  holesMode: 9 | 18
  nineHoleSide: 'front' | 'back'
  players: Array<{
    sortOrder: number
    name: string
    email: string
    handicapIndex: number | null
    teeKey: TeeKey
  }>
}

const MAX_SAVED_SETUPS = 3

function sanitizeSavedSetups(value: unknown): SavedRoundSetup[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const setup = item as Record<string, unknown>
      const rawPlayers = Array.isArray(setup.players) ? setup.players : []

      const players = rawPlayers
        .filter((player) => player && typeof player === 'object')
        .map((player, index) => {
          const p = player as Record<string, unknown>
          return {
            sortOrder:
              typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder)
                ? p.sortOrder
                : index + 1,
            name: typeof p.name === 'string' ? p.name.trim() : '',
            email: typeof p.email === 'string' ? p.email.trim().toLowerCase() : '',
            handicapIndex:
              typeof p.handicapIndex === 'number' && Number.isFinite(p.handicapIndex)
                ? p.handicapIndex
                : null,
            teeKey: normalizeTeeKey(p.teeKey),
          }
        })
        .filter((player) => player.name)

      return {
        title: typeof setup.title === 'string' ? setup.title.trim() : '',
        courseId: typeof setup.courseId === 'string' ? setup.courseId : '',
        scoringMode:
          setup.scoringMode === 'strokeplay' ? 'strokeplay' : 'stableford',
        holesMode: setup.holesMode === 9 ? 9 : 18,
        nineHoleSide: setup.nineHoleSide === 'back' ? 'back' : 'front',
        players,
      } satisfies SavedRoundSetup
    })
    .filter((setup) => setup.courseId && setup.players.length > 0)
    .slice(0, MAX_SAVED_SETUPS)
}

function arePlayersEqual(a: SavedRoundSetup['players'], b: SavedRoundSetup['players']) {
  if (a.length !== b.length) return false

  return a.every((player, index) => {
    const other = b[index]
    return (
      player.name === other.name &&
      player.email === other.email &&
      player.handicapIndex === other.handicapIndex &&
      player.teeKey === other.teeKey
    )
  })
}

function isSameSetup(a: SavedRoundSetup, b: SavedRoundSetup) {
  return (
    a.courseId === b.courseId &&
    a.title === b.title &&
    a.scoringMode === b.scoringMode &&
    a.holesMode === b.holesMode &&
    a.nineHoleSide === b.nineHoleSide &&
    arePlayersEqual(a.players, b.players)
  )
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

  const normalizedDefaultTee = normalizeTeeKey(currentUser.defaultTee)

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
      teeKey: normalizedDefaultTee,
    },
  ])

  const [recentPlayers, setRecentPlayers] = useState<string[]>([])
  const [savedSetups, setSavedSetups] = useState<SavedRoundSetup[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightedPlayerIndex, setHighlightedPlayerIndex] = useState<number | null>(null)
  const [recentlyAddedType, setRecentlyAddedType] = useState<'guest' | 'registered' | null>(null)
  const [recentlyAddedFriendEmail, setRecentlyAddedFriendEmail] = useState<string | null>(null)

  const playerRefs = useRef<(HTMLDivElement | null)[]>([])
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const playersSectionRef = useRef<HTMLDivElement | null>(null)

  const recentPlayersStorageKey = useMemo(
    () => `recent-players:${currentUser.email.toLowerCase()}`,
    [currentUser.email]
  )

  const savedSetupsStorageKey = useMemo(
    () => `round-setups:${currentUser.email.toLowerCase()}`,
    [currentUser.email]
  )

  const normalizedPlayersPreview = players
    .map((player, index) => ({
      ...player,
      sortOrder: index + 1,
      name: player.name.trim(),
      email: player.email.trim().toLowerCase(),
      handicapIndex: player.handicapIndex ? Number(player.handicapIndex) : null,
      teeKey: normalizeTeeKey(player.teeKey),
    }))
    .filter((player) => player.name)

  const selectedFriendsCount = Math.max(0, players.length - 1)

  const selectedCourseName =
    courses.find((course) => course.id === courseId)?.name ?? 'Ingen bana vald'

  const roundModeLabel = scoringMode === 'stableford' ? 'Poängbogey' : 'Slagspel'

  const holesModeLabel =
    holesMode === 18 ? '18 hål' : nineHoleSide === 'front' ? '9 hål · Främre 9' : '9 hål · Bakre 9'

  const getFirstHole = (setup: Pick<SavedRoundSetup, 'holesMode' | 'nineHoleSide'>) =>
    setup.holesMode === 18 ? 1 : setup.nineHoleSide === 'back' ? 10 : 1

  useEffect(() => {
    titleInputRef.current?.focus()
  }, [])

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(savedSetupsStorageKey)
      if (!raw) {
        setSavedSetups([])
        return
      }

      const parsed = JSON.parse(raw)
      setSavedSetups(sanitizeSavedSetups(parsed))
    } catch {
      setSavedSetups([])
    }
  }, [savedSetupsStorageKey])

  const updatePlayer = (index: number, key: keyof PlayerInput, value: string) => {
    setPlayers((prev) =>
      prev.map((player, i) =>
        i === index
          ? {
              ...player,
              [key]: key === 'teeKey' ? normalizeTeeKey(value) : value,
            }
          : player
      )
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

  const scrollToPlayersSection = () => {
    setTimeout(() => {
      playersSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 80)
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

      return [...prev, { kind: 'guest', name: '', email: '', handicapIndex: '', teeKey: 'yellow' }]
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
    const teeKey = normalizeTeeKey(friend.friend_default_tee)

    showFriendFeedback(friendEmail)
    scrollToPlayersSection()

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
            friend.friend_handicap_index == null ? '' : String(friend.friend_handicap_index),
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

  const saveSetup = (setup: SavedRoundSetup) => {
    try {
      const existing = sanitizeSavedSetups(
        JSON.parse(window.localStorage.getItem(savedSetupsStorageKey) || '[]')
      )

      const updated = [setup, ...existing.filter((item) => !isSameSetup(item, setup))].slice(
        0,
        MAX_SAVED_SETUPS
      )

      window.localStorage.setItem(savedSetupsStorageKey, JSON.stringify(updated))
      setSavedSetups(updated)
    } catch {
      setSavedSetups((prev) => [setup, ...prev.filter((item) => !isSameSetup(item, setup))].slice(0, 3))
    }
  }

  const createRound = async (setup: SavedRoundSetup, options?: { persistSetup?: boolean }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setup),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Kunde inte skapa rundan.')
        return
      }

      const namesToRemember = setup.players.map((player) => player.name).filter(Boolean)
      saveRecentPlayers(namesToRemember)

      if (options?.persistSetup !== false) {
        saveSetup(setup)
      }

      router.push(`/rounds/${result.roundId}?hole=${getFirstHole(setup)}`)
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    const setup: SavedRoundSetup = {
      title,
      courseId,
      scoringMode,
      holesMode,
      nineHoleSide,
      players: normalizedPlayersPreview,
    }

    await createRound(setup)
  }

  const sectionCardStyle: React.CSSProperties = {
    background: '#f8fbf7',
    border: '1px solid #dbeedc',
    marginBottom: 0,
  }

  const stickyBarStyle: React.CSSProperties = {
    position: 'sticky',
    bottom: 0,
    zIndex: 20,
    paddingTop: 12,
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
    background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, #ffffff 28%)',
  }

  return (
    <div className="stack" style={{ paddingBottom: 8 }}>
      {savedSetups.length > 0 ? (
        <div
          className="card"
          style={{
            background: 'linear-gradient(180deg, #ecfdf3 0%, #ffffff 100%)',
            border: '1px solid #bbf7d0',
            marginBottom: 0,
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
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
                ⚡ Snabbstart
              </div>

              <h2 style={{ margin: 0, marginBottom: 6 }}>Spela igen</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Starta en tidigare setup direkt utan att fylla i allt igen.
              </p>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {savedSetups.map((setup, index) => {
                const playersCount = setup.players.length
                const firstPlayer = setup.players[0]?.name || 'Spelare'
                const extraPlayers = playersCount > 1 ? ` + ${playersCount - 1}` : ''
                const courseName =
                  courses.find((course) => course.id === setup.courseId)?.name ?? 'Vald bana'
                const setupHolesLabel =
                  setup.holesMode === 18
                    ? '18 hål'
                    : setup.nineHoleSide === 'back'
                      ? '9 hål · Bakre 9'
                      : '9 hål · Främre 9'

                return (
                  <button
                    key={`${setup.courseId}-${setup.title}-${index}`}
                    type="button"
                    disabled={loading}
                    onClick={() => createRound(setup, { persistSetup: false })}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border: '1px solid #86efac',
                      background: '#ffffff',
                      textAlign: 'left',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 6px 18px rgba(22, 101, 52, 0.08)',
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#0f172a' }}>
                      ⚡ {setup.title || 'Runda'}
                    </div>
                    <div style={{ fontSize: 13, color: '#166534', marginTop: 4, fontWeight: 800 }}>
                      {courseName}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.78, marginTop: 4 }}>
                      {firstPlayer}
                      {extraPlayers} · {setupHolesLabel}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

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

            <h2 style={{ margin: 0, marginBottom: 8 }}>Snabbstart</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Välj bana och mode – sen är du redo.
            </p>
          </div>

          <div className="stack">
            <div>
              <label htmlFor="title">Rundnamn</label>
              <input
                ref={titleInputRef}
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="T.ex. Lördagsrundan"
              />
            </div>

            <div className="grid grid-2">
              <div>
                <label htmlFor="course">Bana</label>
                <select id="course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="mode">Spelform</label>
                <select
                  id="mode"
                  value={scoringMode}
                  onChange={(e) => setScoringMode(e.target.value as 'strokeplay' | 'stableford')}
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
                      border: nineHoleSide === 'front' ? '2px solid #166534' : '1px solid #d1d5db',
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
                      border: nineHoleSide === 'back' ? '2px solid #166534' : '1px solid #d1d5db',
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

              <h3 style={{ marginTop: 0, marginBottom: 6 }}>Välj spelare från dina vänner</h3>

              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Tryck för att lägga till spelare direkt i rundan.
              </p>

              {selectedFriendsCount > 0 ? (
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
              ) : null}
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

      <div ref={playersSectionRef} className="card" style={sectionCardStyle}>
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
                Lägg till registrerade spelare eller gäster och justera HCP och tee.
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
                    <label>E-post {player.kind === 'registered' ? '(krävs)' : '(valfritt)'}</label>
                    <input
                      placeholder={player.kind === 'registered' ? 'vän@epost.se' : 'tomt = gäst'}
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
                      onChange={(e) => updatePlayer(index, 'teeKey', e.target.value as TeeKey)}
                    >
                      <option value="yellow">{getTeeDisplayLabel('yellow')}</option>
                      <option value="red">{getTeeDisplayLabel('red')}</option>
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
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Detta startar du nu</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              En snabb förhandsvisning innan du drar igång.
            </p>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid #dbeedc',
              borderRadius: 18,
              padding: 16,
              display: 'grid',
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Bana</div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>{selectedCourseName}</div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 10,
              }}
            >
              <div
                style={{
                  background: '#f8fafc',
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
                  background: '#f8fafc',
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
                  background: '#f8fafc',
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

            <div>
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
                    {player.name} · {getTeeDisplayLabel(player.teeKey)}
                  </div>
                ))}
              </div>
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

      <div style={stickyBarStyle}>
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          style={{
            width: '100%',
            minHeight: 58,
            fontSize: 18,
            fontWeight: 900,
            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
          }}
        >
          {loading ? 'Skapar...' : 'Starta runda'}
        </button>
      </div>
    </div>
  )
}
