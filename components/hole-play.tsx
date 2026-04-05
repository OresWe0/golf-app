'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { receivedStrokesOnHole } from '@/lib/scoring'

type Player = {
  id: string
  display_name?: string
  exact_handicap?: number | null
  playing_handicap?: number | null
  tee_key?: 'yellow' | 'red' | string
}

type ScoreRow = {
  round_player_id: string
  strokes: number | null
}

type Hole = {
  hole_number: number
  par: number
  hcp_index: number
}

type LeaderboardEntry = {
  playerId: string
  position: number
  scoreText?: string
  totalPoints?: number
  totalToPar?: number
  totalStrokes?: number
  isLeader?: boolean
}

type Props = {
  roundId: string
  currentHole: number
  totalHoles: number
  startHole: number
  endHole: number
  hole: Hole
  players: Player[]
  scores: ScoreRow[]
  leaderboard?: LeaderboardEntry[]
  playerStreaks?: Record<string, number>
}

export function HolePlay({
  roundId,
  currentHole,
  totalHoles,
  startHole,
  endHole,
  hole,
  players,
  scores,
  leaderboard = [],
  playerStreaks,
}: Props) {
  const router = useRouter()

  const touchStartX = useRef<number | null>(null)
  const firstPlayerCardRef = useRef<HTMLDivElement | null>(null)
  const hasUserChangedScoreRef = useRef(false)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const createValuesFromScores = () =>
    Object.fromEntries(
      players.map((player) => {
        const existing = scores.find((score) => score.round_player_id === player.id)
        return [String(player.id), existing?.strokes?.toString() ?? '']
      })
    )

  const createEmptyValues = () =>
    Object.fromEntries(players.map((player) => [String(player.id), '']))

  const [values, setValues] = useState<Record<string, string>>(createValuesFromScores())
  const [loading, setLoading] = useState(false)
  const [showHoleImage, setShowHoleImage] = useState(false)
  const [holeImageError, setHoleImageError] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [previewHoleNumber, setPreviewHoleNumber] = useState<number>(hole.hole_number)
  const [showFinishModal, setShowFinishModal] = useState(false)

  const allPlayersHaveScores = (candidateValues: Record<string, string>) => {
    if (!players?.length) return false

    return players.every((player) => {
      const value = candidateValues[String(player.id)]
      return value !== '' && value !== undefined && value !== null
    })
  }

  useEffect(() => {
    setValues(createValuesFromScores())
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
    hasUserChangedScoreRef.current = false
    setSavedFlash(false)
    setShowFinishModal(false)

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }

    const timer = setTimeout(() => {
      firstPlayerCardRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 80)

    return () => clearTimeout(timer)
  }, [hole.hole_number, scores])

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!hasUserChangedScoreRef.current) return
    if (loading) return
    if (!allPlayersHaveScores(values)) return

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      void saveScores(values)
    }, 300)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [values, loading, players])

  const quickScores = useMemo(() => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8]
    const extra = hole.par + 4
    return Array.from(new Set([...base, extra])).sort((a, b) => a - b)
  }, [hole.par])

  const holeImageSrc = `/course-images/karsta/${previewHoleNumber}.jpg`

  const leaderboardByPlayerId = useMemo(() => {
    return new Map(leaderboard.map((entry) => [String(entry.playerId), entry]))
  }, [leaderboard])

  const topLeaderboard = useMemo(() => {
    return [...leaderboard]
      .sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position

        const aPoints = a.totalPoints ?? -999
        const bPoints = b.totalPoints ?? -999
        return bPoints - aPoints
      })
      .slice(0, 3)
  }, [leaderboard])

  const leaderIds = useMemo(() => {
    const leaders = leaderboard.filter((entry) => entry.position === 1)
    return new Set(leaders.map((entry) => String(entry.playerId)))
  }, [leaderboard])

  const goPrevious = () => {
    const target =
      currentHole > startHole
        ? `/rounds/${roundId}?hole=${currentHole - 1}`
        : '/dashboard'
    router.push(target)
  }

  const goNext = () => {
    const target =
      currentHole === endHole
        ? `/rounds/${roundId}/summary`
        : `/rounds/${roundId}?hole=${currentHole + 1}`
    router.push(target)
  }

  const confirmFinishRound = async () => {
    const response = await fetch(`/api/rounds/${roundId}/complete`, {
      method: 'POST',
    })

    if (!response.ok) {
      alert('Kunde inte avsluta rundan.')
      return
    }

    router.push(`/rounds/${roundId}/summary`)
  }

  const saveScores = async (overrideValues?: Record<string, string>) => {
    const valuesToSave = overrideValues ?? values
    if (loading) return
    if (!allPlayersHaveScores(valuesToSave)) return

    setLoading(true)

    const response = await fetch(`/api/rounds/${roundId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holeNumber: currentHole,
        scores: players.map((player) => ({
          roundPlayerId: player.id,
          strokes: valuesToSave[String(player.id)]
            ? Number(valuesToSave[String(player.id)])
            : null,
        })),
      }),
    })

    if (!response.ok) {
      setLoading(false)
      alert('Det gick inte att spara score. Prova igen.')
      return
    }

    setLoading(false)
    setSavedFlash(true)
    setValues(createEmptyValues())
    hasUserChangedScoreRef.current = false

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([25, 20, 25])
    }

    setTimeout(() => {
      if (currentHole === endHole) {
        setShowFinishModal(true)
        return
      }

      router.push(`/rounds/${roundId}?hole=${currentHole + 1}`)
    }, 260)
  }

  const setScore = (playerId: string, score: number) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }

    hasUserChangedScoreRef.current = true
    setValues((prev) => ({
      ...prev,
      [String(playerId)]: String(score),
    }))
  }

  const getLabel = (score: number, par: number) => {
    if (score === 1) return 'HIO'

    const diff = score - par

    if (diff <= -3) return 'Albatross'
    if (diff === -2) return 'Eagle'
    if (diff === -1) return 'Birdie'
    if (diff === 0) return 'Par'
    if (diff === 1) return 'Bogey'
    return 'Double+'
  }

  const getScoreTone = (score: number) => {
    const diff = score - hole.par

    if (diff <= -2) {
      return {
        background: 'linear-gradient(135deg, #14532d 0%, #15803d 100%)',
        border: '2px solid #166534',
        color: '#ffffff',
        glow: 'rgba(21, 128, 61, 0.28)',
      }
    }

    if (diff === -1) {
      return {
        background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
        border: '2px solid #15803d',
        color: '#ffffff',
        glow: 'rgba(34, 197, 94, 0.26)',
      }
    }

    if (diff === 0) {
      return {
        background: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
        border: '2px solid #15803d',
        color: '#ffffff',
        glow: 'rgba(34, 197, 94, 0.24)',
      }
    }

    if (diff === 1) {
      return {
        background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
        border: '2px solid #ea580c',
        color: '#ffffff',
        glow: 'rgba(249, 115, 22, 0.22)',
      }
    }

    return {
      background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
      border: '2px solid #b91c1c',
      color: '#ffffff',
      glow: 'rgba(220, 38, 38, 0.20)',
    }
  }

  const openHoleImage = () => {
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
    setShowHoleImage(true)
  }

  const closeHoleImage = () => {
    setShowHoleImage(false)
  }

  const previewPreviousHole = () => {
    if (previewHoleNumber > startHole) {
      setPreviewHoleNumber((prev) => prev - 1)
      setHoleImageError(false)
    }
  }

  const previewNextHole = () => {
    if (previewHoleNumber < endHole) {
      setPreviewHoleNumber((prev) => prev + 1)
      setHoleImageError(false)
    }
  }

  const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
    const startX = touchStartX.current
    const endX = e.changedTouches[0]?.clientX ?? null
    if (startX == null || endX == null) return

    const diff = endX - startX

    if (showHoleImage) {
      if (diff > 70 && previewHoleNumber > startHole) previewPreviousHole()
      if (diff < -70 && previewHoleNumber < endHole) previewNextHole()
      touchStartX.current = null
      return
    }

    if (diff > 70 && currentHole > startHole) goPrevious()
    if (diff < -70 && currentHole < endHole) goNext()

    touchStartX.current = null
  }

  useEffect(() => {
    if (!showHoleImage) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHoleImage()
      if (e.key === 'ArrowLeft' && previewHoleNumber > startHole) previewPreviousHole()
      if (e.key === 'ArrowRight' && previewHoleNumber < endHole) previewNextHole()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showHoleImage, previewHoleNumber, startHole, endHole])

  return (
    <>
      <style>{`
        @keyframes scorePop {
          0% { transform: scale(0.92); }
          55% { transform: scale(1.07); }
          100% { transform: scale(1.03); }
        }

        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes softPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.22); }
          100% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
        }

        @keyframes savedToastIn {
          0% { opacity: 0; transform: translateY(-10px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes glassCardIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.985); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes badgeFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-2px); }
          100% { transform: translateY(0px); }
        }

        @keyframes modalIn {
          0% { opacity: 0; transform: translateY(18px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        style={{
          paddingBottom: 132,
          display: 'grid',
          gap: 14,
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {savedFlash ? (
          <div
            style={{
              position: 'sticky',
              top: 12,
              zIndex: 40,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                color: '#fff',
                fontWeight: 800,
                boxShadow: '0 14px 34px rgba(22, 101, 52, 0.28)',
                backdropFilter: 'blur(8px)',
                animation: 'savedToastIn 0.18s ease',
              }}
            >
              Score sparad ✅
            </div>
          </div>
        ) : null}

        <div
          style={{
            border: '1px solid rgba(255,255,255,0.55)',
            borderRadius: 28,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(244,248,244,0.78) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
            padding: 16,
            display: 'grid',
            gap: 14,
            animation: 'glassCardIn 0.22s ease',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
              gap: 12,
            }}
          >
            <div
              style={{
                borderRadius: 24,
                background:
                  'linear-gradient(135deg, rgba(236,253,245,0.92) 0%, rgba(220,252,231,0.88) 100%)',
                border: '1px solid rgba(134, 239, 172, 0.65)',
                padding: 16,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: '#166534',
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Hål
              </div>
              <div style={{ fontSize: 58, lineHeight: 1, fontWeight: 900, color: '#0f172a' }}>
                {hole.hole_number}
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: '#475569',
                  fontWeight: 700,
                }}
              >
                {Math.max(currentHole - startHole + 1, 1)} / {totalHoles}
              </div>
            </div>

            <div
              style={{
                borderRadius: 24,
                background: 'rgba(255,255,255,0.84)',
                border: '1px solid rgba(209,213,219,0.75)',
                padding: 16,
                display: 'grid',
                gap: 12,
                alignContent: 'center',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'baseline',
                }}
              >
                <div className="muted">Par</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{hole.par}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  alignItems: 'baseline',
                }}
              >
                <div className="muted">Index</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{hole.hcp_index}</div>
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: 22,
              padding: 14,
              background:
                'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.90) 100%)',
              color: '#fff',
              display: 'grid',
              gap: 10,
              boxShadow: '0 20px 44px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.75, letterSpacing: 0.4 }}>
                  LIVE LEADERBOARD
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>
                  Vem leder just nu
                </div>
              </div>

              <button
                type="button"
                onClick={openHoleImage}
                style={{
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 10px 24px rgba(34, 197, 94, 0.24)',
                }}
              >
                ⛳ Se banan
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {topLeaderboard.map((entry) => {
                const player = players.find((p) => String(p.id) === String(entry.playerId))
                const isLeader = entry.position === 1

                return (
                  <div
                    key={`lb-${entry.playerId}`}
                    style={{
                      borderRadius: 18,
                      padding: 12,
                      background: isLeader
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.22) 0%, rgba(22,163,74,0.14) 100%)'
                        : 'rgba(255,255,255,0.08)',
                      border: isLeader
                        ? '1px solid rgba(74, 222, 128, 0.40)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 800 }}>
                      #{entry.position}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontWeight: 900,
                        fontSize: 16,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {player?.display_name ?? 'Spelare'}
                    </div>
                    <div style={{ marginTop: 4, opacity: 0.82, fontSize: 13, fontWeight: 700 }}>
                      {entry.totalPoints != null
                        ? `${entry.totalPoints} p`
                        : entry.scoreText ?? '-'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {players.map((player, index) => {
            const playerId = String(player.id)
            const selectedValue = values[playerId]
            const selectedScore = selectedValue ? Number(selectedValue) : null
            const selectedTone =
              selectedScore == null
                ? null
                : getScoreTone(selectedScore)

            const received = receivedStrokesOnHole(
              player.playing_handicap ?? 0,
              hole.hcp_index,
              totalHoles
            )

            const leaderboardMeta = leaderboardByPlayerId.get(playerId)
            const isLeader = leaderIds.has(playerId)
            const streak = playerStreaks?.[playerId] ?? 0
            const showHotStreak = streak >= 2

            return (
              <div
                key={player.id}
                ref={index === 0 ? firstPlayerCardRef : null}
                style={{
                  border: isLeader
                    ? '1px solid rgba(74, 222, 128, 0.44)'
                    : '1px solid rgba(255,255,255,0.60)',
                  borderRadius: 28,
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(248,250,252,0.78) 100%)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  boxShadow: isLeader
                    ? '0 22px 54px rgba(34, 197, 94, 0.12)'
                    : '0 18px 44px rgba(15, 23, 42, 0.07)',
                  padding: 16,
                  display: 'grid',
                  gap: 14,
                  animation: 'glassCardIn 0.22s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        wordBreak: 'break-word',
                        color: '#1f3327',
                      }}
                    >
                      {player.display_name ?? 'Spelare'}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        color: '#64748b',
                        lineHeight: 1.35,
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      Hål {hole.hole_number} · {leaderboardMeta?.totalPoints ?? '-'} p
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: '#475569',
                        fontWeight: 800,
                        fontSize: 15,
                      }}
                    >
                      Erhållna slag: {received}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {isLeader ? (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                          color: '#fff',
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 10px 22px rgba(34, 197, 94, 0.22)',
                          animation: 'badgeFloat 2s ease-in-out infinite',
                        }}
                      >
                        👑 Leder nu
                      </div>
                    ) : null}

                    {showHotStreak ? (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                          color: '#fff',
                          fontWeight: 900,
                          whiteSpace: 'nowrap',
                          boxShadow: '0 10px 22px rgba(249, 115, 22, 0.20)',
                        }}
                      >
                        🔥 Hot streak
                      </div>
                    ) : null}

                    {leaderboardMeta?.position ? (
                      <div
                        style={{
                          padding: '8px 12px',
                          borderRadius: 999,
                          background: 'rgba(255,255,255,0.72)',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                          color: '#334155',
                          border: '1px solid rgba(203,213,225,0.9)',
                        }}
                      >
                        #{leaderboardMeta.position}
                      </div>
                    ) : null}

                    <div
                      style={{
                        padding: '8px 12px',
                        borderRadius: 999,
                        background: 'rgba(241,245,249,0.85)',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        color: '#1f3327',
                      }}
                    >
                      {player.tee_key === 'red' ? 'Röd tee' : 'Gul tee'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 10,
                  }}
                >
                  {quickScores.map((score) => {
                    const label = getLabel(score, hole.par)
                    const isSelected = selectedValue === String(score)
                    const tone = getScoreTone(score)

                    return (
                      <button
                        key={`${player.id}-${score}`}
                        type="button"
                        onClick={() => setScore(playerId, score)}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'scale(0.96)'
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = isSelected ? 'scale(1.03)' : 'scale(1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = isSelected ? 'scale(1.03)' : 'scale(1)'
                        }}
                        style={{
                          position: 'relative',
                          overflow: 'hidden',
                          borderRadius: 22,
                          padding: '16px 8px',
                          cursor: 'pointer',
                          minHeight: 92,
                          display: 'grid',
                          placeItems: 'center',
                          gap: 4,
                          background: isSelected ? tone.background : 'rgba(255,255,255,0.78)',
                          border: isSelected ? tone.border : '1px solid #d1d5db',
                          color: isSelected ? tone.color : '#0f172a',
                          boxShadow: isSelected
                            ? `0 0 0 3px ${tone.glow}, 0 14px 30px rgba(15, 23, 42, 0.16)`
                            : '0 3px 10px rgba(15, 23, 42, 0.04)',
                          transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                          transition:
                            'transform 0.14s ease, box-shadow 0.18s ease, background 0.18s ease, border 0.18s ease, color 0.18s ease',
                          animation: isSelected ? 'scorePop 0.22s ease, softPulse 0.5s ease' : 'none',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            lineHeight: 1,
                          }}
                        >
                          {score}
                        </div>

                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            textAlign: 'center',
                            opacity: isSelected ? 1 : 0.75,
                            letterSpacing: 0.2,
                          }}
                        >
                          {label}
                        </div>

                        <span
                          style={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 22,
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)'
                              : 'transparent',
                            pointerEvents: 'none',
                          }}
                        />
                      </button>
                    )
                  })}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'stretch',
                  }}
                >
                  <div
                    style={{
                      border:
                        selectedScore == null
                          ? '1px solid #d1d5db'
                          : selectedTone?.border,
                      borderRadius: 20,
                      padding: '12px 14px',
                      background:
                        selectedScore == null
                          ? 'rgba(248,250,252,0.9)'
                          : selectedTone?.background,
                      display: 'grid',
                      gap: 6,
                      alignContent: 'center',
                      boxShadow:
                        selectedScore == null
                          ? 'none'
                          : `0 0 0 3px ${selectedTone?.glow}, 0 10px 24px rgba(15, 23, 42, 0.10)`,
                      transition: 'all 0.18s ease',
                      animation: selectedScore == null ? 'none' : 'fadeSlideUp 0.18s ease',
                    }}
                  >
                    <div
                      className="muted"
                      style={{
                        fontSize: 13,
                        color: selectedScore == null ? '#64748b' : 'rgba(255,255,255,0.86)',
                      }}
                    >
                      Vald score
                    </div>

                    <div
                      style={{
                        fontSize: 34,
                        fontWeight: 900,
                        lineHeight: 1,
                        color: selectedScore == null ? '#0f172a' : '#ffffff',
                      }}
                    >
                      {selectedScore ?? '-'}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: selectedScore == null ? '#64748b' : '#ffffff',
                      }}
                    >
                      {selectedScore == null ? 'Välj antal slag' : getLabel(selectedScore, hole.par)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      hasUserChangedScoreRef.current = true
                      setValues((prev) => ({ ...prev, [playerId]: '' }))
                    }}
                    style={{
                      border: '1px solid rgba(209,213,219,0.95)',
                      background: 'rgba(255,255,255,0.84)',
                      borderRadius: 20,
                      padding: '12px 14px',
                      minWidth: 92,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      gap: 4,
                      color: '#475569',
                      boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)',
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>↺</span>
                    <span style={{ fontSize: 13 }}>Rensa</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            padding: '16px 16px 20px',
            background:
              'linear-gradient(180deg, rgba(248,251,247,0) 0%, rgba(248,251,247,0.92) 24%, rgba(248,251,247,0.98) 100%)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '108px 1fr',
              gap: 12,
              maxWidth: 960,
              margin: '0 auto',
            }}
          >
            <button
              type="button"
              onClick={goPrevious}
              style={{
                border: 'none',
                borderRadius: 24,
                minHeight: 72,
                background: 'linear-gradient(135deg, #1f6f32 0%, #2f7f37 100%)',
                color: '#fff',
                fontSize: 28,
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 16px 32px rgba(31, 111, 50, 0.22)',
              }}
            >
              ←
            </button>

            <button
              type="button"
              onClick={() => void saveScores()}
              disabled={loading || !allPlayersHaveScores(values)}
              style={{
                border: 'none',
                borderRadius: 24,
                minHeight: 72,
                background:
                  loading || !allPlayersHaveScores(values)
                    ? 'linear-gradient(135deg, #94a3b8 0%, #a8b4c7 100%)'
                    : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 45%, #22c55e 100%)',
                color: '#fff',
                fontSize: 18,
                fontWeight: 900,
                cursor:
                  loading || !allPlayersHaveScores(values)
                    ? 'not-allowed'
                    : 'pointer',
                boxShadow:
                  loading || !allPlayersHaveScores(values)
                    ? 'none'
                    : '0 18px 38px rgba(37, 99, 235, 0.20)',
                letterSpacing: 0.2,
              }}
            >
              {loading
                ? 'Sparar...'
                : currentHole === endHole
                  ? 'Avsluta runda →'
                  : 'Nästa hål →'}
            </button>
          </div>
        </div>
      </div>

      {showHoleImage ? (
        <div
          onClick={closeHoleImage}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(100%, 980px)',
              maxHeight: '90vh',
              borderRadius: 28,
              overflow: 'hidden',
              background: '#0f172a',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              boxShadow: '0 28px 80px rgba(15, 23, 42, 0.44)',
              animation: 'modalIn 0.22s ease',
            }}
          >
            <div
              style={{
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                color: '#fff',
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>
                Hål {previewHoleNumber}
              </div>

              <button
                type="button"
                onClick={closeHoleImage}
                style={{
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  borderRadius: 14,
                  padding: '10px 12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Stäng
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                background: '#111827',
                minHeight: 280,
              }}
            >
              {holeImageError ? (
                <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
                  Ingen hålbild hittades för hål {previewHoleNumber}.
                </div>
              ) : (
                <img
                  src={holeImageSrc}
                  alt={`Hål ${previewHoleNumber}`}
                  onError={() => setHoleImageError(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    maxHeight: '70vh',
                    objectFit: 'contain',
                  }}
                />
              )}
            </div>

            <div
              style={{
                padding: 14,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                background: '#0f172a',
              }}
            >
              <button
                type="button"
                onClick={previewPreviousHole}
                disabled={previewHoleNumber <= startHole}
                style={{
                  border: 'none',
                  borderRadius: 18,
                  padding: '14px 16px',
                  background:
                    previewHoleNumber <= startHole
                      ? '#475569'
                      : 'linear-gradient(135deg, #1f6f32 0%, #2f7f37 100%)',
                  color: '#fff',
                  fontWeight: 900,
                  cursor:
                    previewHoleNumber <= startHole ? 'not-allowed' : 'pointer',
                }}
              >
                ← Föregående
              </button>

              <button
                type="button"
                onClick={previewNextHole}
                disabled={previewHoleNumber >= endHole}
                style={{
                  border: 'none',
                  borderRadius: 18,
                  padding: '14px 16px',
                  background:
                    previewHoleNumber >= endHole
                      ? '#475569'
                      : 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                  color: '#fff',
                  fontWeight: 900,
                  cursor:
                    previewHoleNumber >= endHole ? 'not-allowed' : 'pointer',
                }}
              >
                Nästa →
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showFinishModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.52)',
            backdropFilter: 'blur(10px)',
            zIndex: 200,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 430,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,252,0.92) 100%)',
              border: '1px solid rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px)',
              borderRadius: 28,
              padding: 22,
              display: 'grid',
              gap: 16,
              textAlign: 'center',
              boxShadow: '0 28px 70px rgba(15, 23, 42, 0.20)',
              animation: 'modalIn 0.2s ease',
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 900 }}>
              🎉 Rundan är klar!
            </div>

            <div style={{ color: '#475569', fontSize: 15, lineHeight: 1.55 }}>
              Vill du avsluta rundan och gå vidare till leaderboard och scorekort?
            </div>

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
                onClick={() => setShowFinishModal(false)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 18,
                  padding: '14px',
                  fontWeight: 800,
                  background: 'rgba(255,255,255,0.84)',
                  cursor: 'pointer',
                  color: '#0f172a',
                }}
              >
                Avbryt
              </button>

              <button
                type="button"
                onClick={confirmFinishRound}
                style={{
                  border: 'none',
                  borderRadius: 18,
                  padding: '14px',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 12px 26px rgba(22, 101, 52, 0.22)',
                }}
              >
                Bekräfta
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}