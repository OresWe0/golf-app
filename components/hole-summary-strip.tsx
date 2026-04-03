'use client'

import { useRef } from 'react'
import { receivedStrokesOnHole, stablefordPoints } from '@/lib/scoring'

type HoleScore = {
  holeNumber: number
  par: number
  hcpIndex: number
  strokes: number | null
  marker: string | null
}

type SelectedPlayer = {
  id: string
  playingHandicap: number
}

function getMarkerStyle(marker: string | null): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 44,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
    background: '#fff',
    margin: '0 auto',
    flexShrink: 0,
  }

  if (marker === 'circle') {
    return {
      ...base,
      border: '2px solid #166534',
      borderRadius: '999px',
    }
  }

  if (marker === 'double-circle') {
    return {
      ...base,
      border: '2px solid #166534',
      borderRadius: '999px',
      boxShadow: '0 0 0 4px #d1fae5',
    }
  }

  if (marker === 'square') {
    return {
      ...base,
      border: '2px solid #b45309',
      borderRadius: 8,
      background: '#fff7ed',
    }
  }

  if (marker === 'double-square') {
    return {
      ...base,
      border: '2px solid #991b1b',
      borderRadius: 8,
      boxShadow: '0 0 0 4px #fee2e2',
      background: '#fff5f5',
    }
  }

  return base
}

export default function HoleSummaryStrip({
  title,
  holes,
  scores,
  selectedPlayer,
  visibleHoleCount,
  scoringMode,
  totalLabel,
}: {
  title: string
  holes: { par: number }[]
  scores: HoleScore[]
  selectedPlayer: SelectedPlayer
  visibleHoleCount: number
  scoringMode: string
  totalLabel: string
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const startScrollLeftRef = useRef(0)

  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)
  const strokesTotal = scores.reduce((sum, score) => sum + (score.strokes ?? 0), 0)
  const pointsTotal = scores.reduce((sum, score) => {
    if (score.strokes == null) return sum

    return (
      sum +
      stablefordPoints(
        score.strokes,
        score.par,
        receivedStrokesOnHole(
          selectedPlayer.playingHandicap,
          score.hcpIndex,
          visibleHoleCount
        )
      )
    )
  }, 0)

  const startDrag = (clientX: number) => {
    if (!scrollRef.current) return
    isDraggingRef.current = true
    startXRef.current = clientX
    startScrollLeftRef.current = scrollRef.current.scrollLeft
  }

  const moveDrag = (clientX: number) => {
    if (!isDraggingRef.current || !scrollRef.current) return
    const diff = clientX - startXRef.current
    scrollRef.current.scrollLeft = startScrollLeftRef.current - diff
  }

  const endDrag = () => {
    isDraggingRef.current = false
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 10,
          fontSize: 16,
          fontWeight: 800,
          color: '#166534',
        }}
      >
        {title}
      </div>

      <div
        ref={scrollRef}
        onMouseDown={(e) => startDrag(e.clientX)}
        onMouseMove={(e) => moveDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
        style={{
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x',
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          paddingBottom: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 10,
            width: 'max-content',
            minWidth: 'max-content',
            paddingRight: 12,
            userSelect: 'none',
          }}
        >
          {scores.map((score) => {
            const points =
              score.strokes == null
                ? null
                : stablefordPoints(
                    score.strokes,
                    score.par,
                    receivedStrokesOnHole(
                      selectedPlayer.playingHandicap,
                      score.hcpIndex,
                      visibleHoleCount
                    )
                  )

            return (
              <div
                key={`${selectedPlayer.id}-${score.holeNumber}`}
                style={{
                  width: 108,
                  minWidth: 108,
                  flex: '0 0 108px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 18,
                  background: '#fff',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    background: '#1f9d55',
                    color: '#fff',
                    textAlign: 'center',
                    padding: '10px 8px',
                    fontWeight: 800,
                    fontSize: 15,
                  }}
                >
                  Hål {score.holeNumber}
                </div>

                <div
                  style={{
                    padding: 12,
                    display: 'grid',
                    gap: 10,
                    textAlign: 'center',
                  }}
                >
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Par
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>{score.par}</div>
                  </div>

                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                      Resultat
                    </div>
                    {score.strokes == null ? (
                      <div style={{ fontSize: 24, fontWeight: 900 }}>-</div>
                    ) : (
                      <span style={getMarkerStyle(score.marker)}>{score.strokes}</span>
                    )}
                  </div>

                  {scoringMode === 'stableford' ? (
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        Poäng
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>
                        {points == null ? '-' : points}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}

          <div
            style={{
              width: 124,
              minWidth: 124,
              flex: '0 0 124px',
              border: '1px solid #cfe7d4',
              borderRadius: 18,
              background: '#f8fbf7',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: '#166534',
                color: '#fff',
                textAlign: 'center',
                padding: '10px 8px',
                fontWeight: 800,
                fontSize: 15,
              }}
            >
              {totalLabel}
            </div>

            <div
              style={{
                padding: 12,
                display: 'grid',
                gap: 10,
                textAlign: 'center',
              }}
            >
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Par
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{parTotal}</div>
              </div>

              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Resultat
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{strokesTotal}</div>
              </div>

              {scoringMode === 'stableford' ? (
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    Poäng
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>{pointsTotal}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}