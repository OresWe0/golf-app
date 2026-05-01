'use client'

import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEventHandler,
} from 'react'
import { useRouter } from 'next/navigation'
import { getReceivedStrokesForSelectedHole } from '@/lib/scoring'

type Player = {
  id: string
  display_name?: string
  exact_handicap?: number | null
  playing_handicap?: number | null
  tee_key?: 'yellow' | 'red' | string
  active_from_hole?: number | null
  active_to_hole?: number | null
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
  selectedHoleIndexes: number[]
  courseImageSlug?: string
  holeGpsByNumber?: Record<number, HoleGpsData>
}

type GpsPoint = {
  lat: number
  lng: number
}

type HoleGpsData = {
  front: GpsPoint
  center: GpsPoint
  back: GpsPoint
}

type DistanceStatus = 'idle' | 'loading' | 'ready' | 'error'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type FinishModalMode = 'saved-last-hole' | 'finish-early'

type ScoreTone = {
  background: string
  border: string
  color: string
  glow: string
}

const HOLE_GPS_DATA: Record<number, HoleGpsData> = {
  1: {
    front: { lat: 59.3491, lng: 15.19528 },
    center: { lat: 59.34922, lng: 15.19528 },
    back: { lat: 59.34934, lng: 15.19528 },
  },
  2: {
    front: { lat: 59.3498, lng: 15.1981 },
    center: { lat: 59.34985, lng: 15.1983 },
    back: { lat: 59.3499, lng: 15.1985 },
  },
  3: {
    front: { lat: 59.3516, lng: 15.2031 },
    center: { lat: 59.3517, lng: 15.20331 },
    back: { lat: 59.3518, lng: 15.2035 },
  },
  4: {
    front: { lat: 59.35002, lng: 15.2063 },
    center: { lat: 59.3499, lng: 15.20645 },
    back: { lat: 59.34978, lng: 15.2066 },
  },
  5: {
    front: { lat: 59.34742, lng: 15.2087 },
    center: { lat: 59.3473, lng: 15.2088 },
    back: { lat: 59.34718, lng: 15.2089 },
  },
  6: {
    front: { lat: 59.34685, lng: 15.20735 },
    center: { lat: 59.34685, lng: 15.2071 },
    back: { lat: 59.34685, lng: 15.20685 },
  },
  7: {
    front: { lat: 59.34812, lng: 15.2132 },
    center: { lat: 59.3482, lng: 15.2135 },
    back: { lat: 59.34828, lng: 15.2138 },
  },
  8: {
    front: { lat: 59.34675, lng: 15.2153 },
    center: { lat: 59.34665, lng: 15.2155 },
    back: { lat: 59.34655, lng: 15.2157 },
  },
  9: {
    front: { lat: 59.3483, lng: 15.2054 },
    center: { lat: 59.34845, lng: 15.2052 },
    back: { lat: 59.3486, lng: 15.205 },
  },
  10: {
    front: { lat: 59.34665, lng: 15.19855 },
    center: { lat: 59.3465, lng: 15.1984 },
    back: { lat: 59.34635, lng: 15.19825 },
  },
  11: {
    front: { lat: 59.34575, lng: 15.1934 },
    center: { lat: 59.3456, lng: 15.1932 },
    back: { lat: 59.34545, lng: 15.193 },
  },
  12: {
    front: { lat: 59.34405, lng: 15.1943 },
    center: { lat: 59.34415, lng: 15.1945 },
    back: { lat: 59.34425, lng: 15.1947 },
  },
  13: {
    front: { lat: 59.34285, lng: 15.1879 },
    center: { lat: 59.3427, lng: 15.1878 },
    back: { lat: 59.34255, lng: 15.1877 },
  },
  14: {
    front: { lat: 59.3423, lng: 15.1862 },
    center: { lat: 59.34215, lng: 15.1861 },
    back: { lat: 59.342, lng: 15.186 },
  },
  15: {
    front: { lat: 59.34125, lng: 15.1911 },
    center: { lat: 59.3414, lng: 15.1912 },
    back: { lat: 59.34155, lng: 15.1913 },
  },
  16: {
    front: { lat: 59.3434, lng: 15.192 },
    center: { lat: 59.34355, lng: 15.1921 },
    back: { lat: 59.3437, lng: 15.1922 },
  },
  17: {
    front: { lat: 59.34565, lng: 15.19775 },
    center: { lat: 59.3458, lng: 15.1979 },
    back: { lat: 59.34595, lng: 15.19805 },
  },
  18: {
    front: { lat: 59.3476, lng: 15.19655 },
    center: { lat: 59.34771, lng: 15.19655 },
    back: { lat: 59.34782, lng: 15.19655 },
  },
}

function formatToPar(value?: number | null) {
  if (value == null) return '-'
  if (value > 0) return `+${value}`
  return `${value}`
}

function getDistance(from: GpsPoint, to: GpsPoint) {
  const R = 6371e3
  const phi1 = (from.lat * Math.PI) / 180
  const phi2 = (to.lat * Math.PI) / 180
  const deltaPhi = ((to.lat - from.lat) * Math.PI) / 180
  const deltaLambda = ((to.lng - from.lng) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function getLabel(score: number, par: number) {
  if (score === 1) return 'HIO'

  const diff = score - par
  if (diff <= -3) return 'Albatross'
  if (diff === -2) return 'Eagle'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  return 'Double+'
}

function getScoreTone(score: number, par: number): ScoreTone {
  const diff = score - par

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

const styles = {
  page: {
    paddingBottom: 'calc(146px + env(safe-area-inset-bottom))',
    display: 'grid',
    gap: 12,
    overscrollBehavior: 'contain',
    WebkitTapHighlightColor: 'transparent',
  } satisfies CSSProperties,

  glassPanel: {
    border: '1px solid rgba(255,255,255,0.55)',
    borderRadius: 24,
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(244,248,244,0.80) 100%)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
    padding: 12,
    display: 'grid',
    gap: 10,
    animation: 'glassCardIn 0.22s ease',
  } satisfies CSSProperties,

  playerCard: {
    borderRadius: 28,
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.90) 0%, rgba(248,250,252,0.82) 100%)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    padding: 16,
    display: 'grid',
    gap: 14,
    animation: 'glassCardIn 0.22s ease',
  } satisfies CSSProperties,

  pill: {
    padding: '8px 12px',
    borderRadius: 999,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  } satisfies CSSProperties,

  bottomBarOuter: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    padding: '16px 16px calc(20px + env(safe-area-inset-bottom))',
    background:
      'linear-gradient(180deg, rgba(248,251,247,0) 0%, rgba(248,251,247,0.92) 24%, rgba(248,251,247,0.98) 100%)',
    backdropFilter: 'blur(10px)',
  } satisfies CSSProperties,

  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.72)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  } satisfies CSSProperties,
}

function StatusToast({ saveState }: { saveState: SaveState }) {
  if (saveState !== 'saved' && saveState !== 'error') return null

  const isSaved = saveState === 'saved'

  return (
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
          background: isSaved
            ? 'linear-gradient(135deg, #166534 0%, #22c55e 100%)'
            : 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)',
          color: '#fff',
          fontWeight: 800,
          boxShadow: isSaved
            ? '0 14px 34px rgba(22, 101, 52, 0.28)'
            : '0 14px 34px rgba(185, 28, 28, 0.28)',
          backdropFilter: 'blur(8px)',
          animation: 'savedToastIn 0.18s ease',
        }}
      >
        {isSaved ? 'Score sparad ✅' : 'Kunde inte spara ❌'}
      </div>
    </div>
  )
}

