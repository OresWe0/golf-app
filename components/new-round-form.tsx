'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
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

type SavedRoundPlayer = {
  kind: 'registered' | 'guest'
  name: string
  email: string
  handicapIndex: number | null
  teeKey: TeeKey
}

type SavedRoundSetup = {
  id: string
  title: string
  courseId: string
  scoringMode: 'strokeplay' | 'stableford'
  holesMode: 9 | 18
  nineHoleSide: 'front' | 'back'
  players: SavedRoundPlayer[]
  lastUsedAt: string
  timesUsed: number
}

type NormalizedPlayer = SavedRoundPlayer & {
  sortOrder: number
}

const getRoundTitleSuggestion = () => {
  const now = new Date()
  const hour = now.getHours()
  const day = now.getDay()

  if (day === 6) return 'Lördagsrundan'
  if (day === 0) return 'Söndagsrundan'
  if (hour < 11) return 'Morgonrundan'
  if (hour < 17) return 'Dagens runda'
  return 'Kvällsrundan'
}

const normalizeSetupId = (setup: {
  courseId: string
  scoringMode: 'strokeplay' | 'stableford'
  holesMode: 9 | 18
  nineHoleSide: 'front' | 'back'
  players: SavedRoundPlayer[]
}) =>
  JSON.stringify({
    courseId: setup.courseId,
    scoringMode: setup.scoringMode,
    holesMode: setup.holesMode,
    nineHoleSide: setup.nineHoleSide,
    players: setup.players.map((player) => ({
      kind: player.kind,
      name: player.name.trim().toLowerCase(),
      email: player.email.trim().toLowerCase(),
      teeKey: normalizeTeeKey(player.teeKey),
    })),
  })

const buildSetupLabel = (setup: SavedRoundSetup, currentUserName: string) => {
  const others = setup.players.filter(
    (player) => player.name.trim().toLowerCase() !== currentUserName.trim().toLowerCase()
  )

  if (others.length === 0) return 'Solo'
  if (others.length === 1) return `Med ${others[0].name}`
  return `Med ${others[0].name} + ${others.length - 1}`
}

const loadSavedSetups = (storageKey: string): SavedRoundSetup[] => {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => {
        const players: SavedRoundPlayer[] = Array.isArray(item.players)
          ? item.players
              .filter(
                (player): player is Record<string, unknown> =>
                  !!player && typeof player === 'object'
              )
              .map((player) => ({
                kind: player.kind === 'guest' ? 'guest' : 'registered',
                name: typeof player.name === 'string' ? player.name : '',
                email: typeof player.email === 'string' ? player.email : '',
                handicapIndex:
                  typeof player.handicapIndex === 'number' ? player.handicapIndex : null,
                teeKey: normalizeTeeKey(player.teeKey),
              }))
          : []

        const setup: SavedRoundSetup = {
          id: typeof item.id === 'string' ? item.id : '',
          title: typeof item.title === 'string' ? item.title : '',
          courseId: typeof item.courseId === 'string' ? item.courseId : '',
          scoringMode: item.scoringMode === 'strokeplay' ? 'strokeplay' : 'stableford',
          holesMode: item.holesMode === 9 ? 9 : 18,
          nineHoleSide: item.nineHoleSide === 'back' ? 'back' : 'front',
          lastUsedAt: typeof item.lastUsedAt === 'string' ? item.lastUsedAt : '',
          timesUsed: typeof item.timesUsed === 'number' ? item.timesUsed : 1,
          players,
        }

        return setup
      })
      .filter((setup) => setup.courseId && setup.players.length > 0)
      .slice(0, 6)
  } catch {
    return []
  }
}

