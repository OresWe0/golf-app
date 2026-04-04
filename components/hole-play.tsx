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

    setSavedFlash(true)
    setValues(createEmptyValues())
    hasUserChangedScoreRef.current = false

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([25, 20, 25])
    }

    setTimeout(() => {
      const target =
        currentHole === endHole
          ? `/rounds/${roundId}/summary`
          : `/rounds/${roundId}?hole=${currentHole + 1}`
      router.push(target)
    }, 260)
  }

  const setScore = (playerId: string, score: number) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10)
    }

    hasUserChangedScoreRef.current = true
    setValues((prev) => ({
      ...prev,
      [String(playerId)]: String(score),
    }))
  }

  const getLabel = (diff: number) => {
    if (diff === 0) return 'Par'
    if (diff === -1) return 'Birdie'
    if (diff === -2) return 'Eagle'
    if (diff <= -3) return 'Albatross'
    if (diff === 1) return 'Bogey'
    if (diff >= 2) return 'Double+'
    return ''
  }

  const getScoreButtonStyle = (score: number, isSelected: boolean) => {
    const diff = score - hole.par

    if (isSelected) {
      if (diff <= -1) {
        return {
          background: '#dcfce7',
          border: '2px solid #22c55e',
          color: '#166534',
        }
      }

      if (diff === 0) {
        return {
          background: '#f8fafc',
          border: '2px solid #94a3b8',
          color: '#0f172a',
        }
      }

      return {
        background: '#fee2e2',
        border: '2px solid #f87171',
        color: '#991b1b',
      }
    }

    return {
      background: '#ffffff',
      border: '1px solid #d1d5db',
      color: '#0f172a',
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
          gap: 16,
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
              gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
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
                  marginBottom: 8,
                }}
              >
                Hål
              </div>
              <div style={{ fontSize: 52, lineHeight: 1, fontWeight: 900 }}>
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
                gap: 14,
                alignContent: 'space-between',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div className="muted">Par</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{hole.par}</div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
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
              padding: '18px 20px',
              background: '#3fb950',
              color: '#fff',
              fontSize: 18,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            ⛳ Se banan
          </button>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          {players.map((player, index) => {
            const playerId = String(player.id)
            const selectedValue = values[playerId]
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
                  gap: 16,
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
                      <br />
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
                    gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                    gap: 10,
                  }}
                >
                  {quickScores.map((score) => {
                    const diff = score - hole.par
                    const label = getLabel(diff)
                    const isSelected = selectedValue === String(score)
                    const styles = getScoreButtonStyle(score, isSelected)

                    return (
                      <button
                        key={`${player.id}-${score}`}
                        type="button"
                        onClick={() => setScore(playerId, score)}
                        style={{
                          borderRadius: 22,
                          padding: '18px 10px',
                          cursor: 'pointer',
                          minHeight: 110,
                          display: 'grid',
                          placeItems: 'center',
                          gap: 6,
                          fontWeight: 900,
                          ...styles,
                        }}
                      >
                        <div style={{ fontSize: 18 }}>{score}</div>
                        <div style={{ fontSize: 13, opacity: label ? 1 : 0.55 }}>
                          {label || ' '}
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
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 16,
                      padding: '12px 14px',
                      background: '#f8fafc',
                    }}
                  >
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      Vald score
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>
                      {selectedValue || '-'}
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
                      background: '#fff',
                      borderRadius: 14,
                      padding: '12px 14px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Rensa
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
              gridTemplateColumns: '110px 1fr',
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
                borderRadius: 24,
                minHeight: 72,
                background:
                  loading || !allPlayersHaveScores(values) ? '#94a3b8' : '#166534',
                color: '#fff',
                fontSize: 18,
                fontWeight: 900,
                cursor:
                  loading || !allPlayersHaveScores(values) ? 'not-allowed' : 'pointer',
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
    </>
  )
}