function HoleHeader({
  hole,
  totalHoles,
  onOpenHoleImage,
}: {
  hole: Hole
  totalHoles: number
  onOpenHoleImage: () => void
}) {
  return (
    <div style={styles.glassPanel}>
      <div className="hp-grid-2">
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 22,
            background:
              'linear-gradient(135deg, rgba(236,253,245,0.96) 0%, rgba(220,252,231,0.92) 100%)',
            border: '1px solid rgba(134, 239, 172, 0.65)',
            padding: 14,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: -18,
              top: -18,
              width: 92,
              height: 92,
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0) 72%)',
            }}
          />

          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(134, 239, 172, 0.55)',
              fontSize: 11,
              fontWeight: 900,
              color: '#166534',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Bana & hål
          </div>

          <div
            style={{
              position: 'relative',
              marginTop: 10,
              fontSize: 28,
              fontWeight: 950,
              lineHeight: 1.02,
              letterSpacing: '-0.03em',
              color: '#0f172a',
            }}
          >
            Hål {hole.hole_number}
          </div>

          <div
            style={{
              position: 'relative',
              marginTop: 6,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(134, 239, 172, 0.55)',
                color: '#14532d',
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              Par {hole.par}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(134, 239, 172, 0.55)',
                color: '#14532d',
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              Index {hole.hcp_index}
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 10px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(134, 239, 172, 0.55)',
                color: '#14532d',
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              {totalHoles} hål
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHoleImage}
          style={{
            border: '1px solid rgba(22,101,52,0.10)',
            borderRadius: 20,
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 14px 30px rgba(34, 197, 94, 0.22)',
            whiteSpace: 'nowrap',
            minWidth: 128,
            minHeight: 84,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          <span>⛳ Visa</span>
          <span>banvy</span>
        </button>
      </div>
    </div>
  )
}

function LiveLeaderboard({
  leaderboard,
  players,
  startHole,
  endHole,
  roundId,
  currentHole,
}: {
  leaderboard: LeaderboardEntry[]
  players: Player[]
  startHole: number
  endHole: number
  roundId: string
  currentHole: number
}) {
  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position

      const aPoints = a.totalPoints ?? -999
      const bPoints = b.totalPoints ?? -999
      if (aPoints !== bPoints) return bPoints - aPoints

      const aToPar = a.totalToPar ?? 999
      const bToPar = b.totalToPar ?? 999
      return aToPar - bToPar
    })
  }, [leaderboard])

  if (!sortedLeaderboard.length) return null

  const leader = sortedLeaderboard[0]
  const leaderPlayer = players.find((p) => String(p.id) === String(leader.playerId))
  const podium = sortedLeaderboard.slice(0, 4)

  const getPositionBadge = (position: number) => {
    if (position === 1) return '🥇'
    if (position === 2) return '🥈'
    if (position === 3) return '🥉'
    return `#${position}`
  }

  return (
    <section
      aria-label="Live leaderboard"
      style={{
        borderRadius: 32,
        padding: 22,
        background: 'linear-gradient(135deg, #0f2f1f 0%, #2f7d3f 100%)',
        color: '#ffffff',
        boxShadow: '0 22px 55px rgba(21, 90, 45, 0.20)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 34%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'grid', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.16)',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              <span aria-hidden="true">🔴</span>
              <span>Live leaderboard</span>
            </div>

            <h2
              style={{
                margin: '14px 0 2px',
                fontSize: 32,
                lineHeight: 1,
                fontWeight: 950,
                letterSpacing: '-0.04em',
              }}
            >
              {leaderPlayer?.display_name ?? 'Leaderboard'}
            </h2>

            <p style={{ margin: 0, color: 'rgba(255,255,255,0.76)', fontSize: 15, fontWeight: 800 }}>
              {leaderPlayer?.display_name ?? 'Ledaren'} leder just nu
              {leader.totalPoints != null ? ` på ${leader.totalPoints} p` : ''}
            </p>
          </div>

          <Link
            href={`/rounds/${roundId}/summary?hole=${currentHole}`}
            prefetch={false}
            style={{
              color: '#ffffff',
              textDecoration: 'none',
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 999,
              padding: '11px 16px',
              fontSize: 15,
              fontWeight: 950,
              whiteSpace: 'nowrap',
              boxShadow: '0 10px 26px rgba(15, 23, 42, 0.16)',
            }}
          >
            Visa allt
          </Link>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 4,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {podium.map((entry) => {
            const player = players.find((p) => String(p.id) === String(entry.playerId))
            const activeFrom = player?.active_from_hole ?? startHole
            const activeTo = player?.active_to_hole ?? endHole
            const isPartialRound = activeFrom > startHole || activeTo < endHole

            return (
              <div
                key={`leaderboard-preview-${entry.playerId}`}
                style={{
                  minWidth: 150,
                  borderRadius: 22,
                  padding: 16,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.24)',
                  boxShadow: entry.position === 1 ? '0 14px 35px rgba(0,0,0,0.16)' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    alignItems: 'center',
                    fontSize: 18,
                    fontWeight: 950,
                  }}
                >
                  <span>{getPositionBadge(entry.position)}</span>
                  <span>{formatToPar(entry.totalToPar)}</span>
                </div>

                <div style={{ marginTop: 18, fontSize: 17, fontWeight: 950 }}>
                  {player?.display_name ?? 'Spelare'}
                </div>

                <div style={{ marginTop: 10, fontSize: 30, lineHeight: 1, fontWeight: 950 }}>
                  {entry.totalPoints ?? '-'} p
                </div>

                <div style={{ marginTop: 5, color: 'rgba(255,255,255,0.72)', fontSize: 13, fontWeight: 750 }}>
                  {entry.totalStrokes ?? '-'} slag totalt
                  {isPartialRound ? ` · Hål ${activeFrom}-${activeTo}` : ''}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ScoreButton({
  score,
  par,
  isSelected,
  disabled,
  onClick,
}: {
  score: number
  par: number
  isSelected: boolean
  disabled: boolean
  onClick: () => void
}) {
  const tone = getScoreTone(score, par)
  const label = getLabel(score, par)
  const diff = score - par
  const isPositive = diff < 0
  const isNegative = diff > 0

  const statusEmoji = score === 1 ? '🎯' : isPositive ? '✨' : isNegative ? '•' : '✓'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      aria-label={`Registrera ${score} slag, ${label}`}
      className={isSelected ? 'hp-score-button hp-score-button-selected' : 'hp-score-button'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 22,
        padding: '14px 8px 13px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        minHeight: 96,
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: 6,
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        background: isSelected
          ? tone.background
          : 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.86) 100%)',
        border: isSelected ? tone.border : '1px solid rgba(203,213,225,0.95)',
        color: isSelected ? tone.color : '#0f172a',
        boxShadow: isSelected
          ? `0 0 0 3px ${tone.glow}, 0 16px 34px rgba(15, 23, 42, 0.18)`
          : '0 8px 18px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255,255,255,0.92)',
        transform: isSelected ? 'translateY(-2px) scale(1.025)' : 'translateY(0) scale(1)',
        transition:
          'transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease, background 180ms ease, border 180ms ease, color 180ms ease, opacity 160ms ease',
        animation: isSelected ? 'scoreSelectPop 260ms cubic-bezier(.2,.9,.25,1.25)' : 'none',
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 22,
          background: isSelected
            ? 'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.08) 38%, rgba(255,255,255,0) 68%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0) 54%)',
          pointerEvents: 'none',
        }}
      />

      {isSelected ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,0.24)',
            border: '1px solid rgba(255,255,255,0.38)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 900,
            boxShadow: '0 6px 14px rgba(15,23,42,0.12)',
            animation: 'scoreCheckIn 180ms ease both',
          }}
        >
          {statusEmoji}
        </span>
      ) : null}

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 24,
          fontWeight: 950,
          lineHeight: 1,
          letterSpacing: '-0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 9,
          fontWeight: 900,
          textAlign: 'center',
          opacity: isSelected ? 0.92 : 0.54,
          letterSpacing: 0.45,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </button>
  )
}

