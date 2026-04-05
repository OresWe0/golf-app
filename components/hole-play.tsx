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

type Props = {
  roundId: string
  currentHole: number
  totalHoles: number
  startHole: number
  endHole: number
  hole: Hole
  players: Player[]
  scores: ScoreRow[]
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
        background: '#15803d',
        border: '2px solid #166534',
        color: '#ffffff',
        glow: 'rgba(21, 128, 61, 0.30)',
      }
    }

    if (diff === -1) {
      return {
        background: '#16a34a',
        border: '2px solid #15803d',
        color: '#ffffff',
        glow: 'rgba(34, 197, 94, 0.28)',
      }
    }

    if (diff === 0) {
      return {
        background: '#22c55e',
        border: '2px solid #15803d',
        color: '#ffffff',
        glow: 'rgba(34, 197, 94, 0.30)',
      }
    }

    if (diff === 1) {
      return {
        background: '#f97316',
        border: '2px solid #ea580c',
        color: '#ffffff',
        glow: 'rgba(249, 115, 22, 0.24)',
      }
    }

    return {
      background: '#dc2626',
      border: '2px solid #b91c1c',
      color: '#ffffff',
      glow: 'rgba(220, 38, 38, 0.22)',
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
      <div
        style={{
          paddingBottom: 120,
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
              zIndex: 20,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                background: '#166534',
                color: '#fff',
                fontWeight: 800,
                boxShadow: '0 10px 30px rgba(22, 101, 52, 0.25)',
              }}
            >
              Score sparad ✅
            </div>
          </div>
        ) : null}

        <div
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 24,
            background: '#f8fbf7',
            padding: 16,
            display: 'grid',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.95fr)',
              gap: 12,
            }}
          >
            <div
              style={{
                borderRadius: 20,
                background: '#eef7ef',
                border: '1px solid #bbf7d0',
                padding: 16,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#166534',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Hål
              </div>
              <div style={{ fontSize: 56, lineHeight: 1, fontWeight: 900 }}>
                {hole.hole_number}
              </div>
              <div className="muted" style={{ marginTop: 8 }}>
                {Math.max(currentHole - startHole + 1, 1)} / {totalHoles}
              </div>
            </div>

            <div
              style={{
                borderRadius: 20,
                background: '#ffffff',
                border: '1px solid #d1d5db',
                padding: 16,
                display: 'grid',
                gap: 12,
                alignContent: 'center',
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

          <button
            type="button"
            onClick={openHoleImage}
            style={{
              border: 'none',
              borderRadius: 20,
              padding: '16px 18px',
              background: '#4dbd4a',
              color: '#fff',
              fontSize: 18,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ⛳ Se banan
          </button>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {players.map((player, index) => {
            const playerId = String(player.id)
            const selectedValue = values[playerId]
            const selectedScore = selectedValue ? Number(selectedValue) : null
            const received = receivedStrokesOnHole(
              player.playing_handicap ?? 0,
              hole.hcp_index,
              totalHoles
            )

            return (
              <div
                key={player.id}
                ref={index === 0 ? firstPlayerCardRef : null}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 24,
                  background: '#ffffff',
                  padding: 16,
                  display: 'grid',
                  gap: 14,
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
                      }}
                    >
                      {player.display_name ?? 'Spelare'}
                    </div>

                    <div className="muted" style={{ marginTop: 4, lineHeight: 1.35 }}>
                      HCP {player.exact_handicap ?? '-'} · Spel-HCP{' '}
                      {player.playing_handicap ?? 0}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        color: '#475569',
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      Erhållna slag: {received}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 999,
                      background: '#f3f4f6',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {player.tee_key === 'red' ? 'Röd tee' : 'Gul tee'}
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
                        style={{
                          borderRadius: 20,
                          padding: '16px 8px',
                          cursor: 'pointer',
                          minHeight: 92,
                          display: 'grid',
                          placeItems: 'center',
                          gap: 4,
                          background: isSelected ? tone.background : '#fff',
                          border: isSelected ? tone.border : '1px solid #d1d5db',
                          color: isSelected ? tone.color : '#0f172a',
                          boxShadow: isSelected
                            ? `0 0 0 3px ${tone.glow}, 0 10px 24px rgba(15, 23, 42, 0.14)`
                            : 'none',
                          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s ease',
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
                          : '2px solid #86efac',
                      borderRadius: 18,
                      padding: '12px 14px',
                      background: selectedScore == null ? '#f8fafc' : '#f0fdf4',
                      display: 'grid',
                      gap: 6,
                      alignContent: 'center',
                    }}
                  >
                    <div className="muted" style={{ fontSize: 13 }}>
                      Vald score
                    </div>

                    <div
                      style={{
                        fontSize: 34,
                        fontWeight: 900,
                        lineHeight: 1,
                        color: selectedScore == null ? '#0f172a' : '#166534',
                      }}
                    >
                      {selectedScore ?? '-'}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: selectedScore == null ? '#64748b' : '#166534',
                      }}
                    >
                      {selectedScore == null
                        ? 'Välj antal slag'
                        : getLabel(selectedScore, hole.par)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      hasUserChangedScoreRef.current = true
                      setValues((prev) => ({ ...prev, [playerId]: '' }))
                    }}
                    style={{
                      border: '1px solid #d1d5db',
                      background: '#ffffff',
                      borderRadius: 18,
                      padding: '12px 14px',
                      minWidth: 92,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'grid',
                      placeItems: 'center',
                      gap: 4,
                      color: '#475569',
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
            padding: 16,
            background:
              'linear-gradient(180deg, rgba(248,251,247,0) 0%, rgba(248,251,247,0.96) 25%, rgba(248,251,247,1) 100%)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr',
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
                borderRadius: 22,
                minHeight: 68,
                background: '#1f6f32',
                color: '#fff',
                fontSize: 28,
                fontWeight: 900,
                cursor: 'pointer',
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
                borderRadius: 22,
                minHeight: 68,
                background:
                  loading || !allPlayersHaveScores(values) ? '#94a3b8' : '#166534',
                color: '#fff',
                fontSize: 18,
                fontWeight: 900,
                cursor:
                  loading || !allPlayersHaveScores(values)
                    ? 'not-allowed'
                    : 'pointer',
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
            background: 'rgba(15, 23, 42, 0.82)',
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
              borderRadius: 24,
              overflow: 'hidden',
              background: '#0f172a',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
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
                  borderRadius: 12,
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
                  borderRadius: 16,
                  padding: '14px 16px',
                  background:
                    previewHoleNumber <= startHole ? '#475569' : '#1f6f32',
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
                  borderRadius: 16,
                  padding: '14px 16px',
                  background:
                    previewHoleNumber >= endHole ? '#475569' : '#166534',
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
            background: 'rgba(15, 23, 42, 0.6)',
            zIndex: 200,
            display: 'grid',
            placeItems: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#ffffff',
              borderRadius: 24,
              padding: 20,
              display: 'grid',
              gap: 16,
              textAlign: 'center',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              🎉 Rundan är klar!
            </div>

            <div style={{ color: '#475569', fontSize: 15, lineHeight: 1.5 }}>
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
                  borderRadius: 16,
                  padding: '14px',
                  fontWeight: 800,
                  background: '#fff',
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
                  borderRadius: 16,
                  padding: '14px',
                  fontWeight: 900,
                  background: '#166534',
                  color: '#fff',
                  cursor: 'pointer',
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