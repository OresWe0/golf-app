'use client'

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
            borderRadius: 20,
            background:
              'linear-gradient(135deg, rgba(236,253,245,0.92) 0%, rgba(220,252,231,0.88) 100%)',
            border: '1px solid rgba(134, 239, 172, 0.65)',
            padding: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#166534',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Hålstatus
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 24,
              fontWeight: 900,
              lineHeight: 1.05,
              color: '#0f172a',
            }}
          >
            Hål {hole.hole_number} / {totalHoles}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 14,
              fontWeight: 800,
              color: '#475569',
              lineHeight: 1.35,
            }}
          >
            Par {hole.par} · Index {hole.hcp_index}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenHoleImage}
          style={{
            border: '1px solid rgba(22,101,52,0.10)',
            borderRadius: 18,
            padding: '12px 14px',
            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 10px 24px rgba(34, 197, 94, 0.20)',
            whiteSpace: 'nowrap',
            minWidth: 110,
          }}
        >
          ⛳ Se banan
        </button>
      </div>
    </div>
  )
}

function LiveLeaderboard({
  leaderboard,
  players,
}: {
  leaderboard: LeaderboardEntry[]
  players: Player[]
}) {
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

  if (!topLeaderboard.length) return null

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 10,
        background:
          'linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(30,41,59,0.90) 100%)',
        color: '#fff',
        display: 'grid',
        gap: 8,
        boxShadow: '0 18px 36px rgba(15, 23, 42, 0.16)',
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
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.72, letterSpacing: 0.4 }}>
            LIVE LEADERBOARD
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, marginTop: 2 }}>Topp 3 just nu</div>
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            opacity: 0.72,
          }}
        >
          Live
        </div>
      </div>

      <div className="hp-top3">
        {topLeaderboard.map((entry) => {
          const player = players.find((p) => String(p.id) === String(entry.playerId))
          const isLeader = entry.position === 1

          return (
            <div
              key={`lb-${entry.playerId}`}
              style={{
                borderRadius: 14,
                padding: isLeader ? 11 : 9,
                background: isLeader
                  ? 'linear-gradient(135deg, rgba(34,197,94,0.26) 0%, rgba(22,163,74,0.18) 100%)'
                  : 'rgba(255,255,255,0.06)',
                border: isLeader
                  ? '1px solid rgba(74, 222, 128, 0.50)'
                  : '1px solid rgba(255,255,255,0.06)',
                minWidth: 0,
                boxShadow: isLeader ? '0 10px 24px rgba(34, 197, 94, 0.18)' : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.78,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {isLeader ? '👑' : null} #{entry.position}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontWeight: 900,
                  fontSize: isLeader ? 14 : 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {player?.display_name ?? 'Spelare'}
              </div>

              <div
                style={{
                  marginTop: 4,
                  opacity: 0.86,
                  fontSize: 11,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {entry.totalPoints != null
                  ? `${entry.totalPoints} p · ${formatToPar(entry.totalToPar)}`
                  : entry.scoreText ?? '-'}
              </div>

              {isLeader ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#bbf7d0',
                  }}
                >
                  Leder just nu
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
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

  return (
    <button
      type="button"
      onClick={onClick}
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
        cursor: disabled ? 'not-allowed' : 'pointer',
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
        opacity: disabled ? 0.9 : 1,
      }}
      disabled={disabled}
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
              👑 Leder nu
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
  startHole,
  endHole,
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
}: {
  show: boolean
  onClose: () => void
  previewHoleNumber: number
  startHole: number
  endHole: number
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
}) {
  if (!show) return null

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

        <div className="hp-modal-actions">
          <button
            type="button"
            onClick={onPrevious}
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
              cursor: previewHoleNumber <= startHole ? 'not-allowed' : 'pointer',
            }}
          >
            ← Föregående
          </button>

          <button
            type="button"
            onClick={onNext}
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
              cursor: previewHoleNumber >= endHole ? 'not-allowed' : 'pointer',
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
  onCancel,
  onConfirm,
}: {
  open: boolean
  loading: boolean
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
        <div style={{ fontSize: 24, fontWeight: 900 }}>🎉 Rundan är klar!</div>

        <div style={{ color: '#475569', fontSize: 15, lineHeight: 1.55 }}>
          Vill du avsluta rundan och gå vidare till leaderboard och scorekort?
        </div>

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
  currentHole,
  endHole,
  loading,
  onPrevious,
  onSave,
}: {
  canInteract: boolean
  isReadyToAdvance: boolean
  currentHole: number
  endHole: number
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
          }}
        >
          {loading
            ? 'Sparar...'
            : !isReadyToAdvance
              ? 'Fyll i alla scorer'
              : currentHole === endHole
                ? 'Klar – avsluta runda →'
                : 'Klar – nästa hål →'}
        </button>
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
}: Props) {
  const router = useRouter()

  const touchStartX = useRef<number | null>(null)
  const firstPlayerCardRef = useRef<HTMLDivElement | null>(null)
  const hasUserChangedScoreRef = useRef(false)
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const isSavingRef = useRef(false)
  const isNavigatingRef = useRef(false)

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

  const holeImageSrc = `/course-images/karsta/${previewHoleNumber}.jpg`

  const allPlayersHaveScores = (candidateValues: Record<string, string>) => {
    if (!players.length) return false

    return players.every((player) => {
      const value = candidateValues[String(player.id)]
      return value !== '' && value !== undefined && value !== null
    })
  }

  const isReadyToAdvance = allPlayersHaveScores(values)
  const canInteract = !loading && !isSavingRef.current && !isNavigatingRef.current

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
    const holeGps = HOLE_GPS_DATA[holeNumber]

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

  const navigateTo = (target: string) => {
    if (isNavigatingRef.current) return

    clearToastTimeout()
    isNavigatingRef.current = true
    router.push(target)
  }

  const goPrevious = () => {
    if (!canInteract) return

    const target =
      currentHole > startHole ? `/rounds/${roundId}?hole=${currentHole - 1}` : '/dashboard'

    navigateTo(target)
  }

  const goNext = () => {
    if (!canInteract) return

    const target =
      currentHole === endHole
        ? `/rounds/${roundId}/summary`
        : `/rounds/${roundId}?hole=${currentHole + 1}`

    navigateTo(target)
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

  const confirmFinishRound = async () => {
    if (!canInteract) return

    isSavingRef.current = true
    setLoading(true)

    try {
      const response = await fetch(`/api/rounds/${roundId}/complete`, {
        method: 'POST',
      })

      if (!response.ok) {
        alert('Kunde inte avsluta rundan.')
        return
      }

      navigateTo(`/rounds/${roundId}/summary`)
    } finally {
      if (!isNavigatingRef.current) {
        setLoading(false)
        isSavingRef.current = false
      }
    }
  }

  const saveScores = async (overrideValues?: Record<string, string>) => {
    const valuesToSave = overrideValues ?? values

    if (loading) return
    if (isSavingRef.current) return
    if (isNavigatingRef.current) return
    if (!allPlayersHaveScores(valuesToSave)) return

    isSavingRef.current = true
    setLoading(true)
    setSaveState('saving')
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

      if (currentHole === endHole) {
        setShowFinishModal(true)
        return
      }

      goNext()
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
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
    setShowHoleImage(true)
    setPlayerPosition(null)
    resetDistanceState()
    setDistanceStatus('loading')
    setDistanceErrorMessage(null)
  }

  const closeHoleImage = () => {
    setShowHoleImage(false)
    setDistanceStatus('idle')
    setDistanceErrorMessage(null)
    resetDistanceState()
  }

  const previewPreviousHole = () => {
    if (previewHoleNumber > startHole) {
      setPreviewHoleNumber((prev) => prev - 1)
      setHoleImageError(false)

      if (playerPosition) {
        setDistanceStatus('loading')
      }
    }
  }

  const previewNextHole = () => {
    if (previewHoleNumber < endHole) {
      setPreviewHoleNumber((prev) => prev + 1)
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
      if (diff > 70 && previewHoleNumber > startHole) previewPreviousHole()
      if (diff < -70 && previewHoleNumber < endHole) previewNextHole()
      touchStartX.current = null
      return
    }

    if (diff > 70 && currentHole > startHole) {
      goPrevious()
    }

    if (diff < -70 && currentHole < endHole && isReadyToAdvance) {
      void saveScores()
    }

    touchStartX.current = null
  }

  useEffect(() => {
    setValues(createValuesFromScores())
    setPreviewHoleNumber(hole.hole_number)
    setHoleImageError(false)
    setShowFinishModal(false)
    setSaveState('idle')

    hasUserChangedScoreRef.current = false
    isSavingRef.current = false
    isNavigatingRef.current = false

    setLoading(false)

    clearToastTimeout()

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

        @keyframes ctaReadyPulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.22); }
          100% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
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
          .hp-grid-2,
          .hp-selected-row,
          .hp-bottom-actions,
          .hp-modal-actions,
          .hp-finish-actions {
            grid-template-columns: 1fr;
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
        }
      `}</style>

      <div style={styles.page} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <StatusToast saveState={saveState} />

        <div style={{ display: 'grid', gap: 12 }}>
          <HoleHeader hole={hole} totalHoles={totalHoles} onOpenHoleImage={openHoleImage} />
          <LiveLeaderboard leaderboard={leaderboard} players={players} />
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
              />
            )
          })}
        </div>

        <BottomBar
          canInteract={canInteract}
          isReadyToAdvance={isReadyToAdvance}
          currentHole={currentHole}
          endHole={endHole}
          loading={loading}
          onPrevious={goPrevious}
          onSave={() => void saveScores()}
        />
      </div>

      <HoleImageModal
        show={showHoleImage}
        onClose={closeHoleImage}
        previewHoleNumber={previewHoleNumber}
        startHole={startHole}
        endHole={endHole}
        onPrevious={previewPreviousHole}
        onNext={previewNextHole}
        holeImageSrc={holeImageSrc}
        holeImageError={holeImageError}
        setHoleImageError={setHoleImageError}
        distanceStatus={distanceStatus}
        distanceErrorMessage={distanceErrorMessage}
        distanceToFront={distanceToFront}
        distanceToCenter={distanceToCenter}
        distanceToBack={distanceToBack}
      />

      <FinishRoundModal
        open={showFinishModal}
        loading={loading}
        onCancel={() => {
          if (loading || isSavingRef.current || isNavigatingRef.current) return
          setShowFinishModal(false)
        }}
        onConfirm={() => void confirmFinishRound()}
      />
    </>
  )
}