function PlayerScoreCard({
  player,
  index,
  hole,
  selectedValue,
  onSetScore,
  onClearScore,
  canInteract,
  firstPlayerCardRef,
  selectedHoleIndexes,
  leaderboardMeta,
  isLeader,
  streak,
  quickScores,
  startHole,
  endHole,
}: {
  player: Player
  index: number
  hole: Hole
  selectedValue: string
  onSetScore: (score: number) => void
  onClearScore: () => void
  canInteract: boolean
  firstPlayerCardRef: React.RefObject<HTMLDivElement | null>
  selectedHoleIndexes: number[]
  leaderboardMeta?: LeaderboardEntry
  isLeader: boolean
  streak: number
  quickScores: number[]
  startHole: number
  endHole: number
}) {
  const playerId = String(player.id)
  const selectedScore = selectedValue ? Number(selectedValue) : null
  const selectedTone = selectedScore == null ? null : getScoreTone(selectedScore, hole.par)
  const showHotStreak = streak >= 2

  const received = getReceivedStrokesForSelectedHole(
    player.playing_handicap ?? 0,
    selectedHoleIndexes,
    hole.hcp_index
  )
  const activeFrom = player.active_from_hole ?? startHole
  const activeTo = player.active_to_hole ?? endHole
  const isPartialRound = activeFrom > startHole || activeTo < endHole

  return (
    <div
      key={playerId}
      ref={index === 0 ? firstPlayerCardRef : null}
      style={{
        ...styles.playerCard,
        border: isLeader
          ? '1px solid rgba(74, 222, 128, 0.44)'
          : '1px solid rgba(255,255,255,0.60)',
        boxShadow: isLeader
          ? '0 22px 54px rgba(34, 197, 94, 0.12)'
          : '0 18px 44px rgba(15, 23, 42, 0.07)',
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
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              color: '#64748b',
              fontWeight: 700,
              fontSize: 15,
              lineHeight: 1.35,
            }}
          >
            <span>Hål {hole.hole_number}</span>
            <span style={{ opacity: 0.45 }}>•</span>
            <span>{leaderboardMeta?.totalPoints ?? '-'} p</span>
            <span style={{ opacity: 0.45 }}>•</span>
            <span>Till par {formatToPar(leaderboardMeta?.totalToPar)}</span>
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

          {isPartialRound ? (
            <div
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(191, 219, 254, 0.22)',
                border: '1px solid rgba(147, 197, 253, 0.55)',
                color: '#1d4ed8',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              Delrunda: hål {activeFrom}-{activeTo}
            </div>
          ) : null}
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
                ...styles.pill,
                background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                color: '#fff',
                boxShadow: '0 10px 22px rgba(34, 197, 94, 0.22)',
                animation: 'badgeFloat 2s ease-in-out infinite',
              }}
            >
              🔑 Leder nu
            </div>
          ) : null}

          {showHotStreak ? (
            <div
              style={{
                ...styles.pill,
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                color: '#fff',
                boxShadow: '0 10px 22px rgba(249, 115, 22, 0.20)',
              }}
            >
              🔥 Hot streak
            </div>
          ) : null}

          {leaderboardMeta?.position ? (
            <div
              style={{
                ...styles.pill,
                background: 'rgba(255,255,255,0.72)',
                color: '#334155',
                border: '1px solid rgba(203,213,225,0.9)',
              }}
            >
              #{leaderboardMeta.position}
            </div>
          ) : null}

          <div
            style={{
              ...styles.pill,
              background: 'rgba(241,245,249,0.85)',
              color: '#1f3327',
            }}
          >
            {player.tee_key === 'red' ? 'Röd tee' : 'Gul tee'}
          </div>
        </div>
      </div>

      <div className="hp-score-grid">
        {quickScores.map((score) => (
          <ScoreButton
            key={`${player.id}-${score}`}
            score={score}
            par={hole.par}
            isSelected={selectedValue === String(score)}
            disabled={!canInteract}
            onClick={() => onSetScore(score)}
          />
        ))}
      </div>

      <div className="hp-selected-row">
        <div
          style={{
            border: selectedScore == null ? '1px solid #d1d5db' : selectedTone?.border,
            borderRadius: 20,
            padding: '12px 14px',
            background: selectedScore == null ? 'rgba(248,250,252,0.9)' : selectedTone?.background,
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

          {selectedScore != null ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Klar för nästa hål
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClearScore}
          style={{
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            border: '1px solid rgba(209,213,219,0.95)',
            background: 'rgba(255,255,255,0.84)',
            borderRadius: 20,
            padding: '12px 14px',
            minWidth: 92,
            fontWeight: 800,
            cursor: canInteract ? 'pointer' : 'not-allowed',
            display: 'grid',
            placeItems: 'center',
            gap: 4,
            color: '#475569',
            boxShadow: '0 8px 20px rgba(15, 23, 42, 0.05)',
          }}
          disabled={!canInteract}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>↺</span>
          <span style={{ fontSize: 13 }}>Rensa</span>
        </button>
      </div>
    </div>
  )
}

