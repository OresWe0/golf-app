import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getReceivedStrokesForSelectedHole,
  scoreVsPar,
  stablefordPoints,
} from '@/lib/scoring'

type RoundLike = {
  id: string
  title: string
  owner_id: string
  course_id: string
  current_hole: number | null
  start_hole: number | null
  end_hole: number | null
  holes_mode: number
  scoring_mode: 'stableford' | 'strokeplay'
  status?: string | null
  completed_at?: string | null
}

type Player = {
  id: string
  display_name?: string | null
  playing_handicap?: number | null
  active_from_hole?: number | null
  active_to_hole?: number | null
}

type Hole = {
  hole_number: number
  par: number
  hcp_index: number
}

type ScoreRow = {
  round_player_id: string
  hole_number: number
  strokes: number | null
}

type LeaderboardEntry = {
  playerId: string
  playerName: string
  position: number
  totalPoints: number
  totalToPar: number
  totalStrokes: number
  holesPlayed: number
  scoreText: string
}

function formatToPar(value: number) {
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function getMedal(position: number) {
  if (position === 1) return '🥇'
  if (position === 2) return '🥈'
  if (position === 3) return '🥉'
  return `#${position}`
}

function getVisibleHoles(holes: Hole[], startHole: number, endHole: number) {
  return holes.filter((hole) => hole.hole_number >= startHole && hole.hole_number <= endHole)
}

function buildLeaderboard({
  players,
  scoreRows,
  visibleHoles,
  selectedHoleIndexes,
  scoringMode,
  startHole,
  endHole,
}: {
  players: Player[]
  scoreRows: ScoreRow[]
  visibleHoles: Hole[]
  selectedHoleIndexes: number[]
  scoringMode: 'stableford' | 'strokeplay'
  startHole: number
  endHole: number
}): LeaderboardEntry[] {
  const playerById = new Map(players.map((player) => [String(player.id), player]))

  const base = players.map((player) => {
    const rows = scoreRows.filter(
      (row) =>
        row.round_player_id === player.id &&
        row.hole_number >= startHole &&
        row.hole_number <= endHole &&
        row.strokes != null
    )

    const holesPlayed = new Set(rows.map((row) => row.hole_number)).size
    const totalStrokes = rows.reduce((sum, row) => sum + (row.strokes ?? 0), 0)

    const totalToPar = rows.reduce((sum, row) => {
      const hole = visibleHoles.find((item) => item.hole_number === row.hole_number)
      return sum + (hole ? (scoreVsPar(row.strokes, hole.par) ?? 0) : 0)
    }, 0)

    const totalPoints = rows.reduce((sum, row) => {
      const hole = visibleHoles.find((item) => item.hole_number === row.hole_number)
      if (!hole || row.strokes == null) return sum

      return (
        sum +
        stablefordPoints(
          row.strokes,
          hole.par,
          getReceivedStrokesForSelectedHole(
            player.playing_handicap ?? 0,
            selectedHoleIndexes,
            hole.hcp_index
          )
        )
      )
    }, 0)

    return {
      playerId: String(player.id),
      totalPoints,
      totalToPar,
      totalStrokes,
      holesPlayed,
    }
  })

  const sorted = [...base].sort((a, b) => {
    if (scoringMode === 'stableford') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.holesPlayed !== a.holesPlayed) return b.holesPlayed - a.holesPlayed
      if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
      return a.playerId.localeCompare(b.playerId)
    }

    if (b.holesPlayed !== a.holesPlayed) return b.holesPlayed - a.holesPlayed
    if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
    if (a.totalToPar !== b.totalToPar) return a.totalToPar - b.totalToPar
    return a.playerId.localeCompare(b.playerId)
  })

  const leaderboard: LeaderboardEntry[] = []
  let lastPosition = 0

  sorted.forEach((entry, index) => {
    const previous = sorted[index - 1]
    const sameAsPrevious =
      previous &&
      (scoringMode === 'stableford'
        ? previous.totalPoints === entry.totalPoints &&
          previous.totalStrokes === entry.totalStrokes &&
          previous.holesPlayed === entry.holesPlayed
        : previous.totalStrokes === entry.totalStrokes &&
          previous.totalToPar === entry.totalToPar &&
          previous.holesPlayed === entry.holesPlayed)

    const position = sameAsPrevious ? lastPosition : index + 1
    lastPosition = position

    const player = playerById.get(entry.playerId)

    leaderboard.push({
      ...entry,
      position,
      playerName: player?.display_name ?? 'Spelare',
      scoreText:
        scoringMode === 'stableford' ? `${entry.totalPoints} p` : `${entry.totalStrokes} slag`,
    })
  })

  return leaderboard
}

