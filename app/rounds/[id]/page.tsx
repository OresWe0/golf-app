import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HolePlay } from '@/components/hole-play'
import { receivedStrokesOnHole, stablefordPoints } from '@/lib/scoring'

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

  if (!user) redirect('/login')

  const { id } = await params
  const { hole } = await searchParams
  const holeNumber = Number(hole || '1')

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', id)
    .single()

  if (!round) notFound()

  const [{ data: players }, { data: course }, { data: holes }, { data: scoreRows }] =
    await Promise.all([
      supabase.from('round_players').select('*').eq('round_id', id).order('sort_order'),
      supabase.from('courses').select('*').eq('id', round.course_id).single(),
      supabase.from('course_holes').select('*').eq('course_id', round.course_id).order('hole_number'),
      supabase.from('hole_scores').select('*').eq('round_id', id).order('hole_number'),
    ])

  if (!course || !holes || !players || !scoreRows) notFound()

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length

  const visibleHoles = holes.filter(
    (item) => item.hole_number >= startHole && item.hole_number <= endHole
  )

  const currentHole =
    visibleHoles.find((item) => item.hole_number === holeNumber) ?? visibleHoles[0]

  const currentScores = scoreRows.filter(
    (item) => item.hole_number === currentHole.hole_number
  )

  const runningTotals = Object.fromEntries(
    players.map((player) => [
      player.id,
      { strokes: 0, points: 0, vsPar: 0 },
    ])
  )

  for (const scoreRow of scoreRows) {
    const holeDef = holes.find((item) => item.hole_number === scoreRow.hole_number)
    const player = players.find((item) => item.id === scoreRow.round_player_id)

    if (
      !holeDef ||
      !player ||
      scoreRow.hole_number < startHole ||
      scoreRow.hole_number > endHole ||
      scoreRow.hole_number > currentHole.hole_number
    ) {
      continue
    }

    const strokes = scoreRow.strokes ?? 0
    const received = receivedStrokesOnHole(
      player.playing_handicap,
      holeDef.hcp_index,
      visibleHoles.length
    )

    runningTotals[player.id].strokes += strokes
    runningTotals[player.id].points += stablefordPoints(
      scoreRow.strokes,
      holeDef.par,
      received
    )
    runningTotals[player.id].vsPar += strokes - holeDef.par
  }

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

          <Link className="button secondary" href={`/rounds/${id}/summary`}>
            Öppna summary
          </Link>
        </div>

        <HolePlay
          roundId={id}
          currentHole={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          startHole={startHole}
          endHole={endHole}
          scoringMode={round.scoring_mode}
          hole={currentHole}
          players={players}
          scores={currentScores}
          runningTotals={runningTotals}
        />
      </div>
    </main>
  )
}