import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HolePlay } from '@/components/hole-play'
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

type HoleGpsRow = {
  hole_number: number
  front_lat: number
  front_lng: number
  center_lat: number
  center_lng: number
  back_lat: number
  back_lng: number
}

function toCourseImageSlug(name?: string | null) {
  const source = String(name ?? '').trim().toLowerCase()
  if (!source) return undefined

  const normalized = source
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (normalized.includes('karsta')) return 'karsta'
  if (normalized.includes('lindesberg')) return 'lindesberg'

  return normalized || undefined
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

    const scoreText =
      scoringMode === 'stableford'
        ? `${entry.totalPoints} p`
        : `${entry.totalStrokes} slag`

    leaderboard.push({
      playerId: entry.playerId,
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

function RoundHero({
  roundTitle,
  courseName,
  currentHoleNumber,
  totalHoles,
  modeLabel,
  par,
  hcpIndex,
  roundId,
}: {
  roundTitle: string
  courseName: string
  currentHoleNumber: number
  totalHoles: number
  modeLabel: string
  par: number
  hcpIndex: number
  roundId: string
}) {
  return (
    <div
      className="card round-hero"
      style={{
        padding: 22,
      }}
    >
      <div style={{ display: 'grid', gap: 18 }}>
        <div
          className="round-hero-top"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 820, display: 'grid', gap: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span className="badge">🏌️ Runda</span>
              <span className="badge">{modeLabel}</span>
            </div>

            <div style={{ display: 'grid', gap: 6 }}>
              <h1 className="title" style={{ margin: 0 }}>
                {roundTitle}
              </h1>

              <p className="muted meta" style={{ margin: 0 }}>
                {courseName}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div className="card" style={{ padding: '10px 14px' }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Aktuellt hål
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  Hål {currentHoleNumber}
                </div>
              </div>

              <div className="card" style={{ padding: '10px 14px' }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Par
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{par}</div>
              </div>

              <div className="card" style={{ padding: '10px 14px' }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Index
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{hcpIndex}</div>
              </div>

              <div className="card" style={{ padding: '10px 14px' }}>
                <div className="muted" style={{ fontSize: 12 }}>
                  Hålvy
                </div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {currentHoleNumber} / {totalHoles}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <Link
              className="button leaderboard-button"
              href={`/rounds/${roundId}/summary?hole=${currentHoleNumber}`}
            >
              🏆 Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
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

  const { data: roundData } = await supabase
    .from('rounds')
    .select(
      'id, title, owner_id, course_id, current_hole, start_hole, end_hole, holes_mode, scoring_mode'
    )
    .eq('id', id)
    .single()

  if (!roundData) {
    notFound()
  }

  const round = roundData as RoundLike

  if (round.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('round_members')
      .select('id')
      .eq('round_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      notFound()
    }
  }

  const requestedHoleNumber = resolvedSearchParams.hole
    ? parseHoleNumber(resolvedSearchParams.hole)
    : round.current_hole ?? round.start_hole ?? 1

  const [
    { data: playersData },
    { data: courseData },
    { data: holesData },
    { data: allScoreRowsData },
    { data: holeGpsData },
  ] = await Promise.all([
    supabase
      .from('round_players')
      .select('id, display_name, exact_handicap, playing_handicap, tee_key')
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
    supabase
      .from('course_hole_gps')
      .select(
        'hole_number, front_lat, front_lng, center_lat, center_lng, back_lat, back_lng'
      )
      .eq('course_id', round.course_id),
  ])

  if (!courseData || !holesData || !playersData) {
    notFound()
  }

  const players = playersData as RoundPlayer[]
  const course = courseData as CourseLike
  const holes = holesData as HoleLike[]
  const scoreRows = (allScoreRowsData ?? []) as HoleScoreRow[]
  const holeGpsRows = (holeGpsData ?? []) as HoleGpsRow[]
  const holeGpsByNumber = Object.fromEntries(
    holeGpsRows.map((row) => [
      row.hole_number,
      {
        front: { lat: row.front_lat, lng: row.front_lng },
        center: { lat: row.center_lat, lng: row.center_lng },
        back: { lat: row.back_lat, lng: row.back_lng },
      },
    ])
  )

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length

  const visibleHoles = getVisibleHoles(holes, startHole, endHole)

  if (!visibleHoles.length) {
    notFound()
  }

  const selectedHoleIndexes = visibleHoles.map((item) => item.hcp_index)

  const currentHole =
    visibleHoles.find((item) => item.hole_number === requestedHoleNumber) ?? null

  if (!currentHole) {
    redirect(`/rounds/${id}?hole=${round.current_hole ?? startHole}`)
  }

  const currentHoleScores = scoreRows.filter(
    (row) => row.hole_number === currentHole.hole_number
  )

  const leaderboard = buildLeaderboard({
    players,
    scoreRows,
    visibleHoles,
    selectedHoleIndexes,
    scoringMode: round.scoring_mode,
    startHole,
    endHole,
  })

  const modeLabel = getRoundModeLabel(round, startHole)

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 18 }}>
        <RoundHero
          roundTitle={round.title}
          courseName={course.name}
          currentHoleNumber={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          modeLabel={modeLabel}
          par={currentHole.par}
          hcpIndex={currentHole.hcp_index}
          roundId={id}
        />

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
          selectedHoleIndexes={selectedHoleIndexes}
          courseImageSlug={toCourseImageSlug(course.name)}
          holeGpsByNumber={holeGpsByNumber}
        />
      </div>
    </main>
  )
}