export default async function RoundSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { id } = await params

  const { data: roundData } = await supabase
    .from('rounds')
    .select(
      'id, title, owner_id, course_id, current_hole, start_hole, end_hole, holes_mode, scoring_mode, status, completed_at'
    )
    .eq('id', id)
    .single()

  if (!roundData) notFound()

  const round = roundData as RoundLike

  if (round.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('round_members')
      .select('id')
      .eq('round_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) notFound()
  }

  const [{ data: courseData }, { data: holesData }, { data: playersData }, { data: scoreRowsData }] =
    await Promise.all([
      supabase.from('courses').select('id, name').eq('id', round.course_id).single(),
      supabase
        .from('course_holes')
        .select('hole_number, par, hcp_index')
        .eq('course_id', round.course_id)
        .order('hole_number'),
      supabase
        .from('round_players')
        .select('id, display_name, playing_handicap, active_from_hole, active_to_hole')
        .eq('round_id', id)
        .order('sort_order'),
      supabase
        .from('hole_scores')
        .select('round_player_id, hole_number, strokes')
        .eq('round_id', id)
        .order('hole_number'),
    ])

  if (!courseData || !holesData || !playersData) notFound()

  const players = playersData as Player[]
  const holes = holesData as Hole[]
  const scoreRows = (scoreRowsData ?? []) as ScoreRow[]

  const startHole = round.start_hole ?? 1
  const playedEndHole = round.end_hole ?? (round.holes_mode === 18 ? 18 : startHole + 8)
  const originalSelectedHoles = round.holes_mode === 18 ? 18 : 9
  const playedHolesCount = Math.max(0, playedEndHole - startHole + 1)
  const isPartialRound = originalSelectedHoles > playedHolesCount

  const visibleHoles = getVisibleHoles(holes, startHole, playedEndHole)
  const selectedHoleIndexes = visibleHoles.map((hole) => hole.hcp_index)
  const leaderboard = buildLeaderboard({
    players,
    scoreRows,
    visibleHoles,
    selectedHoleIndexes,
    scoringMode: round.scoring_mode,
    startHole,
    endHole: playedEndHole,
  })

  const winner = leaderboard[0]
  const totalPar = visibleHoles.reduce((sum, hole) => sum + hole.par, 0)
  const completedAt = round.completed_at
    ? new Intl.DateTimeFormat('sv-SE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(round.completed_at))
    : null

  return (
    <main
      style={{
        minHeight: '100dvh',
        background:
          'radial-gradient(circle at top, rgba(34,197,94,0.16), transparent 34%), linear-gradient(180deg, #f8fafc 0%, #eef7f0 100%)',
        padding: 'max(14px, env(safe-area-inset-top)) 14px max(22px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gap: 14 }}>
        <section
          style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 30,
            padding: 18,
            color: '#fff',
            background: 'linear-gradient(135deg, #0f241b 0%, #166534 58%, #22c55e 100%)',
            boxShadow: '0 24px 70px rgba(22, 101, 52, 0.24)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 36%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', display: 'grid', gap: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 11px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                {isPartialRound ? '🌅 Avslutad tidigt' : '🏁 Runda klar'}
              </div>
              <Link
                href="/dashboard"
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '7px 10px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.14)',
                }}
              >
                Hem
              </Link>
            </div>

            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(30px, 9vw, 48px)',
                  lineHeight: 0.95,
                  letterSpacing: -1.3,
                  fontWeight: 950,
                }}
              >
                {winner ? `${winner.playerName} vann` : round.title}
              </h1>
              <p style={{ margin: '9px 0 0', color: 'rgba(255,255,255,0.76)', fontSize: 14, fontWeight: 750 }}>
                {courseData.name} · {round.title}{completedAt ? ` · ${completedAt}` : ''}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 9 }}>
              <div className="summary-stat-card">
                <strong>{playedHolesCount}/{originalSelectedHoles}</strong>
                <span>hål</span>
              </div>
              <div className="summary-stat-card">
                <strong>{totalPar}</strong>
                <span>par</span>
              </div>
              <div className="summary-stat-card">
                <strong>{round.scoring_mode === 'stableford' ? 'Poäng' : 'Slag'}</strong>
                <span>spelform</span>
              </div>
            </div>
          </div>
        </section>

        {isPartialRound ? (
          <section
            style={{
              borderRadius: 24,
              padding: 14,
              background: 'rgba(255, 247, 237, 0.92)',
              border: '1px solid rgba(251, 146, 60, 0.24)',
              color: '#9a3412',
              fontWeight: 850,
              lineHeight: 1.45,
              boxShadow: '0 12px 34px rgba(245, 158, 11, 0.08)',
            }}
          >
            Rundan avslutades efter {playedHolesCount} av {originalSelectedHoles} valda hål. Leaderboarden räknar bara de hål som faktiskt spelades.
          </section>
        ) : null}

        <section style={{ display: 'grid', gap: 10 }}>
          {leaderboard.map((entry) => (
            <article
              key={entry.playerId}
              style={{
                display: 'grid',
                gridTemplateColumns: '48px minmax(0, 1fr) auto',
                gap: 12,
                alignItems: 'center',
                borderRadius: 24,
                padding: 13,
                background: entry.position === 1 ? '#ffffff' : 'rgba(255,255,255,0.82)',
                border: entry.position === 1 ? '1px solid rgba(34,197,94,0.28)' : '1px solid rgba(226,232,240,0.9)',
                boxShadow: entry.position === 1 ? '0 18px 44px rgba(34,197,94,0.12)' : '0 12px 30px rgba(15,23,42,0.06)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  display: 'grid',
                  placeItems: 'center',
                  background: entry.position === 1 ? '#dcfce7' : '#f1f5f9',
                  fontSize: 19,
                  fontWeight: 950,
                }}
              >
                {getMedal(entry.position)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 950, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {entry.playerName}
                </div>
                <div style={{ marginTop: 3, color: '#64748b', fontSize: 12, fontWeight: 800 }}>
                  {entry.holesPlayed}/{originalSelectedHoles} hål · {entry.totalStrokes} slag · {formatToPar(entry.totalToPar)} mot par
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, lineHeight: 1, fontWeight: 950, color: '#166534' }}>
                  {entry.scoreText}
                </div>
                <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 11, fontWeight: 900 }}>
                  plats {entry.position}
                </div>
              </div>
            </article>
          ))}
        </section>

        <Link
          href={`/rounds/${id}`}
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: 56,
            borderRadius: 22,
            background: '#0f172a',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 950,
            boxShadow: '0 16px 36px rgba(15,23,42,0.18)',
          }}
        >
          Visa rundan igen
        </Link>
      </div>

      <style>{`
        .summary-stat-card {
          min-height: 78px;
          border-radius: 21px;
          background: rgba(255,255,255,0.16);
          border: 1px solid rgba(255,255,255,0.20);
          display: grid;
          place-items: center;
          align-content: center;
          gap: 4px;
          text-align: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
        }

        .summary-stat-card strong {
          font-size: 22px;
          line-height: 1;
          font-weight: 950;
          color: #fff;
          font-variant-numeric: tabular-nums;
        }

        .summary-stat-card span {
          color: rgba(255,255,255,0.68);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          font-weight: 950;
        }
      `}</style>
    </main>
  )
}