function HoleImageModal({
  show,
  onClose,
  previewHoleNumber,
  holeSequence,
  onPrevious,
  onNext,
  holeImageSrc,
  holeImageError,
  setHoleImageError,
  distanceStatus,
  distanceErrorMessage,
  distanceToFront,
  distanceToCenter,
  distanceToBack,
  zoom,
  pan,
  isZooming,
  onMapTap,
  onMapTouchStart,
  onMapTouchMove,
  onMapTouchEnd,
}: {
  show: boolean
  onClose: () => void
  previewHoleNumber: number
  holeSequence: number[]
  onPrevious: () => void
  onNext: () => void
  holeImageSrc: string
  holeImageError: boolean
  setHoleImageError: (value: boolean) => void
  distanceStatus: DistanceStatus
  distanceErrorMessage: string | null
  distanceToFront: number | null
  distanceToCenter: number | null
  distanceToBack: number | null
  zoom: number
  pan: { x: number; y: number }
  isZooming: boolean
  onMapTap: () => void
  onMapTouchStart: TouchEventHandler<HTMLDivElement>
  onMapTouchMove: TouchEventHandler<HTMLDivElement>
  onMapTouchEnd: TouchEventHandler<HTMLDivElement>
}) {
  if (!show) return null
  const previewIndex = holeSequence.indexOf(previewHoleNumber)
  const canGoPrevious = previewIndex > 0
  const canGoNext = previewIndex >= 0 && previewIndex < holeSequence.length - 1

  return (
    <div onClick={onClose} style={styles.modalBackdrop}>
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
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>Hål {previewHoleNumber}</div>

            {distanceStatus === 'loading' && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#cbd5e1',
                }}
              >
                Hämtar avstånd...
              </div>
            )}

            {distanceStatus === 'ready' &&
            distanceToFront != null &&
            distanceToCenter != null &&
            distanceToBack != null ? (
              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.10)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Front {distanceToFront} m
                </span>

                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 900,
                    boxShadow: '0 8px 20px rgba(34, 197, 94, 0.24)',
                  }}
                >
                  Centrum {distanceToCenter} m
                </span>

                <span
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.10)',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Back {distanceToBack} m
                </span>
              </div>
            ) : null}

            {distanceStatus === 'error' && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fca5a5',
                }}
              >
                {distanceErrorMessage ?? 'Kunde inte hämta GPS-avstånd'}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
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
  <div
    onClick={onMapTap}
    onTouchStart={onMapTouchStart}
    onTouchMove={onMapTouchMove}
    onTouchEnd={onMapTouchEnd}
    style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      maxHeight: '70vh',
      overflow: 'hidden',
      touchAction: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {!holeImageSrc || holeImageError ? (
      <div style={{ color: '#fff', padding: 24, textAlign: 'center' }}>
        Ingen hålbild hittades för hål {previewHoleNumber}.
      </div>
    ) : (
      <img
        src={holeImageSrc}
        alt={`Hål ${previewHoleNumber}`}
        onError={() => setHoleImageError(true)}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '70vh',
          objectFit: 'contain',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: isZooming ? 'none' : 'transform 0.18s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'auto',
        }}
      />
    )}
  </div>
</div>

        <div className="hp-modal-actions">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canGoPrevious}
            style={{
              border: 'none',
              borderRadius: 18,
              padding: '14px 16px',
              background:
                !canGoPrevious
                  ? '#475569'
                  : 'linear-gradient(135deg, #1f6f32 0%, #2f7f37 100%)',
              color: '#fff',
              fontWeight: 900,
              cursor: !canGoPrevious ? 'not-allowed' : 'pointer',
            }}
          >
            ← Föregående
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={!canGoNext}
            style={{
              border: 'none',
              borderRadius: 18,
              padding: '14px 16px',
              background:
                !canGoNext
                  ? '#475569'
                  : 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
              color: '#fff',
              fontWeight: 900,
              cursor: !canGoNext ? 'not-allowed' : 'pointer',
            }}
          >
            Nästa →
          </button>
        </div>
      </div>
    </div>
  )
}

function FinishRoundModal({
  open,
  loading,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean
  loading: boolean
  title: string
  description: string
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!open) return null

  return (
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
        <div style={{ fontSize: 24, fontWeight: 900 }}>{title}</div>

        <div style={{ color: '#475569', fontSize: 15, lineHeight: 1.55 }}>{description}</div>

        <div className="hp-finish-actions">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              border: '1px solid #d1d5db',
              borderRadius: 18,
              padding: '14px',
              fontWeight: 800,
              background: 'rgba(255,255,255,0.84)',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#0f172a',
            }}
          >
            Avbryt
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              border: 'none',
              borderRadius: 18,
              padding: '14px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 12px 26px rgba(22, 101, 52, 0.22)',
            }}
          >
            {loading ? 'Avslutar...' : 'Bekräfta'}
          </button>
        </div>
      </div>
    </div>
  )
}

