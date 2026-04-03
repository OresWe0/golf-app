'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { receivedStrokesOnHole } from '@/lib/scoring'

export function HolePlay({
  roundId,
  currentHole,
  totalHoles,
  startHole,
  endHole,
  hole,
  players,
  scores,
}: any) {
  const touchStartX = useRef<number | null>(null)

  const createValuesFromScores = () =>
    Object.fromEntries(
      players.map((player: any) => {
        const existing = scores.find((score: any) => score.round_player_id === player.id)
        return [player.id, existing?.strokes?.toString() ?? '']
      })
    )

  const emptyValues = Object.fromEntries(
    players.map((player: any) => [player.id, ''])
  )

  const [values, setValues] = useState<Record<string, string>>(createValuesFromScores())
  const [loading, setLoading] = useState(false)
  const [showHoleImage, setShowHoleImage] = useState(false)
  const [holeImageError, setHoleImageError] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)
  const [previewHoleNumber, setPreviewHoleNumber] = useState<number>(hole.hole_number)

  useEffect(() => {
    setValues(createValuesFromScores())
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
  }, [hole.hole_number, scores])

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

    window.location.href = target
  }

  const goNext = () => {
    const target =
      currentHole === endHole
        ? `/rounds/${roundId}/summary`
        : `/rounds/${roundId}?hole=${currentHole + 1}`

    window.location.href = target
  }

  const saveScores = async () => {
    setLoading(true)

    const response = await fetch(`/api/rounds/${roundId}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        holeNumber: currentHole,
        scores: players.map((player: any) => ({
          roundPlayerId: player.id,
          strokes: values[player.id] ? Number(values[player.id]) : null,
        })),
      }),
    })

    if (!response.ok) {
      setLoading(false)
      alert('Det gick inte att spara score. Prova igen.')
      return
    }

    setSavedFlash(true)
    setValues(emptyValues)

    setTimeout(() => {
      const target =
        currentHole === endHole
          ? `/rounds/${roundId}/summary`
          : `/rounds/${roundId}?hole=${currentHole + 1}`

      window.location.href = target
    }, 450)
  }

  const setScore = (playerId: string, score: number) => {
    if (typeof window !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20)
    }

    setValues((prev) => ({
      ...prev,
      [playerId]: String(score),
    }))
  }

  const getLabel = (diff: number) => {
    if (diff === 0) return 'Par'
    if (diff === -1) return 'Birdie'
    if (diff === -2) return 'Eagle'
    if (diff === 1) return 'Bogey'
    if (diff >= 2) return 'Double+'
    return ''
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
      setPreviewHoleNumber((prev: number) => prev - 1)
      setHoleImageError(false)
    }
  }

  const previewNextHole = () => {
    if (previewHoleNumber < endHole) {
      setPreviewHoleNumber((prev: number) => prev + 1)
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
      if (diff > 70 && previewHoleNumber > startHole) {
        previewPreviousHole()
      }

      if (diff < -70 && previewHoleNumber < endHole) {
        previewNextHole()
      }

      touchStartX.current = null
      return
    }

    if (diff > 70 && currentHole > startHole) {
      goPrevious()
    }

    if (diff < -70 && currentHole < endHole) {
      goNext()
    }

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
    <div
      style={{ paddingBottom: 100 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {savedFlash && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#166534',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            zIndex: 120,
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
          }}
        >
          Sparat för hål {currentHole} ✅
        </div>
      )}

      {showHoleImage && (
        <div
          onClick={closeHoleImage}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(8px)',
            zIndex: 110,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 980,
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '16px 18px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                background: '#fcfcfc',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: '#eef6ee',
                    color: '#14532d',
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Hål {previewHoleNumber}
                </div>

                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                  Banbild
                </div>

                <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
                  Bläddra mellan hålen med pilarna
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  onClick={previewPreviousHole}
                  disabled={previewHoleNumber <= startHole}
                  style={{
                    border: '1px solid #d1d5db',
                    background: previewHoleNumber <= startHole ? '#f8fafc' : '#fff',
                    color: previewHoleNumber <= startHole ? '#94a3b8' : '#0f172a',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: previewHoleNumber <= startHole ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Föregående
                </button>

                <button
                  type="button"
                  onClick={previewNextHole}
                  disabled={previewHoleNumber >= endHole}
                  style={{
                    border: '1px solid #d1d5db',
                    background: previewHoleNumber >= endHole ? '#f8fafc' : '#fff',
                    color: previewHoleNumber >= endHole ? '#94a3b8' : '#0f172a',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: previewHoleNumber >= endHole ? 'not-allowed' : 'pointer',
                  }}
                >
                  Nästa →
                </button>

                <button
                  type="button"
                  onClick={closeHoleImage}
                  style={{
                    border: '1px solid #d1d5db',
                    background: '#fff',
                    borderRadius: 14,
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: 14,
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  Stäng
                </button>
              </div>
            </div>

            <div
              style={{
                padding: 16,
                background: '#f8fafc',
                overflow: 'auto',
              }}
            >
              {holeImageError ? (
                <div
                  style={{
                    minHeight: 280,
                    borderRadius: 18,
                    background: '#ffffff',
                    border: '1px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: 24,
                    color: '#64748b',
                    fontSize: 16,
                    lineHeight: 1.5,
                  }}
                >
                  Ingen banbild finns för hål {previewHoleNumber} ännu.
                </div>
              ) : (
                <div
                  style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <img
                    src={holeImageSrc}
                    alt={`Banbild för hål ${previewHoleNumber}`}
                    onError={() => setHoleImageError(true)}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 'auto',
                      maxHeight: '68vh',
                      objectFit: 'contain',
                      background: '#fff',
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div
        className="card"
        style={{
          padding: 14,
          marginBottom: 12,
          background: '#ffffffee',
          backdropFilter: 'blur(6px)',
          borderRadius: 22,
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 10,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: 10,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 18,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#166534',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Hål
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {hole.hole_number}
              </div>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                padding: 14,
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Par</span>
                <span style={{ fontSize: 24, fontWeight: 900 }}>{hole.par}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Index</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>
                  {hole.hcp_index}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openHoleImage}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 12,
              border: '1px solid #bbf7d0',
              background: '#ecfdf5',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⛳ Se banan
          </button>
        </div>
      </div>

      {players.map((player: any) => {
        const selected = values[player.id]
        const received = receivedStrokesOnHole(
          player.playing_handicap,
          hole.hcp_index,
          totalHoles
        )

        return (
          <div
            key={player.id}
            className="card"
            style={{
              marginBottom: 14,
              padding: 16,
              borderRadius: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div>
                <strong style={{ fontSize: 18 }}>{player.display_name}</strong>
                <div style={{ color: '#6b7280', fontSize: 14 }}>
                  HCP {player.exact_handicap ?? '-'} · Spel-HCP {player.playing_handicap ?? 0}
                </div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>
                  Erhållna slag: {received}
                </div>
              </div>

              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: '#f3f4f6',
                  fontSize: 13,
                  fontWeight: 700,
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
                gap: 12,
                marginTop: 12,
              }}
            >
              {quickScores.map((score) => {
                const active = selected === String(score)
                const diff = score - hole.par

                let bg = '#fff'
                let border = '#ddd'
                let color = '#111827'

                if (diff <= -1) {
                  bg = '#ecfdf5'
                  border = '#86efac'
                  color = '#166534'
                } else if (diff === 1) {
                  bg = '#fff7ed'
                  border = '#fdba74'
                  color = '#c2410c'
                } else if (diff >= 2) {
                  bg = '#fef2f2'
                  border = '#fca5a5'
                  color = '#b91c1c'
                }

                if (active) {
                  bg = '#166534'
                  border = '#166534'
                  color = '#ffffff'
                }

                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setScore(player.id, score)}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'scale(0.96)'
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = active ? 'scale(1.03)' : 'scale(1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = active ? 'scale(1.03)' : 'scale(1)'
                    }}
                    style={{
                      minHeight: 72,
                      borderRadius: 20,
                      border: `2px solid ${border}`,
                      background: bg,
                      color,
                      fontWeight: 800,
                      fontSize: 20,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      transform: active ? 'scale(1.03)' : 'scale(1)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>{score}</span>
                      <span style={{ fontSize: 11, opacity: 0.8 }}>{getLabel(diff)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 10,
          padding: 12,
          background: '#fff',
          borderTop: '1px solid #e5e7eb',
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={goPrevious}
          style={{ flex: 1 }}
        >
          ←
        </button>

        <button
          type="button"
          onClick={saveScores}
          disabled={loading}
          style={{ flex: 3, fontWeight: 800 }}
        >
          {loading ? 'Sparar...' : currentHole === endHole ? 'Avsluta runda' : 'Nästa hål →'}
        </button>
      </div>
    </div>
  )
}