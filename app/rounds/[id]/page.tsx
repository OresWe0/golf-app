import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HolePlay } from '@/components/hole-play'
import { receivedStrokesOnHole, scoreVsPar, stablefordPoints } from '@/lib/scoring'

type HoleLike = {
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

type RoundPlayer = {
  id: string
  playing_handicap?: number | null
}

type HoleScoreRow = {
  round_player_id: string
  hole_number: number
  strokes: number | null
}

function parseHoleNumber(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.floor(parsed)
}

export default async function RoundPage({
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
  const requestedHoleNumber = parseHoleNumber(resolvedSearchParams.hole)

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', id)
    .single()

  if (!round) {
    notFound()
  }

  const [
    { data: players },
    { data: course },
    { data: holes },
    { data: allScoreRows },
  ] = await Promise.all([
    supabase.from('round_players').select('*').eq('round_id', id).order('sort_order'),
    supabase.from('courses').select('*').eq('id', round.course_id).single(),
    supabase.from('course_holes').select('*').eq('course_id', round.course_id).order('hole_number'),
    supabase.from('hole_scores').select('*').eq('round_id', id).order('hole_number'),
  ])

  if (!course || !holes || !players) {
    notFound()
  }

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length

  const visibleHoles = holes.filter(
    (item: HoleLike) => item.hole_number >= startHole && item.hole_number <= endHole
  )

  if (!visibleHoles.length) {
    notFound()
  }

  const currentHole =
    visibleHoles.find((item: HoleLike) => item.hole_number === requestedHoleNumber) ??
    visibleHoles[0]

  const scoreRows = (allScoreRows ?? []) as HoleScoreRow[]
  const currentHoleScores = scoreRows.filter(
    (row) => row.hole_number === currentHole.hole_number
  )

  const handicapHoleCount = visibleHoles.length

  const leaderboardBase = (players as RoundPlayer[]).map((player) => {
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
          receivedStrokesOnHole(
            player.playing_handicap ?? 0,
            hole.hcp_index,
            handicapHoleCount
          )
        )
      )
    }, 0)

    const completedHoles = rows.filter((row) => row.strokes != null).length

    return {
      playerId: String(player.id),
      totalStrokes,
      totalToPar,
      totalPoints,
      completedHoles,
    }
  })

  const sortedLeaderboard = [...leaderboardBase].sort((a, b) => {
    if (round.scoring_mode === 'stableford') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
      return a.playerId.localeCompare(b.playerId)
    }

    if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
    if (a.totalToPar !== b.totalToPar) return a.totalToPar - b.totalToPar
    return a.playerId.localeCompare(b.playerId)
  })

  const leaderboard: LeaderboardEntry[] = sortedLeaderboard
    .map((entry, index, arr) => {
      const previous = arr[index - 1]

      const sameAsPrevious =
        previous &&
        (round.scoring_mode === 'stableford'
          ? previous.totalPoints === entry.totalPoints &&
            previous.totalStrokes === entry.totalStrokes
          : previous.totalStrokes === entry.totalStrokes &&
            previous.totalToPar === entry.totalToPar)

      const position = sameAsPrevious
        ? (arr[index - 1] as LeaderboardEntry & { __position: number }).__position
        : index + 1

      const scoreText =
        round.scoring_mode === 'stableford'
          ? `${entry.totalPoints} p`
          : `${entry.totalStrokes} slag`

      return {
        playerId: entry.playerId,
        position,
        scoreText,
        totalPoints: entry.totalPoints,
        totalToPar: entry.totalToPar,
        totalStrokes: entry.totalStrokes,
        isLeader: position === 1,
        __position: position,
      } as LeaderboardEntry & { __position: number }
    })
    .map(({ __position, ...entry }) => entry)

  return (
    <main>
      <div className="container">
        <div className="nav">
          <div>
            <span className="badge">🏌️ {round.title}</span>
            <h1>{course.name}</h1>
            <p className="muted">
              {round.holes_mode === 18
                ? '18 hål'
                : startHole === 1
                  ? '9 hål · Främre 9'
                  : '9 hål · Bakre 9'}
            </p>
          </div>

          <Link
            className="button"
            href={`/rounds/${id}/summary?hole=${currentHole.hole_number}`}
            style={{
              fontWeight: 800,
              fontSize: 16,
              padding: '12px 18px',
            }}
          >
            🏆 Leaderboard
          </Link>
        </div>

        <HolePlay
          roundId={id}
          currentHole={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          startHole={startHole}
          endHole={endHole}
          hole={currentHole}
          players={players}
          scores={currentHoleScores}
          leaderboard={leaderboard}
        />
      </div>
    </main>
  )
}