function BottomBar({
  canInteract,
  isReadyToAdvance,
  completedPlayers,
  totalPlayers,
  currentHole,
  endHole,
  isLastHoleInSequence,
  loading,
  onPrevious,
  onSave,
}: {
  canInteract: boolean
  isReadyToAdvance: boolean
  completedPlayers: number
  totalPlayers: number
  currentHole: number
  endHole: number
  isLastHoleInSequence: boolean
  loading: boolean
  onPrevious: () => void
  onSave: () => void
}) {
  return (
    <div style={styles.bottomBarOuter}>
      <div className="hp-bottom-actions">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!canInteract}
          style={{
            border: 'none',
            borderRadius: 24,
            minHeight: 72,
            background: canInteract
              ? 'linear-gradient(135deg, #1f6f32 0%, #2f7f37 100%)'
              : 'linear-gradient(135deg, #94a3b8 0%, #a8b4c7 100%)',
            color: '#fff',
            fontSize: 28,
            fontWeight: 900,
            cursor: canInteract ? 'pointer' : 'not-allowed',
            boxShadow: canInteract ? '0 16px 32px rgba(31, 111, 50, 0.22)' : 'none',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          ←
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!canInteract || !isReadyToAdvance}
          style={{
            border: 'none',
            borderRadius: 24,
            minHeight: 72,
            background:
              !canInteract || !isReadyToAdvance
                ? 'linear-gradient(135deg, #94a3b8 0%, #a8b4c7 100%)'
                : 'linear-gradient(135deg, #16a34a 0%, #22c55e 45%, #2563eb 100%)',
            color: '#fff',
            fontSize: 18,
            fontWeight: 900,
            cursor: !canInteract || !isReadyToAdvance ? 'not-allowed' : 'pointer',
            boxShadow:
              !canInteract || !isReadyToAdvance
                ? 'none'
                : '0 20px 42px rgba(34, 197, 94, 0.24)',
            letterSpacing: 0.2,
            animation: !canInteract || !isReadyToAdvance ? 'none' : 'ctaReadyPulse 1.2s ease 1',
            transition: 'transform 0.16s ease, box-shadow 0.18s ease, background 0.18s ease',
            touchAction: 'manipulation',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          {loading
            ? 'Sparar...'
            : !isReadyToAdvance
              ? 'Fyll i alla scorer'
              : isLastHoleInSequence
                ? 'Klar – avsluta runda →'
                : 'Klar – nästa hål →'}
        </button>
      </div>

      <div
        style={{
          maxWidth: 960,
          margin: '8px auto 0',
          padding: '0 4px',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
          color: '#334155',
          fontSize: 13,
          fontWeight: 800,
          lineHeight: 1.35,
        }}
      >
        <span>{completedPlayers}/{totalPlayers} spelare klara</span>
        <span>{isReadyToAdvance ? 'Redo att gå vidare' : 'Väntar på resterande scorer'}</span>
      </div>
    </div>
  )
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
  selectedHoleIndexes,
  courseImageSlug,
  holeGpsByNumber = {},
}: Props) {
  const router = useRouter()

  const touchStartX = useRef<number | null>(null)
  const firstPlayerCardRef = useRef<HTMLDivElement | null>(null)
  const hasUserChangedScoreRef = useRef(false)
  const postSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const isSavingRef = useRef(false)
  const isNavigatingRef = useRef(false)
  const scrollYByHoleRef = useRef<Record<number, number>>({})
  const prevHoleRef = useRef<number | null>(null)

  const createValuesFromScores = () =>
    Object.fromEntries(
      players.map((player) => {
        const existing = scores.find((score) => score.round_player_id === player.id)
        return [String(player.id), existing?.strokes?.toString() ?? '']
      })
    )

  const [values, setValues] = useState<Record<string, string>>(createValuesFromScores())
  const [loading, setLoading] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const [showHoleImage, setShowHoleImage] = useState(false)
  const [holeImageError, setHoleImageError] = useState(false)
  const [previewHoleNumber, setPreviewHoleNumber] = useState<number>(hole.hole_number)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishModalMode, setFinishModalMode] = useState<FinishModalMode>('saved-last-hole')
const [activeCourseImageSlug, setActiveCourseImageSlug] = useState(courseImageSlug || '')
const [zoom, setZoom] = useState(1)
const [pan, setPan] = useState({ x: 0, y: 0 })
const [isZooming, setIsZooming] = useState(false)

const lastTapRef = useRef(0)
const pinchStartDistanceRef = useRef<number | null>(null)
const pinchStartZoomRef = useRef(1)
const panStartRef = useRef<{ x: number; y: number } | null>(null)
const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const [playerPosition, setPlayerPosition] = useState<GpsPoint | null>(null)
  const [distanceStatus, setDistanceStatus] = useState<DistanceStatus>('idle')
  const [distanceErrorMessage, setDistanceErrorMessage] = useState<string | null>(null)
  const [distanceToFront, setDistanceToFront] = useState<number | null>(null)
  const [distanceToCenter, setDistanceToCenter] = useState<number | null>(null)
  const [distanceToBack, setDistanceToBack] = useState<number | null>(null)

  const leaderboardByPlayerId = useMemo(() => {
    return new Map(leaderboard.map((entry) => [String(entry.playerId), entry]))
  }, [leaderboard])

  const leaderIds = useMemo(() => {
    const leaders = leaderboard.filter((entry) => entry.position === 1)
    return new Set(leaders.map((entry) => String(entry.playerId)))
  }, [leaderboard])

  const quickScores = useMemo(() => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8]
    const extra = hole.par + 4
    return Array.from(new Set([...base, extra])).sort((a, b) => a - b)
  }, [hole.par])

  const safeCourseImageSlug = (courseImageSlug ?? '').trim()
  const holeImageSrc = activeCourseImageSlug
    ? `/course-images/${activeCourseImageSlug}/${previewHoleNumber}.jpg`
    : ''

  const holeSequence = useMemo(() => {
    if (totalHoles === 18 && startHole === 10 && endHole === 9) {
      return [...Array.from({ length: 9 }, (_, index) => 10 + index), ...Array.from({ length: 9 }, (_, index) => 1 + index)]
    }
    return Array.from({ length: totalHoles }, (_, index) => startHole + index)
  }, [totalHoles, startHole, endHole])

  const currentHoleIndex = Math.max(0, holeSequence.indexOf(currentHole))
  const isFirstHoleInSequence = currentHoleIndex <= 0
  const isLastHoleInSequence = currentHoleIndex >= holeSequence.length - 1
  const previousHoleNumber = holeSequence[Math.max(0, currentHoleIndex - 1)] ?? currentHole
  const nextHoleNumber = holeSequence[Math.min(holeSequence.length - 1, currentHoleIndex + 1)] ?? currentHole

  useEffect(() => {
    if (!isLastHoleInSequence) {
      router.prefetch('/rounds/' + roundId + '?hole=' + nextHoleNumber)
    } else {
      router.prefetch('/rounds/' + roundId + '/summary')
    }

    if (!isFirstHoleInSequence) {
      router.prefetch('/rounds/' + roundId + '?hole=' + previousHoleNumber)
    }

    router.prefetch('/dashboard')
  }, [router, roundId, isLastHoleInSequence, nextHoleNumber, isFirstHoleInSequence, previousHoleNumber])

  const handleHoleImageError = (value: boolean) => {
    if (!value) {
      setHoleImageError(false)
      return
    }

    setHoleImageError(true)
  }

  const allPlayersHaveScores = (candidateValues: Record<string, string>) => {
    if (!players.length) return false

    return players.every((player) => {
      const value = candidateValues[String(player.id)]
      return value !== '' && value !== undefined && value !== null
    })
  }

  const isReadyToAdvance = allPlayersHaveScores(values)
  const completedPlayersCount = players.reduce((count, player) => {
    const value = values[String(player.id)]
    return value ? count + 1 : count
  }, 0)
  const canInteract = !loading && !isSavingRef.current && !isNavigatingRef.current

  const liveHeaderStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    display: 'grid',
    gap: 12,
    padding: '16px 16px 18px',
    borderRadius: 24,
    background:
      'linear-gradient(180deg, rgba(17,24,39,0.96) 0%, rgba(15,23,42,0.94) 100%)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    boxShadow: '0 22px 54px rgba(15, 23, 42, 0.18)',
    marginBottom: 16,
    color: '#fff',
  }

  const liveHeaderPillStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.92)',
    fontWeight: 800,
    fontSize: 13,
    whiteSpace: 'nowrap',
  }

  const holeIndexInSegment = currentHoleIndex + 1
  const segmentHoleCount = Math.max(1, holeSequence.length)
  const holesRemainingInSegment = Math.max(0, segmentHoleCount - holeIndexInSegment)
  const liveProgress = Math.max(
    0,
    Math.min(100, (holeIndexInSegment / segmentHoleCount) * 100)
  )

  const clearPostSaveTimeout = () => {
    if (postSaveTimeoutRef.current) {
      clearTimeout(postSaveTimeoutRef.current)
      postSaveTimeoutRef.current = null
    }
  }

  const clearToastTimeout = () => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
  }

  const resetDistanceState = () => {
    setDistanceToFront(null)
    setDistanceToCenter(null)
    setDistanceToBack(null)
  }

const resetMapZoom = () => {
  setZoom(1)
  setPan({ x: 0, y: 0 })
  setIsZooming(false)
}

function getTouchDistance(touches: React.TouchList) {
  if (touches.length < 2) return 0

  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY

  return Math.sqrt(dx * dx + dy * dy)
}

const handleMapTap = () => {
  const now = Date.now()
  const isDoubleTap = now - lastTapRef.current < 280

  if (isDoubleTap) {
    if (zoom > 1) {
      setZoom(1)
      setPan({ x: 0, y: 0 })
    } else {
      setZoom(2.2)
      setPan({ x: 0, y: 0 })
    }
  }

  lastTapRef.current = now
}

const handleMapTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
  if (e.touches.length === 2) {
    pinchStartDistanceRef.current = getTouchDistance(e.touches)
    pinchStartZoomRef.current = zoom
    setIsZooming(true)
    return
  }

  if (e.touches.length === 1 && zoom > 1) {
    dragStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    }
    panStartRef.current = pan
  }
}

const handleMapTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
  if (e.touches.length === 2 && pinchStartDistanceRef.current) {
    const newDistance = getTouchDistance(e.touches)
    const ratio = newDistance / pinchStartDistanceRef.current
    const nextZoom = Math.max(1, Math.min(4, pinchStartZoomRef.current * ratio))
    setZoom(nextZoom)
    return
  }

  if (e.touches.length === 1 && zoom > 1 && dragStartRef.current && panStartRef.current) {
    const dx = e.touches[0].clientX - dragStartRef.current.x
    const dy = e.touches[0].clientY - dragStartRef.current.y

    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    })
  }
}

