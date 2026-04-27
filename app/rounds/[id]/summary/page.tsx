import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  getReceivedStrokesForSelectedHole,
  scoreVsPar,
  stablefordPoints,
} from '@/lib/scoring'

type HoleLike = {
  hole_number: number
  par: number
  hcp_index: number
}

type RoundPlayer = {
  id: string
  display_name?: string
  exact_handicap?: number | null
  playing_handicap?: number | null
  tee_key?: string
  active_from_hole?: number | null
  active_to_hole?: number | null
}

type HoleScoreRow = {
  round_player_id: string
  hole_number: number
  strokes: number | null
}

type RoundLike = {
  id: string
  title: string
  course_id: string
  owner_id: string
  current_hole: number | null
  start_hole: number | null
  end_hole: number | null
  holes_mode: number
  scoring_mode: 'stableford' | 'strokeplay'
}

type CourseLike = {
  id: string
  name: string
}

type LeaderboardEntry = {
  playerId: string
  playerName: string
  position: number
  scoreText: string
  totalPoints: number
  totalToPar: number
  totalStrokes: number
  isLeader: boolean
}

function parseHoleNumber(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.floor(parsed)
}

function getRoundModeLabel(round: RoundLike, startHole: number) {
  if (round.holes_mode === 18) return '18 hål'
  return startHole === 1 ? '9 hål · Främre 9' : '9 hål · Bakre 9'
}

function getVisibleHoles(holes: HoleLike[], startHole: number, endHole: number) {
  return holes.filter(
    (item) => item.hole_number >= startHole && item.hole_number <= endHole
  )
}

function isPlayerActiveOnHole(
  player: RoundPlayer,
  holeNumber: number,
  startHole: number,
  endHole: number
) {
  const activeFrom = player.active_from_hole ?? startHole
  const activeTo = player.active_to_hole ?? endHole
  return holeNumber >= activeFrom && holeNumber <= activeTo
}

function formatToPar(value?: number | null) {
  if (value == null || value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function getMedal(position: number) {
  if (position === 1) return '🥇'
  if (position === 2) return '🥈'
  if (position === 3) return '🥉'
  return `#${position}`
}

function getScoreLabel(strokes: number | null, par: number) {
  if (strokes == null) return '-'
  const diff = strokes - par
  if (diff <= -2) return 'Eagle+'
  if (diff === -1) return 'Birdie'
  if (diff === 0) return 'Par'
  if (diff === 1) return 'Bogey'
  return 'Double+'
}

function buildLeaderboard(params: {
  players: RoundPlayer[]
  scoreRows: HoleScoreRow[]
  visibleHoles: HoleLike[]
  selectedHoleIndexes: number[]
  scoringMode: RoundLike['scoring_mode']
  startHole: number
  endHole: number
}): LeaderboardEntry[] {
  const {
    players,
    scoreRows,
    visibleHoles,
    selectedHoleIndexes,
    scoringMode,
    startHole,
    endHole,
  } = params

  const playerById = new Map(players.map((player) => [String(player.id), player]))

  const leaderboardBase = players.map((player) => {
    const rows = scoreRows.filter(
      (row) =>
        row.round_player_id === player.id &&
        row.hole_number >= startHole &&
        row.hole_number <= endHole
    )

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
      totalStrokes,
      totalToPar,
      totalPoints,
    }
  })

  const sortedLeaderboard = [...leaderboardBase].sort((a, b) => {
    if (scoringMode === 'stableford') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
      return a.playerId.localeCompare(b.playerId)
    }

    if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
    if (a.totalToPar !== b.totalToPar) return a.totalToPar - b.totalToPar
    return a.playerId.localeCompare(b.playerId)
  })

  const leaderboard: LeaderboardEntry[] = []
  let lastPosition = 0

  for (let index = 0; index < sortedLeaderboard.length; index++) {
    const entry = sortedLeaderboard[index]
    const previous = sortedLeaderboard[index - 1]

    const sameAsPrevious =
      previous &&
      (scoringMode === 'stableford'
        ? previous.totalPoints === entry.totalPoints &&
          previous.totalStrokes === entry.totalStrokes
        : previous.totalStrokes === entry.totalStrokes &&
          previous.totalToPar === entry.totalToPar)

    const position = sameAsPrevious ? lastPosition : index + 1
    lastPosition = position

    const player = playerById.get(entry.playerId)
    const scoreText =
      scoringMode === 'stableford'
        ? `${entry.totalPoints} p`
        : `${entry.totalStrokes} slag`

    leaderboard.push({
      playerId: entry.playerId,
      playerName: player?.display_name ?? 'Spelare',
      position,
      scoreText,
      totalPoints: entry.totalPoints,
      totalToPar: entry.totalToPar,
      totalStrokes: entry.totalStrokes,
      isLeader: position === 1,
    })
  }

  return leaderboard
}

