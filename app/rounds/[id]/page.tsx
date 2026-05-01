import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HolePlay } from '@/components/hole-play'
import FinishRoundQuickAction from '@/components/finish-round-quick-action'
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
  playerName?: string
  position: number
  scoreText?: string
  totalPoints?: number
  totalToPar?: number
  totalStrokes?: number
  isLeader?: boolean
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

function buildHoleOrder(startHole: number, endHole: number, totalHoles: number) {
  if (totalHoles <= 0) return []
  const start = Math.min(Math.max(1, Math.floor(startHole)), totalHoles)
  const end = Math.min(Math.max(1, Math.floor(endHole)), totalHoles)

  if (start <= end) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }

  return [
    ...Array.from({ length: totalHoles - start + 1 }, (_, index) => start + index),
    ...Array.from({ length: end }, (_, index) => index + 1),
  ]
}

function getVisibleHolesByRound(
  round: RoundLike,
  holes: HoleLike[],
  startHole: number,
  endHole: number
) {
  const expectedCount = round.holes_mode === 9 ? 9 : 18
  const holeOrder = buildHoleOrder(startHole, endHole, holes.length).slice(0, expectedCount)
  const holeByNumber = new Map(holes.map((hole) => [hole.hole_number, hole] as const))
  return holeOrder.map((holeNumber) => holeByNumber.get(holeNumber)).filter(Boolean) as HoleLike[]
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

function formatToPar(value?: number) {
  if (value == null) return 'E'
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function getMedal(position: number) {
  if (position === 1) return '🥇'
  if (position === 2) return '🥈'
  if (position === 3) return '🥉'
  return `#${position}`
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
  const visibleHoleNumbers = new Set(visibleHoles.map((hole) => hole.hole_number))

  const playerById = new Map(players.map((player) => [String(player.id), player]))

  const leaderboardBase = players.map((player) => {
    const rows = scoreRows.filter(
      (row) =>
        row.round_player_id === player.id &&
        visibleHoleNumbers.has(row.hole_number)
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

function PremiumLeaderboard({
  leaderboard,
  roundId,
  currentHoleNumber,
}: {
  leaderboard: LeaderboardEntry[]
  roundId: string
  currentHoleNumber: number
}) {
  const leader = leaderboard[0]
  const podium = leaderboard.slice(0, 5)

  return (
    <section
      aria-label="Leaderboard"
      style={{
        background: 'linear-gradient(135deg, #12231d 0%, #1f7a3a 100%)',
        color: '#fff',
        borderRadius: 24,
        padding: 16,
        boxShadow: '0 18px 45px rgba(21, 90, 45, 0.22)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 34%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', display: 'grid', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
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
                fontWeight: 800,
                letterSpacing: 0.3,
                textTransform: 'uppercase',
              }}
            >
              <span>🔴</span>
              <span>Live leaderboard</span>
            </div>

            <h2
              style={{
                margin: '10px 0 2px',
                fontSize: 25,
                lineHeight: 1,
                fontWeight: 950,
                color: '#f7fff9',
                textShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            >
              {leader?.playerName ?? 'Leaderboard'}
            </h2>

            <p style={{ margin: 0, color: 'rgba(255,255,255,0.76)', fontSize: 13 }}>
              {leader
                ? `Leder just nu på ${leader.scoreText ?? '0'}`
                : 'Ställningen visas här så fort spelare finns.'}
            </p>
          </div>

<a
  href={`/rounds/${roundId}/summary?hole=${currentHoleNumber}`}
  style={{
    color: '#fff',
    textDecoration: 'none',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: 999,
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  }}
>
  Visa allt
</a>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 3,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {podium.map((entry) => (
            <div
              key={entry.playerId}
              style={{
                minWidth: 122,
                borderRadius: 18,
                padding: 12,
                background: entry.isLeader
                  ? 'rgba(255,255,255,0.22)'
                  : 'rgba(255,255,255,0.11)',
                border: entry.isLeader
                  ? '1px solid rgba(255,255,255,0.38)'
                  : '1px solid rgba(255,255,255,0.18)',
                boxShadow: entry.isLeader
                  ? 'inset 0 1px 0 rgba(255,255,255,0.2)'
                  : undefined,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>{getMedal(entry.position)}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  {formatToPar(entry.totalToPar)}
                </span>
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 950,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.playerName}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 20,
                  fontWeight: 950,
                  letterSpacing: -0.4,
                }}
              >
                {entry.scoreText}
              </div>

              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                {entry.totalStrokes ?? 0} slag totalt
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RoundHero({
  roundTitle,
  courseName,
  currentHoleNumber,
  totalHoles,
  startHole,
  modeLabel,
  par,
  hcpIndex,
  roundId,
  leaderboard,
}: {
  roundTitle: string
  courseName: string
  currentHoleNumber: number
  totalHoles: number
  startHole: number
  modeLabel: string
  par: number
  hcpIndex: number
  roundId: string
  leaderboard: LeaderboardEntry[]
}) {
  const holeIndexInSegment = Math.max(1, currentHoleNumber - startHole + 1)

  return (
    <div
      style={{
        display: 'grid',
        gap: 14,
      }}
    >
      <div
        className="card round-hero"
        style={{
          padding: 18,
          borderRadius: 26,
          background:
            'linear-gradient(145deg, rgba(244,252,246,0.98), rgba(255,255,255,0.96))',
          boxShadow: '0 16px 42px rgba(20, 77, 43, 0.10)',
          border: '1px solid rgba(36, 122, 67, 0.12)',
        }}
      >
        <div style={{ display: 'grid', gap: 15 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'grid', gap: 9 }}>
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
                <span className="badge">Hål {holeIndexInSegment}/{totalHoles}</span>
              </div>

              <div style={{ display: 'grid', gap: 4 }}>
                <h1
                  className="title"
                  style={{
                    margin: 0,
                    fontSize: 'clamp(26px, 8vw, 38px)',
                    lineHeight: 0.98,
                    letterSpacing: -1.2,
                  }}
                >
                  {roundTitle}
                </h1>

                <p className="muted meta" style={{ margin: 0 }}>
                  {courseName}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Link
                  className="button secondary"
                  href="/dashboard"
                  style={{
                    borderRadius: 999,
                    minHeight: 38,
                    paddingInline: 14,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span aria-hidden="true">🏠</span>
                  Till startsidan
                </Link>
                <Link
                  className="button secondary"
                  href={`/rounds/${roundId}/players`}
                  style={{
                    borderRadius: 999,
                    minHeight: 38,
                    paddingInline: 14,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span aria-hidden="true">👥</span>
                  Hantera spelare
                </Link>
              </div>

              <FinishRoundQuickAction
                roundId={roundId}
                currentHole={currentHoleNumber}
                totalHoles={totalHoles}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 9,
            }}
          >
            <div
              style={{
                padding: '11px 12px',
                borderRadius: 18,
                background: '#fff',
                border: '1px solid rgba(20, 77, 43, 0.10)',
                boxShadow: '0 8px 20px rgba(20, 77, 43, 0.06)',
              }}
            >
              <div className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                Aktuellt hål
              </div>
              <div style={{ fontSize: 22, fontWeight: 950 }}>Hål {holeIndexInSegment}</div>
            </div>

            <div
              style={{
                padding: '11px 12px',
                borderRadius: 18,
                background: '#fff',
                border: '1px solid rgba(20, 77, 43, 0.10)',
                boxShadow: '0 8px 20px rgba(20, 77, 43, 0.06)',
              }}
            >
              <div className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                Par
              </div>
              <div style={{ fontSize: 22, fontWeight: 950 }}>{par}</div>
            </div>

            <div
              style={{
                padding: '11px 12px',
                borderRadius: 18,
                background: '#fff',
                border: '1px solid rgba(20, 77, 43, 0.10)',
                boxShadow: '0 8px 20px rgba(20, 77, 43, 0.06)',
              }}
            >
              <div className="muted" style={{ fontSize: 11, fontWeight: 800 }}>
                Index
              </div>
              <div style={{ fontSize: 22, fontWeight: 950 }}>{hcpIndex}</div>
            </div>
          </div>
        </div>
      </div>

      <PremiumLeaderboard
        leaderboard={leaderboard}
        roundId={roundId}
        currentHoleNumber={currentHoleNumber}
      />
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
      .select(
        'id, display_name, exact_handicap, playing_handicap, tee_key, active_from_hole, active_to_hole'
      )
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

  const players = (playersData ?? []).map((player) => ({
  ...player,
  display_name: player.display_name ?? undefined,
  tee_key: player.tee_key ?? undefined,
})) as RoundPlayer[]
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

  const visibleHoles = getVisibleHolesByRound(round, holes, startHole, endHole)

  if (!visibleHoles.length) {
    notFound()
  }

  const selectedHoleIndexes = visibleHoles.map((item) => item.hcp_index)

  const currentHole =
    visibleHoles.find((item) => item.hole_number === requestedHoleNumber) ?? null

  if (!currentHole) {
    redirect(`/rounds/${id}?hole=${round.current_hole ?? startHole}`)
  }

  const activePlayersForHole = players.filter((player) =>
    isPlayerActiveOnHole(player, currentHole.hole_number, startHole, endHole)
  )
  const playersForHole = activePlayersForHole.length > 0 ? activePlayersForHole : players
  const activePlayerIds = new Set(playersForHole.map((player) => player.id))

  const currentHoleScores = scoreRows.filter(
    (row) =>
      row.hole_number === currentHole.hole_number &&
      activePlayerIds.has(row.round_player_id)
  )

  const leaderboard = buildLeaderboard({
    players: playersForHole,
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
      <div
        className="container"
        style={{
          display: 'grid',
          gap: 16,
          paddingTop: 'max(18px, calc(env(safe-area-inset-top) + 10px))',
        }}
      >
        <RoundHero
          roundTitle={round.title}
          courseName={course.name}
          currentHoleNumber={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          startHole={startHole}
          modeLabel={modeLabel}
          par={currentHole.par}
          hcpIndex={currentHole.hcp_index}
          roundId={id}
          leaderboard={leaderboard}
        />

        <HolePlay
          roundId={id}
          currentHole={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          startHole={startHole}
          endHole={endHole}
          hole={currentHole}
          players={playersForHole}
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