const handleMapTouchEnd: TouchEventHandler<HTMLDivElement> = () => {
  pinchStartDistanceRef.current = null
  dragStartRef.current = null
  panStartRef.current = null
  setIsZooming(false)

  setZoom((currentZoom) => {
    if (currentZoom <= 1.02) {
      setPan({ x: 0, y: 0 })
      return 1
    }
    return currentZoom
  })
}

  const stopWatchingPosition = () => {
    if (
      watchIdRef.current != null &&
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const updateDistancesForHole = (coords: GpsPoint, holeNumber: number) => {
    const holeGps = holeGpsByNumber[holeNumber] ?? HOLE_GPS_DATA[holeNumber]

    if (!holeGps) {
      resetDistanceState()
      setDistanceStatus('error')
      setDistanceErrorMessage('GPS-data saknas för det här hålet')
      return
    }

    setDistanceToFront(Math.round(getDistance(coords, holeGps.front)))
    setDistanceToCenter(Math.round(getDistance(coords, holeGps.center)))
    setDistanceToBack(Math.round(getDistance(coords, holeGps.back)))
    setDistanceStatus('ready')
    setDistanceErrorMessage(null)
  }

const navigateTo = (target: string, options?: { replace?: boolean }) => {
  if (isNavigatingRef.current) return

  clearPostSaveTimeout()
  clearToastTimeout()

  isNavigatingRef.current = true
  if (options?.replace) {
    router.replace(target, { scroll: false })
    return
  }

  router.push(target, { scroll: false })
}  

  const goPrevious = () => {
    if (!canInteract) return

    const target = !isFirstHoleInSequence ? `/rounds/${roundId}?hole=${previousHoleNumber}` : '/dashboard'

    navigateTo(target, { replace: isLastHoleInSequence })
  }

  const goNext = () => {
    if (!canInteract) return

    const target = isLastHoleInSequence
      ? `/rounds/${roundId}/summary`
      : `/rounds/${roundId}?hole=${nextHoleNumber}`

    navigateTo(target)
  }

  const requestFinishEarly = () => {
    if (!canInteract) return
    if (!isReadyToAdvance) return
    if (loading || isSavingRef.current || isNavigatingRef.current) return
    if (isLastHoleInSequence) return

    setFinishModalMode('finish-early')
    setShowFinishModal(true)
  }

  const markSaved = () => {
    setSaveState('saved')
    clearToastTimeout()

    toastTimeoutRef.current = setTimeout(() => {
      setSaveState('idle')
    }, 1400)
  }

  const markError = () => {
    setSaveState('error')
    clearToastTimeout()

    toastTimeoutRef.current = setTimeout(() => {
      setSaveState('idle')
    }, 1800)
  }

  const completeRound = async (completedThroughHole: number) => {
    const response = await fetch(`/api/rounds/${roundId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedThroughHole }),
    })

    if (!response.ok) {
      alert('Kunde inte avsluta rundan.')
      return false
    }

    navigateTo(`/rounds/${roundId}/summary`, { replace: true })
    return true
  }

  const confirmFinishRound = async () => {
    if (!canInteract) return

    if (finishModalMode === 'finish-early') {
      setShowFinishModal(false)
      await saveScores(values, { completeRoundAfterSave: true })
      return
    }

    isSavingRef.current = true
    setLoading(true)

    try {
      await completeRound(currentHole)
    } finally {
      if (!isNavigatingRef.current) {
        setLoading(false)
        isSavingRef.current = false
      }
    }
  }

  const saveScores = async (
    overrideValues?: Record<string, string>,
    options?: { completeRoundAfterSave?: boolean }
  ) => {
    const valuesToSave = overrideValues ?? values

    if (loading) return
    if (isSavingRef.current) return
    if (isNavigatingRef.current) return
    if (!allPlayersHaveScores(valuesToSave)) return

    isSavingRef.current = true
    setLoading(true)
    setSaveState('saving')
    clearPostSaveTimeout()
    clearToastTimeout()

    try {
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
        markError()
        alert('Det gick inte att spara score. Prova igen.')
        return
      }

      hasUserChangedScoreRef.current = false
      markSaved()

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 18, 20])
      }

      if (options?.completeRoundAfterSave) {
        await completeRound(currentHole)
        return
      }

      if (isLastHoleInSequence) {
        isSavingRef.current = false
        setLoading(false)
        setFinishModalMode('saved-last-hole')
        setShowFinishModal(true)
        return
      }

      isSavingRef.current = false
      goNext()
      return
    } finally {
      if (!isNavigatingRef.current) {
        setLoading(false)
        isSavingRef.current = false
      }
    }
  }

  const setScore = (playerId: string, score: number) => {
    if (!canInteract) return

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }

    hasUserChangedScoreRef.current = true
    setSaveState('idle')

    setValues((prev) => ({
      ...prev,
      [String(playerId)]: String(score),
    }))
  }

  const clearScore = (playerId: string) => {
    if (!canInteract) return
    hasUserChangedScoreRef.current = true
    setSaveState('idle')

    setValues((prev) => ({
      ...prev,
      [String(playerId)]: '',
    }))
  }

const openHoleImage = () => {
  resetMapZoom()
  setPreviewHoleNumber(hole.hole_number)
  setActiveCourseImageSlug(safeCourseImageSlug)
  setHoleImageError(false)
  setShowHoleImage(true)
  setPlayerPosition(null)
  resetDistanceState()
  setDistanceStatus('loading')
  setDistanceErrorMessage(null)
}

  const closeHoleImage = () => {
    resetMapZoom()
    setShowHoleImage(false)
    setDistanceStatus('idle')
    setDistanceErrorMessage(null)
    resetDistanceState()
  }

const previewPreviousHole = () => {
  const previewIndex = holeSequence.indexOf(previewHoleNumber)
  if (previewIndex > 0) {
    const targetHole = holeSequence[previewIndex - 1]
    if (!targetHole) return
    resetMapZoom()
    setPreviewHoleNumber(targetHole)
    setHoleImageError(false)

    if (playerPosition) {
      setDistanceStatus('loading')
    }
  }
}

const previewNextHole = () => {
  const previewIndex = holeSequence.indexOf(previewHoleNumber)
  if (previewIndex >= 0 && previewIndex < holeSequence.length - 1) {
    const targetHole = holeSequence[previewIndex + 1]
    if (!targetHole) return
    resetMapZoom()
    setPreviewHoleNumber(targetHole)
    setHoleImageError(false)

    if (playerPosition) {
      setDistanceStatus('loading')
    }
  }
}
  const onTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null
  }

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = (e) => {
    const startX = touchStartX.current
    const endX = e.changedTouches[0]?.clientX ?? null
    if (startX == null || endX == null) return

    const diff = endX - startX

    if (showHoleImage) {
      const previewIndex = holeSequence.indexOf(previewHoleNumber)
      if (diff > 70 && previewIndex > 0) previewPreviousHole()
      if (diff < -70 && previewIndex >= 0 && previewIndex < holeSequence.length - 1) previewNextHole()
      touchStartX.current = null
      return
    }

    if (diff > 70 && !isFirstHoleInSequence) goPrevious()
    if (diff < -70 && !isLastHoleInSequence) goNext()

    touchStartX.current = null
  }

  useEffect(() => {
  setValues(createValuesFromScores())
  setPreviewHoleNumber(hole.hole_number)
  setHoleImageError(false)
  setShowFinishModal(false)
  setFinishModalMode('saved-last-hole')
  setSaveState('idle')

  hasUserChangedScoreRef.current = false
  isSavingRef.current = false
  isNavigatingRef.current = false

  setLoading(false)

  clearPostSaveTimeout()
  clearToastTimeout()
}, [hole.hole_number, scores])

useEffect(() => {
  // första render → gör inget
  if (prevHoleRef.current === null) {
    prevHoleRef.current = hole.hole_number
    return
  }

  // bara scrolla om hålet faktiskt ändras
  if (prevHoleRef.current !== hole.hole_number) {
    const timer = setTimeout(() => {
      firstPlayerCardRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      })
    }, 80)

    prevHoleRef.current = hole.hole_number

    return () => clearTimeout(timer)
  }
}, [hole.hole_number])
    

  useEffect(() => {
    return () => {
      clearPostSaveTimeout()
      clearToastTimeout()
      stopWatchingPosition()
    }
  }, [])

  useEffect(() => {
    if (!showHoleImage) {
      stopWatchingPosition()
      return
    }

    resetDistanceState()
    setDistanceStatus('loading')
    setDistanceErrorMessage(null)

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setDistanceStatus('error')
      setDistanceErrorMessage('Din enhet stödjer inte GPS')
      return
    }

    stopWatchingPosition()

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }

        setPlayerPosition(coords)
      },
      (error) => {
        resetDistanceState()
        setDistanceStatus('error')

        if (error.code === error.PERMISSION_DENIED) {
          setDistanceErrorMessage('Platsåtkomst nekades')
          return
        }

        if (error.code === error.POSITION_UNAVAILABLE) {
          setDistanceErrorMessage('Kunde inte hitta din position')
          return
        }

        if (error.code === error.TIMEOUT) {
          setDistanceErrorMessage('GPS tog för lång tid')
          return
        }

        setDistanceErrorMessage('Kunde inte hämta GPS-avstånd')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    )

    return () => {
      stopWatchingPosition()
    }
  }, [showHoleImage])

  useEffect(() => {
    if (!showHoleImage) return
    if (!playerPosition) return

    updateDistancesForHole(playerPosition, previewHoleNumber)
  }, [playerPosition, previewHoleNumber, showHoleImage])

  useEffect(() => {
    if (!showHoleImage) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHoleImage()
      const previewIndex = holeSequence.indexOf(previewHoleNumber)
      if (e.key === 'ArrowLeft' && previewIndex > 0) previewPreviousHole()
      if (e.key === 'ArrowRight' && previewIndex >= 0 && previewIndex < holeSequence.length - 1) previewNextHole()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showHoleImage, previewHoleNumber, holeSequence])

  useEffect(() => {
    setActiveCourseImageSlug(safeCourseImageSlug)
    setHoleImageError(false)
  }, [safeCourseImageSlug])

  return (
    <>
      <style>{`
        @keyframes scoreSelectPop {
          0% { transform: translateY(0) scale(0.94); }
          58% { transform: translateY(-3px) scale(1.055); }
          100% { transform: translateY(-2px) scale(1.025); }
        }

        @keyframes scoreCheckIn {
          0% { opacity: 0; transform: scale(0.55) rotate(-10deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes liveDotPulse {
          0% {
            box-shadow:
              0 0 0 0 rgba(239, 68, 68, 0.42),
              0 0 18px rgba(239, 68, 68, 0.18);
          }
          70% {
            box-shadow:
              0 0 0 10px rgba(239, 68, 68, 0),
              0 0 20px rgba(239, 68, 68, 0.12);
          }
          100% {
            box-shadow:
              0 0 0 0 rgba(239, 68, 68, 0),
              0 0 0 rgba(239, 68, 68, 0);
          }
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

        @keyframes ctaReadyPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.22); }
          100% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
        }


        .hp-leaderboard-shell {
          position: sticky;
          top: 8px;
          z-index: 24;
          margin: 0 0 14px;
        }

        .hp-leaderboard-card {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            radial-gradient(circle at top left, rgba(34,197,94,0.26), transparent 36%),
            linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(17,24,39,0.96) 100%);
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: #fff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .hp-leaderboard-card::after {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent 38%);
        }

        .hp-leaderboard-hero {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: stretch;
          padding: 16px;
        }

        .hp-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.82);
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .hp-live-dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #ef4444;
          animation: liveDotPulse 1.8s ease-out infinite;
          flex-shrink: 0;
        }

        .hp-leaderboard-title {
          margin: 10px 0 0;
          font-size: 28px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .hp-leaderboard-subtitle {
          margin: 7px 0 0;
          max-width: 540px;
          color: rgba(255,255,255,0.68);
          font-size: 13px;
          font-weight: 750;
          line-height: 1.4;
        }

        .hp-leaderboard-leaderbox {
          min-width: 156px;
          border-radius: 22px;
          padding: 14px;
          background: linear-gradient(180deg, rgba(34,197,94,0.22), rgba(22,163,74,0.12));
          border: 1px solid rgba(74,222,128,0.32);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .hp-leaderbox-label {
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.58);
        }

        .hp-leaderbox-name {
          margin-top: 5px;
          font-size: 15px;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 190px;
        }

        .hp-leaderbox-score {
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 13px;
          font-weight: 950;
          color: #bbf7d0;
        }

        .hp-leaderboard-table {
          position: relative;
          z-index: 1;
          padding: 0 10px 10px;
        }

        .hp-leaderboard-head,
        .hp-leaderboard-row {
          display: grid;
          grid-template-columns: 54px minmax(128px, 1fr) 70px 62px 62px;
          gap: 8px;
          align-items: center;
        }

        .hp-leaderboard-head {
          padding: 0 10px 7px;
          color: rgba(255,255,255,0.48);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .hp-leaderboard-rows {
          display: grid;
          gap: 6px;
          max-height: 286px;
          overflow: auto;
          padding-right: 2px;
          -webkit-overflow-scrolling: touch;
        }

        .hp-leaderboard-row {
          min-height: 58px;
          padding: 9px 10px;
          border-radius: 18px;
          background: rgba(255,255,255,0.065);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .hp-leaderboard-row.is-leader {
          background: linear-gradient(135deg, rgba(34,197,94,0.26), rgba(22,163,74,0.13));
          border-color: rgba(74,222,128,0.38);
          box-shadow: 0 12px 26px rgba(34,197,94,0.12);
        }

        .hp-position-pill {
          min-width: 42px;
          height: 36px;
          display: inline-grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.10);
          font-size: 13px;
          font-weight: 950;
        }

        .hp-player-cell {
          min-width: 0;
        }

        .hp-player-name {
          color: #fff;
          font-size: 14px;
          font-weight: 950;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hp-player-meta {
          margin-top: 2px;
          color: rgba(255,255,255,0.52);
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hp-stat-cell {
          display: grid;
          gap: 1px;
        }

        .hp-stat-cell strong {
          color: #fff;
          font-size: 15px;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }

        .hp-stat-cell span {
          color: rgba(255,255,255,0.48);
          font-size: 10px;
          font-weight: 850;
        }

        .hp-text-right {
          text-align: right;
        }

        .hp-score-button:active {
          transform: translateY(1px) scale(0.97) !important;
        }

        .hp-score-button:focus-visible {
          outline: 3px solid rgba(34, 197, 94, 0.34);
          outline-offset: 3px;
        }

        .hp-score-button-selected:active {
          transform: translateY(0) scale(0.99) !important;
        }

        .hp-grid-2 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: stretch;
        }

        .hp-top3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .hp-score-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .hp-selected-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: stretch;
        }

        .hp-bottom-actions {
          display: grid;
          grid-template-columns: 108px 1fr;
          gap: 12px;
          max-width: 960px;
          margin: 0 auto;
        }

        .hp-modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          background: #0f172a;
          padding: 14px;
        }

        .hp-finish-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 8px;
        }

        @media (max-width: 720px) {
          .hp-leaderboard-shell {
            top: 6px;
            margin-left: -4px;
            margin-right: -4px;
          }

          .hp-leaderboard-card {
            border-radius: 24px;
          }

          .hp-leaderboard-hero {
            grid-template-columns: 1fr;
            padding: 14px;
          }

          .hp-leaderboard-leaderbox {
            min-width: 0;
          }

          .hp-leaderbox-name {
            max-width: none;
          }

          .hp-leaderboard-table {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }

          .hp-leaderboard-head,
          .hp-leaderboard-row {
            min-width: 540px;
          }

          .hp-leaderboard-rows {
            max-height: 220px;
          }

          .hp-grid-2,
          .hp-selected-row,
          .hp-modal-actions,
          .hp-finish-actions {
            grid-template-columns: 1fr;
          }

          .hp-live-hero-title {
            font-size: 24px;
          }

          .hp-bottom-actions {
            grid-template-columns: 90px 1fr;
            gap: 10px;
          }

          .hp-top3 {
            grid-template-columns: 1fr;
          }

          .hp-score-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 420px) {
          .hp-score-grid {
            gap: 8px;
          }

          .hp-bottom-actions {
            grid-template-columns: 84px 1fr;
          }
        }
      `}</style>

      <div style={styles.page} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <StatusToast saveState={saveState} />

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={liveHeaderStyle}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-18% auto auto -8%',
                width: 180,
                height: 180,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, rgba(34,197,94,0.24) 0%, rgba(34,197,94,0.02) 55%, rgba(34,197,94,0) 72%)',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: '#ffffff',
                    fontWeight: 900,
                    fontSize: 13,
                    letterSpacing: '-0.01em',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: '#ef4444',
                      boxShadow: '0 0 0 0 rgba(239, 68, 68, 0.42)',
                      animation: 'liveDotPulse 1.8s ease-out infinite',
                      flexShrink: 0,
                    }}
                  />
                  Live nu
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 28,
                    lineHeight: 1.05,
                    fontWeight: 950,
                    letterSpacing: '-0.03em',
                    color: '#ffffff',
                  }}
                >
                  Hål {holeIndexInSegment} av {totalHoles}
                </div>

                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    lineHeight: 1.45,
                    color: 'rgba(255,255,255,0.74)',
                    fontWeight: 700,
                    maxWidth: 520,
                  }}
                >
                  {players.length === 1
                    ? 'Följ spelet live med tydlig status, score och bana i fokus.'
                    : `${players.length} spelare är igång. Följ ställningen och uppdatera scorer i realtid.`}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gap: 8,
                  minWidth: 120,
                }}
              >
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 18,
                    background: 'linear-gradient(180deg, rgba(34,197,94,0.16) 0%, rgba(22,163,74,0.10) 100%)',
                    border: '1px solid rgba(74, 222, 128, 0.24)',
                    textAlign: 'right',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 0.7,
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.60)',
                    }}
                  >
                    Scorer
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 22,
                      fontWeight: 950,
                      color: '#ffffff',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {completedPlayersCount}/{players.length}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openHoleImage}
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 16,
                    padding: '12px 14px',
                    background:
                      'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.06) 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 900,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    minHeight: 52,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.18)',
                  }}
                >
                  <span aria-hidden="true">⛳</span>
                  <span>Se banvy</span>
                </button>

              </div>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={liveHeaderPillStyle}>Par {hole.par}</span>
              <span style={liveHeaderPillStyle}>HCP {hole.hcp_index}</span>
              <span style={liveHeaderPillStyle}>
                {isLastHoleInSequence ? 'Sista hålet' : `${holesRemainingInSegment} hål kvar`}
              </span>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'grid',
                gap: 8,
              }}
            >
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${liveProgress}%`,
                    height: '100%',
                    borderRadius: 999,
                    background:
                      'linear-gradient(90deg, #22c55e 0%, #34d399 45%, #60a5fa 100%)',
                    boxShadow: '0 0 20px rgba(96, 165, 250, 0.30)',
                  }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.62)',
                }}
              >
                <span>Start</span>
                <span>Spel pågår</span>
                <span>Mål</span>
              </div>
            </div>
          </div>

          </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {players.map((player, index) => {
            const playerId = String(player.id)

            return (
              <PlayerScoreCard
                key={player.id}
                player={player}
                index={index}
                hole={hole}
                selectedValue={values[playerId] ?? ''}
                onSetScore={(score) => setScore(playerId, score)}
                onClearScore={() => clearScore(playerId)}
                canInteract={canInteract}
                firstPlayerCardRef={firstPlayerCardRef}
                selectedHoleIndexes={selectedHoleIndexes}
                leaderboardMeta={leaderboardByPlayerId.get(playerId)}
                isLeader={leaderIds.has(playerId)}
                streak={playerStreaks?.[playerId] ?? 0}
                quickScores={quickScores}
                startHole={startHole}
                endHole={endHole}
              />
            )
          })}
        </div>

        <BottomBar
          canInteract={canInteract}
          isReadyToAdvance={isReadyToAdvance}
          completedPlayers={completedPlayersCount}
          totalPlayers={players.length}
          currentHole={currentHole}
          endHole={endHole}
          isLastHoleInSequence={isLastHoleInSequence}
          loading={loading}
          onPrevious={goPrevious}
          onSave={() => void saveScores()}
        />
      </div>

              <HoleImageModal
  show={showHoleImage}
  onClose={closeHoleImage}
  previewHoleNumber={previewHoleNumber}
  holeSequence={holeSequence}
  onPrevious={previewPreviousHole}
  onNext={previewNextHole}
  holeImageSrc={holeImageSrc}
  holeImageError={holeImageError}
  setHoleImageError={handleHoleImageError}
  distanceStatus={distanceStatus}
  distanceErrorMessage={distanceErrorMessage}
  distanceToFront={distanceToFront}
  distanceToCenter={distanceToCenter}
  distanceToBack={distanceToBack}
  zoom={zoom}
  pan={pan}
  isZooming={isZooming}
  onMapTap={handleMapTap}
  onMapTouchStart={handleMapTouchStart}
  onMapTouchMove={handleMapTouchMove}
  onMapTouchEnd={handleMapTouchEnd}
/>

      <FinishRoundModal
        open={showFinishModal}
        loading={loading}
        title={finishModalMode === 'finish-early' ? 'Avsluta rundan redan nu?' : 'Rundan är klar!'}
        description={
          finishModalMode === 'finish-early'
            ? 'Vi sparar scorerna för det här hålet och avslutar rundan direkt.'
            : 'Vill du avsluta rundan och gå vidare till leaderboard och scorekort?'
        }
        onCancel={() => {
          if (loading || isSavingRef.current || isNavigatingRef.current) return
          setShowFinishModal(false)
          setFinishModalMode('saved-last-hole')
        }}
        onConfirm={() => void confirmFinishRound()}
      />
    </>
  )
}