function SummaryHero({
  roundTitle,
  courseName,
  modeLabel,
  currentHoleNumber,
  totalHoles,
  roundId,
}: {
  roundTitle: string
  courseName: string
  modeLabel: string
  currentHoleNumber: number
  totalHoles: number
  roundId: string
}) {
  return (
    <section
      className="card"
      style={{
        padding: 18,
        borderRadius: 26,
        background:
          'linear-gradient(145deg, rgba(244,252,246,0.98), rgba(255,255,255,0.96))',
        border: '1px solid rgba(36, 122, 67, 0.12)',
        boxShadow: '0 16px 42px rgba(20, 77, 43, 0.10)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge">🏆 Leaderboard</span>
            <span className="badge">{modeLabel}</span>
            <span className="badge">Hål {currentHoleNumber}/{totalHoles}</span>
          </div>
          <div>
            <h1 className="title" style={{ margin: 0, fontSize: 'clamp(28px, 8vw, 42px)', lineHeight: 1 }}>
              {roundTitle}
            </h1>
            <p className="muted meta" style={{ margin: '4px 0 0' }}>{courseName}</p>
          </div>
        </div>

        <Link
          className="button secondary"
          href={`/rounds/${roundId}?hole=${currentHoleNumber}`}
          style={{ borderRadius: 999, alignSelf: 'flex-start' }}
        >
          Till rundan
        </Link>
      </div>
    </section>
  )
}

function FullLeaderboard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #12231d 0%, #1f7a3a 100%)',
        color: '#fff',
        borderRadius: 26,
        padding: 18,
        boxShadow: '0 18px 45px rgba(21, 90, 45, 0.22)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.16)',
              fontSize: 12,
              fontWeight: 900,
              textTransform: 'uppercase',
            }}
          >
            🔴 Live leaderboard
          </div>
          <h2 style={{ margin: '10px 0 0', fontSize: 26, lineHeight: 1 }}>Ställning</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {leaderboard.map((entry) => (
          <div
            key={entry.playerId}
            style={{
              display: 'grid',
              gridTemplateColumns: '46px minmax(0, 1fr) auto auto',
              gap: 10,
              alignItems: 'center',
              padding: 12,
              borderRadius: 18,
              background: entry.isLeader ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.10)',
              border: entry.isLeader
                ? '1px solid rgba(255,255,255,0.35)'
                : '1px solid rgba(255,255,255,0.16)',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 950 }}>{getMedal(entry.position)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {entry.playerName}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)' }}>
                {entry.totalStrokes} slag totalt
              </div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 950 }}>{entry.scoreText}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: 'rgba(255,255,255,0.72)' }}>
              {formatToPar(entry.totalToPar)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Scorecards({
  players,
  holes,
  scoreRows,
}: {
  players: RoundPlayer[]
  holes: HoleLike[]
  scoreRows: HoleScoreRow[]
}) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0, fontSize: 26 }}>Scorekort</h2>

      {players.map((player) => {
        const rowsByHole = new Map(
          scoreRows
            .filter((row) => row.round_player_id === player.id)
            .map((row) => [row.hole_number, row])
        )

        const totalStrokes = holes.reduce(
          (sum, hole) => sum + (rowsByHole.get(hole.hole_number)?.strokes ?? 0),
          0
        )

        const totalToPar = holes.reduce((sum, hole) => {
          const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
          return sum + (scoreVsPar(strokes, hole.par) ?? 0)
        }, 0)

        return (
          <article
            key={player.id}
            className="card"
            style={{
              padding: 14,
              borderRadius: 24,
              border: '1px solid rgba(36, 122, 67, 0.14)',
              boxShadow: '0 12px 34px rgba(20, 77, 43, 0.08)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 22 }}>{player.display_name ?? 'Spelare'}</h3>
                <p className="muted" style={{ margin: '3px 0 0', fontWeight: 800 }}>
                  Totalt: {totalStrokes} slag · Till par {formatToPar(totalToPar)}
                </p>
              </div>
              <span className="badge">{player.tee_key ?? 'Tee'}</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 720 }}>
                <thead>
                  <tr>
                    <th style={cellHeaderStyle}>Hål</th>
                    {holes.map((hole) => (
                      <th key={hole.hole_number} style={cellHeaderStyle}>{hole.hole_number}</th>
                    ))}
                    <th style={cellHeaderStyle}>Totalt</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={cellLabelStyle}>Par</td>
                    {holes.map((hole) => <td key={hole.hole_number} style={cellStyle}>{hole.par}</td>)}
                    <td style={cellStyle}>{holes.reduce((sum, hole) => sum + hole.par, 0)}</td>
                  </tr>
                  <tr>
                    <td style={cellLabelStyle}>Slag</td>
                    {holes.map((hole) => {
                      const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
                      return <td key={hole.hole_number} style={cellStyle}>{strokes ?? '-'}</td>
                    })}
                    <td style={cellStyle}>{totalStrokes}</td>
                  </tr>
                  <tr>
                    <td style={cellLabelStyle}>Resultat</td>
                    {holes.map((hole) => {
                      const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
                      return <td key={hole.hole_number} style={cellSmallStyle}>{getScoreLabel(strokes, hole.par)}</td>
                    })}
                    <td style={cellSmallStyle}>{formatToPar(totalToPar)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        )
      })}
    </section>
  )
}

const cellHeaderStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  textAlign: 'center',
  color: '#61705f',
  background: '#f5fbf6',
  borderBottom: '1px solid rgba(20,77,43,0.10)',
}

const cellLabelStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12,
  fontWeight: 950,
  color: '#26382d',
  background: '#f9fcfa',
  borderBottom: '1px solid rgba(20,77,43,0.08)',
  textAlign: 'left',
}

const cellStyle: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
  fontSize: 15,
  fontWeight: 900,
  borderBottom: '1px solid rgba(20,77,43,0.08)',
}

const cellSmallStyle: React.CSSProperties = {
  ...cellStyle,
  fontSize: 11,
  color: '#667085',
  textTransform: 'uppercase',
}

export default async function SummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ hole?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const resolvedSearchParams = await searchParams

  const { data: roundData } = await supabase
    .from('rounds')
    .select('id, title, owner_id, course_id, current_hole, start_hole, end_hole, holes_mode, scoring_mode')
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

  const requestedHoleNumber = resolvedSearchParams.hole
    ? parseHoleNumber(resolvedSearchParams.hole)
    : round.current_hole ?? round.start_hole ?? 1

  const [
    { data: playersData },
    { data: courseData },
    { data: holesData },
    { data: allScoreRowsData },
  ] = await Promise.all([
    supabase
      .from('round_players')
      .select('id, display_name, exact_handicap, playing_handicap, tee_key, active_from_hole, active_to_hole')
      .eq('round_id', id)
      .order('sort_order'),
    supabase.from('courses').select('id, name').eq('id', round.course_id).single(),
    supabase
      .from('course_holes')
      .select('hole_number, par, hcp_index')
      .eq('course_id', round.course_id)
      .order('hole_number'),
    supabase
      .from('hole_scores')
      .select('round_player_id, hole_number, strokes')
      .eq('round_id', id)
      .order('hole_number'),
  ])

  if (!courseData || !holesData || !playersData) notFound()

  const players = (playersData ?? []).map((player) => ({
    ...player,
    display_name: player.display_name ?? undefined,
    tee_key: player.tee_key ?? undefined,
  })) as RoundPlayer[]

  const course = courseData as CourseLike
  const holes = holesData as HoleLike[]
  const scoreRows = (allScoreRowsData ?? []) as HoleScoreRow[]

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length
  const visibleHoles = getVisibleHoles(holes, startHole, endHole)

  if (!visibleHoles.length) notFound()

  const currentHole =
    visibleHoles.find((item) => item.hole_number === requestedHoleNumber) ??
    visibleHoles.find((item) => item.hole_number === round.current_hole) ??
    visibleHoles[0]

  const playersForSummary = players.filter((player) =>
    isPlayerActiveOnHole(player, currentHole.hole_number, startHole, endHole)
  )
  const activePlayers = playersForSummary.length > 0 ? playersForSummary : players

  const leaderboard = buildLeaderboard({
    players: activePlayers,
    scoreRows,
    visibleHoles,
    selectedHoleIndexes: visibleHoles.map((item) => item.hcp_index),
    scoringMode: round.scoring_mode,
    startHole,
    endHole,
  })

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <SummaryHero
          roundTitle={round.title}
          courseName={course.name}
          modeLabel={getRoundModeLabel(round, startHole)}
          currentHoleNumber={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          roundId={id}
        />

        <FullLeaderboard leaderboard={leaderboard} />

        <Scorecards
          players={activePlayers}
          holes={visibleHoles}
          scoreRows={scoreRows}
        />
      </div>
    </main>
  )
}