const saveSetups = (storageKey: string, setups: SavedRoundSetup[]) => {
  window.localStorage.setItem(storageKey, JSON.stringify(setups.slice(0, 3)))
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
  const defaultCourseId = courses[0]?.id ?? ''

  const [title, setTitle] = useState(getRoundTitleSuggestion())
  const [courseId, setCourseId] = useState(defaultCourseId)
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
  const [loadingRecent, setLoadingRecent] = useState(true)
  const [savedSetups, setSavedSetups] = useState<SavedRoundSetup[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [highlightedPlayerIndex, setHighlightedPlayerIndex] = useState<number | null>(null)
  const [recentlyAddedType, setRecentlyAddedType] = useState<'guest' | 'registered' | null>(null)
  const [recentlyAddedFriendEmail, setRecentlyAddedFriendEmail] = useState<string | null>(null)

  const playerRefs = useRef<(HTMLDivElement | null)[]>([])
  const playerSectionRef = useRef<HTMLDivElement | null>(null)
  const customizeSectionRef = useRef<HTMLDivElement | null>(null)

  const recentPlayersStorageKey = useMemo(
    () => `recent-players:${currentUser.email.toLowerCase()}`,
    [currentUser.email]
  )

  const roundSetupsStorageKey = useMemo(
    () => `round-setups:${currentUser.email.toLowerCase()}`,
    [currentUser.email]
  )

  useEffect(() => {
    setCourseId((current) => current || defaultCourseId)
  }, [defaultCourseId])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(recentPlayersStorageKey)
      if (!raw) {
        setRecentPlayers([])
        return
      }

      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const cleaned = parsed
          .map((name) => (typeof name === 'string' ? name.trim() : ''))
          .filter(Boolean)
          .filter(
            (name, index, arr) =>
              arr.findIndex((value) => value.toLowerCase() === name.toLowerCase()) === index
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
    setSavedSetups(loadSavedSetups(roundSetupsStorageKey))
  }, [roundSetupsStorageKey])

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

  const normalizedPlayersPreview: NormalizedPlayer[] = players
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
    holesMode === 18
      ? nineHoleSide === 'back'
        ? '18 hål · Start bakre 9'
        : '18 hål · Start främre 9'
      : nineHoleSide === 'front'
        ? '9 hål · Främre 9'
        : '9 hål · Bakre 9'

  const compactHolesLabel =
    holesMode === 18
      ? nineHoleSide === 'back'
        ? '18 hal · start bak'
        : '18 hal · start fram'
      : nineHoleSide === 'front'
        ? 'Framre 9'
        : 'Bakre 9'

  const dynamicCtaLabel = (() => {
    const others = normalizedPlayersPreview.filter(
      (player) => player.name.trim().toLowerCase() !== currentUser.displayName.trim().toLowerCase()
    )

    if (loading) return 'Skapar runda...'
    if (others.length === 0) return `⚡ Starta solo på ${selectedCourseName}`
    if (others.length === 1) return `⚡ Starta med ${others[0].name}`
    return `⚡ Starta runda med ${normalizedPlayersPreview.length} spelare`
  })()

  const soloQuickSetup: SavedRoundSetup = {
    id: normalizeSetupId({
      courseId,
      scoringMode,
      holesMode,
      nineHoleSide,
      players: [
        {
          kind: 'registered',
          name: currentUser.displayName,
          email: currentUser.email,
          handicapIndex: currentUser.handicapIndex,
          teeKey: normalizedDefaultTee,
        },
      ],
    }),
    title: title.trim() || getRoundTitleSuggestion(),
    courseId,
    scoringMode,
    holesMode,
    nineHoleSide,
    players: [
      {
        kind: 'registered',
        name: currentUser.displayName,
        email: currentUser.email,
        handicapIndex: currentUser.handicapIndex,
        teeKey: normalizedDefaultTee,
      },
    ],
    lastUsedAt: new Date().toISOString(),
    timesUsed: 1,
  }

  const primaryQuickStart = savedSetups[0] ?? soloQuickSetup

  const showButtonFeedback = (type: 'guest' | 'registered') => {
    setRecentlyAddedType(type)

    window.setTimeout(() => {
      setRecentlyAddedType((current) => (current === type ? null : current))
    }, 1800)
  }

  const showFriendFeedback = (friendEmail: string) => {
    setRecentlyAddedFriendEmail(friendEmail)

    window.setTimeout(() => {
      setRecentlyAddedFriendEmail((current) => (current === friendEmail ? null : current))
    }, 1800)
  }

  const scrollToPlayerSection = () => {
    window.setTimeout(() => {
      playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
  }

  const scrollToCustomize = () => {
    customizeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const highlightAndScrollToPlayer = (newIndex: number) => {
    window.setTimeout(() => {
      playerRefs.current[newIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })

      setHighlightedPlayerIndex(newIndex)

      window.setTimeout(() => {
        setHighlightedPlayerIndex((current) => (current === newIndex ? null : current))
      }, 2500)
    }, 180)
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

    setPlayers((prev) => {
      const newIndex = prev.length
      highlightAndScrollToPlayer(newIndex)
      scrollToPlayerSection()

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
            arr.findIndex((value) => value.toLowerCase() === name.toLowerCase()) === index
        )
        .filter((name) => name.toLowerCase() !== currentUser.displayName.trim().toLowerCase())
        .slice(0, 6)

      window.localStorage.setItem(recentPlayersStorageKey, JSON.stringify(cleaned))
      setRecentPlayers(cleaned)
    } catch {
      // Ignorera localStorage-fel
    }
  }

  const persistSetup = (setup: SavedRoundSetup) => {
    try {
      const existing = loadSavedSetups(roundSetupsStorageKey)
      const updated = [setup, ...existing.filter((item) => item.id !== setup.id)].slice(0, 3)
      saveSetups(roundSetupsStorageKey, updated)
      setSavedSetups(updated)
    } catch {
      // Ignorera localStorage-fel
    }
  }

  const createSetupFromPlayers = (roundPlayers: NormalizedPlayer[]): SavedRoundSetup => {
    const base = {
      title: title.trim() || getRoundTitleSuggestion(),
      courseId,
      scoringMode,
      holesMode,
      nineHoleSide,
      players: roundPlayers.map((player) => ({
        kind: player.kind,
        name: player.name,
        email: player.email,
        handicapIndex: player.handicapIndex,
        teeKey: normalizeTeeKey(player.teeKey),
      })),
    }

    const existing = savedSetups.find((item) => item.id === normalizeSetupId(base))

    return {
      id: normalizeSetupId(base),
      ...base,
      lastUsedAt: new Date().toISOString(),
      timesUsed: existing ? existing.timesUsed + 1 : 1,
    }
  }

  const startRoundFromSetup = async (setup: SavedRoundSetup) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: setup.title,
          courseId: setup.courseId,
          scoringMode: setup.scoringMode,
          holesMode: setup.holesMode,
          nineHoleSide: setup.nineHoleSide,
          players: setup.players.map((player, index) => ({
            ...player,
            sortOrder: index + 1,
          })),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || 'Kunde inte skapa rundan.')
        return
      }

      persistSetup({
        ...setup,
        lastUsedAt: new Date().toISOString(),
        timesUsed: (setup.timesUsed || 0) + 1,
      })

      const namesToRemember = setup.players.map((player) => player.name).filter(Boolean)
      saveRecentPlayers(namesToRemember)

      const apiStartHole = Number(result?.startHole)
      const normalizedHolesMode = Number(setup.holesMode) === 9 ? 9 : 18
      const fallbackStartHole =
        normalizedHolesMode === 18 ? 1 : setup.nineHoleSide === 'back' ? 10 : 1
      const firstHole =
        Number.isFinite(apiStartHole) && apiStartHole >= 1
          ? Math.floor(apiStartHole)
          : fallbackStartHole
      router.push(`/rounds/${result.roundId}?hole=${firstHole}`)
    } catch {
      setError('Kunde inte skapa rundan.')
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    const setup = createSetupFromPlayers(normalizedPlayersPreview)
    await startRoundFromSetup(setup)
  }

  const sectionCardStyle: CSSProperties = {
    background: '#f8fbf7',
    border: '1px solid #dbeedc',
    marginBottom: 0,
  }

  const heroCardStyle: CSSProperties = {
    background: 'linear-gradient(180deg, #f8fbf7 0%, #ffffff 100%)',
    border: '1px solid #dbeedc',
    marginBottom: 0,
  }

  return (
    <div className="stack new-round-mobile-shell" style={{ paddingBottom: 92 }}>
      <style>{`
        .new-round-mobile-shell {
          scroll-padding-bottom: 120px;
        }

        .new-round-saved-grid {
          display: grid;
          gap: 10px;
        }

        .new-round-action-grid {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 10px;
          width: 100%;
        }

        .new-round-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 10px;
          margin-top: 14px;
          margin-bottom: 14px;
        }

        .new-round-sticky-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .new-round-sticky-pill {
          min-width: 0;
          padding: 8px 10px;
          border-radius: 14px;
          background: #f3f7f4;
          border: 1px solid #dbe7df;
        }

        .new-round-sticky-pill-label {
          margin-bottom: 4px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #64748b;
        }

        .new-round-sticky-pill-value {
          overflow: hidden;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.25;
          color: #1f3327;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 720px) {
          .new-round-mobile-shell {
            gap: 12px;
            padding-bottom: 102px !important;
          }

          .new-round-saved-grid {
            grid-auto-flow: column;
            grid-auto-columns: minmax(280px, 86%);
            overflow-x: auto;
            padding-bottom: 4px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }

          .new-round-saved-grid > * {
            scroll-snap-align: start;
          }

          .new-round-action-grid {
            grid-template-columns: 1fr;
          }

          .new-round-summary-grid {
            grid-template-columns: 1fr;
            margin-top: 12px;
            margin-bottom: 12px;
          }
        }

        @media (max-width: 520px) {
          .new-round-sticky-meta {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="card" style={heroCardStyle}>
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
              ⚡ Redo att spela
            </div>

            <h2 style={{ margin: 0, marginBottom: 8 }}>Starta ny runda</h2>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Öppna, välj snabbaste vägen och gå direkt till första hålet.
            </p>
          </div>

          <div
            className="card"
            style={{
              marginBottom: 0,
              background: 'linear-gradient(180deg, #ecfdf3 0%, #ffffff 100%)',
              border: '1px solid #86efac',
              boxShadow: '0 8px 24px rgba(22, 101, 52, 0.08)',
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
                  ⚡ Starta direkt
                </div>

                <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.05, marginBottom: 6 }}>
                  {buildSetupLabel(primaryQuickStart, currentUser.displayName)}
                </div>
                <div className="muted" style={{ lineHeight: 1.5 }}>
                  {courses.find((course) => course.id === primaryQuickStart.courseId)?.name ??
                    'Vald bana'}{' '}
                  · {primaryQuickStart.holesMode === 18 ? '18 hål' : '9 hål'} ·{' '}
                  {primaryQuickStart.scoringMode === 'stableford' ? 'Poängbogey' : 'Slagspel'}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => startRoundFromSetup(primaryQuickStart)}
                  disabled={loading}
                  style={{
                    minHeight: 56,
                    borderRadius: 16,
                    background: '#166534',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 18,
                    border: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                  }}
                >
                  {loading ? 'Skapar runda...' : '⚡ Starta direkt'}
                </button>

                <button
                  type="button"
                  className="secondary"
                  onClick={scrollToCustomize}
                  style={{ width: '100%' }}
                >
                  Gör egna val
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {savedSetups.length > 0 ? (
        <div
          className="card"
          style={{
            ...sectionCardStyle,
            background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
            border: '1px solid #bbf7d0',
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
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
                ⟳ Spela igen
              </div>
              <h3 style={{ marginTop: 0, marginBottom: 6 }}>Dina senaste rundor</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Ett tryck räcker när du vill köra samma upplägg igen.
              </p>
            </div>

            <div className="new-round-saved-grid">
              {savedSetups.map((setup) => {
                const courseName =
                  courses.find((course) => course.id === setup.courseId)?.name ?? 'Vald bana'
                const label = buildSetupLabel(setup, currentUser.displayName)
                const playersCount = setup.players.length

                return (
                  <button
                    key={setup.id}
                    type="button"
                    disabled={loading}
                    onClick={() => startRoundFromSetup(setup)}
                    style={{
                      padding: '16px',
                      borderRadius: 18,
                      border: '1px solid #86efac',
                      background: '#ffffff',
                      textAlign: 'left',
                      boxShadow: '0 4px 14px rgba(22, 101, 52, 0.05)',
                      cursor: loading ? 'wait' : 'pointer',
                    }}
                  >
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
                        <div style={{ fontSize: 18, fontWeight: 900, color: '#166534' }}>
                          {label}
                        </div>
                        <div style={{ marginTop: 4, fontWeight: 800 }}>{courseName}</div>
                        <div className="muted" style={{ marginTop: 4 }}>
                          {setup.holesMode === 18
                            ? '18 hål'
                            : setup.nineHoleSide === 'back'
                              ? '9 hål · Bakre 9'
                              : '9 hål · Främre 9'}{' '}
                          · {playersCount} spelare
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          background: '#ecfdf3',
                          color: '#166534',
                          fontSize: 12,
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {setup.timesUsed > 1 ? `${setup.timesUsed} gånger` : 'Nyast'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div
        ref={customizeSectionRef}
        className="card"
        style={{ ...heroCardStyle, scrollMarginTop: 24 }}
      >
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 999,
                background: '#ecfdf3',
                color: '#166534',
                fontSize: 12,
                fontWeight: 900,
                marginBottom: 10,
              }}
            >
              ✏️ Anpassa ny runda
            </div>
            <h3 style={{ margin: 0, marginBottom: 6 }}>Snabbstart</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Välj bana och mode – sen är du redo.
            </p>
          </div>

          <div className="stack">
            <div>
              <label htmlFor="title">Rundnamn</label>
              <input
                id="title"
                autoFocus
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
              Välj antal hål och vilken sida ni startar på.
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

            {holesMode === 9 || holesMode === 18 ? (
              <div>
                <label>{holesMode === 18 ? 'Starta på' : 'Vilka 9 hål?'}</label>
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
                        nineHoleSide === 'front' ? '2px solid #166534' : '1px solid #d1d5db',
                      background: nineHoleSide === 'front' ? '#ecfdf3' : '#fff',
                      color: '#0f172a',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    {holesMode === 18 ? 'Främre 9 (hål 1)' : 'Främre 9'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNineHoleSide('back')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border:
                        nineHoleSide === 'back' ? '2px solid #166534' : '1px solid #d1d5db',
                      background: nineHoleSide === 'back' ? '#ecfdf3' : '#fff',
                      color: '#0f172a',
                      fontWeight: 900,
                      cursor: 'pointer',
                    }}
                  >
                    {holesMode === 18 ? 'Bakre 9 (hål 10)' : 'Bakre 9'}
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
              Tryck på en vän så läggs den till direkt i rundan.
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
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
                        ? `${friend.friend_name?.trim() || friend.friend_email.split('@')[0]} · Tillagd`
                        : friend.friend_name?.trim() || friend.friend_email.split('@')[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div
        ref={playerSectionRef}
        className="card"
        style={{ ...sectionCardStyle, scrollMarginTop: 24 }}
      >
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
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Spelare</h3>
              <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Lägg till spelare och justera HCP och tee.
              </p>
            </div>

            <div className="new-round-action-grid">
              <button type="button" className="button" onClick={addRegisteredPlayer}>
                {recentlyAddedType === 'registered'
                  ? 'Spelare tillagd ↓'
                  : '+ Lägg till registrerad spelare'}
              </button>

              <button type="button" className="secondary" onClick={addGuestPlayer}>
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
              Senast spelade med
            </div>

            {loadingRecent ? (
              <div style={{ fontSize: 14, color: '#64748b' }}>Laddar spelare...</div>
            ) : recentPlayers.length === 0 ? (
              <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                Dina senaste spelare dyker upp här efter att du skapat några rundor.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>
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
                      inputMode="decimal"
                      step="0.1"
                      value={player.handicapIndex}
                      onChange={(e) => updatePlayer(index, 'handicapIndex', e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Tee</label>
                    <select
                      value={player.teeKey}
                      onChange={(e) => updatePlayer(index, 'teeKey', e.target.value)}
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

      <div className="card" style={heroCardStyle}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Klar att starta</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              En snabb överblick innan du drar igång.
            </p>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 18,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>Bana</div>
            <div style={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1 }}>{selectedCourseName}</div>

            <div className="new-round-summary-grid">
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>{roundModeLabel}</div>
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>{holesModeLabel}</div>
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>{normalizedPlayersPreview.length}</div>
              </div>
            </div>

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

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

      <div
        className="new-round-sticky-shell"
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 20,
          marginTop: 4,
          paddingTop: 8,
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          background: 'linear-gradient(180deg, rgba(248,251,247,0) 0%, #f8fbf7 26%, #f8fbf7 100%)',
        }}
      >
        <div
          className="new-round-sticky-panel"
          style={{
            padding: 12,
            borderRadius: 20,
            border: '1px solid #dbeedc',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 -8px 24px rgba(15, 23, 42, 0.06)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="new-round-sticky-meta">
            <div className="new-round-sticky-pill">
              <div className="new-round-sticky-pill-label">Bana</div>
              <div className="new-round-sticky-pill-value">{selectedCourseName}</div>
            </div>

            <div className="new-round-sticky-pill">
              <div className="new-round-sticky-pill-label">Spelare</div>
              <div className="new-round-sticky-pill-value">
                {normalizedPlayersPreview.length} klara
              </div>
            </div>

            <div className="new-round-sticky-pill">
              <div className="new-round-sticky-pill-label">Format</div>
              <div className="new-round-sticky-pill-value">
                {roundModeLabel} · {compactHolesLabel}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={loading}
            style={{
              width: '100%',
              minHeight: 58,
              borderRadius: 16,
              fontSize: 18,
              fontWeight: 900,
              border: 'none',
              background: '#166534',
              color: '#ffffff',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {dynamicCtaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
