import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type RoundPlayerRow = {
  id: string
  round_id: string
}

type RoundRow = {
  id: string
  title: string
  course_id: string
  created_at: string
  holes_mode: number | null
  status: string | null
}

type HoleScoreRow = {
  round_player_id: string
  hole_number: number | null
  strokes: number | null
}

type CourseRow = {
  id: string
  name: string
}

type CourseHoleRow = {
  course_id: string
  hole_number: number
  par: number
}

function normalizeText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatSigned(value: number) {
  const rounded = Number(value.toFixed(2))
  if (rounded > 0) return `+${rounded.toFixed(2)}`
  if (rounded < 0) return rounded.toFixed(2)
  return '0.00'
}

export default async function StatistikPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: playerRowsData, error: playerRowsError } = await supabase
    .from('round_players')
    .select('id, round_id')
    .eq('user_id', user.id)

  if (playerRowsError) {
    console.error('Failed to load round players for statistik:', playerRowsError)
  }

  const playerRows = (playerRowsData as RoundPlayerRow[] | null) ?? []
  const roundIds = Array.from(new Set(playerRows.map((row) => row.round_id)))

  let rounds: RoundRow[] = []
  let courses: CourseRow[] = []
  let holeScores: HoleScoreRow[] = []
  let courseHoles: CourseHoleRow[] = []

  if (roundIds.length > 0) {
    const [
      { data: roundsData, error: roundsError },
      { data: coursesData, error: coursesError },
      { data: holeScoresData, error: holeScoresError },
    ] = await Promise.all([
      supabase
        .from('rounds')
        .select('id, title, course_id, created_at, holes_mode, status')
        .in('id', roundIds)
        .in('status', ['completed', 'finished'])
        .order('created_at', { ascending: false }),
      supabase.from('courses').select('id, name'),
      supabase
        .from('hole_scores')
        .select('round_player_id, hole_number, strokes')
        .in(
          'round_player_id',
          playerRows.map((row) => row.id)
        ),
    ])

    if (roundsError) console.error('Failed to load rounds for statistik:', roundsError)
    if (coursesError) console.error('Failed to load courses for statistik:', coursesError)
    if (holeScoresError) {
      console.error('Failed to load hole scores for statistik:', holeScoresError)
    }

    rounds = (roundsData as RoundRow[] | null) ?? []
    courses = (coursesData as CourseRow[] | null) ?? []
    holeScores = (holeScoresData as HoleScoreRow[] | null) ?? []

    const courseIds = Array.from(new Set(rounds.map((round) => round.course_id)))

    if (courseIds.length > 0) {
      const { data: courseHolesData, error: courseHolesError } = await supabase
        .from('course_holes')
        .select('course_id, hole_number, par')
        .in('course_id', courseIds)

      if (courseHolesError) {
        console.error('Failed to load course holes for statistik:', courseHolesError)
      }

      courseHoles = (courseHolesData as CourseHoleRow[] | null) ?? []
    }
  }

  const playerRoundById = new Map(playerRows.map((row) => [row.id, row.round_id] as const))
  const roundById = new Map(rounds.map((round) => [round.id, round] as const))
  const courseById = new Map(courses.map((course) => [course.id, course] as const))

  const roundTotals = new Map<string, { strokes: number; holes: number }>()

  for (const score of holeScores) {
    if (typeof score.strokes !== 'number') continue

    const roundId = playerRoundById.get(score.round_player_id)
    if (!roundId || !roundById.has(roundId)) continue

    const current = roundTotals.get(roundId) ?? { strokes: 0, holes: 0 }
    current.strokes += score.strokes
    current.holes += 1
    roundTotals.set(roundId, current)
  }

  const completedSummaries = rounds
    .map((round) => {
      const total = roundTotals.get(round.id)
      if (!total || total.holes === 0) return null

      return {
        round,
        totalStrokes: total.strokes,
        holes: total.holes,
        avgPerHole: total.strokes / total.holes,
      }
    })
    .filter(
      (
        item
      ): item is {
        round: RoundRow
        totalStrokes: number
        holes: number
        avgPerHole: number
      } => item !== null
    )

  const karstaCourse = courses.find((course) =>
    normalizeText(course.name).includes('karsta')
  )

  const karstaRoundSummaries = karstaCourse
    ? completedSummaries.filter((item) => item.round.course_id === karstaCourse.id)
    : []

  const overallAveragePerHole =
    completedSummaries.length > 0
      ? completedSummaries.reduce((sum, item) => sum + item.avgPerHole, 0) /
        completedSummaries.length
      : null

  const karstaAveragePerHole =
    karstaRoundSummaries.length > 0
      ? karstaRoundSummaries.reduce((sum, item) => sum + item.avgPerHole, 0) /
        karstaRoundSummaries.length
      : null

  const parByHole = new Map<number, number>()

  if (karstaCourse) {
    for (const hole of courseHoles) {
      if (hole.course_id !== karstaCourse.id) continue
      parByHole.set(hole.hole_number, hole.par)
    }
  }

  const karstaRoundIds = new Set(karstaRoundSummaries.map((item) => item.round.id))
  const holeAgg = new Map<number, { strokes: number; count: number }>()

  for (const score of holeScores) {
    if (typeof score.strokes !== 'number') continue
    if (typeof score.hole_number !== 'number') continue

    const roundId = playerRoundById.get(score.round_player_id)
    if (!roundId || !karstaRoundIds.has(roundId)) continue

    const current = holeAgg.get(score.hole_number) ?? { strokes: 0, count: 0 }
    current.strokes += score.strokes
    current.count += 1
    holeAgg.set(score.hole_number, current)
  }

  const hardestKarstaHoles = Array.from(holeAgg.entries())
    .map(([holeNumber, aggregate]) => {
      const avg = aggregate.strokes / aggregate.count
      const par = parByHole.get(holeNumber)
      const avgToPar = par != null ? avg - par : null

      return {
        holeNumber,
        avg,
        par: par ?? null,
        avgToPar,
        count: aggregate.count,
      }
    })
    .sort((a, b) => {
      const aScore = a.avgToPar ?? a.avg
      const bScore = b.avgToPar ?? b.avg
      if (bScore !== aScore) return bScore - aScore
      return b.count - a.count
    })
    .slice(0, 5)

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ borderRadius: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h1 className="title" style={{ margin: 0 }}>
                Statistik
              </h1>
              <p className="meta" style={{ marginTop: 8 }}>
                Din personliga speldata med fokus pa Kårsta.
              </p>
            </div>

            <Link href="/dashboard" className="button secondary">
              Till dashboard
            </Link>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <div className="card" style={{ borderRadius: 18 }}>
            <div className="muted">Avslutade rundor</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>
              {completedSummaries.length}
            </div>
          </div>

          <div className="card" style={{ borderRadius: 18 }}>
            <div className="muted">Snitt per hål (alla banor)</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>
              {overallAveragePerHole == null ? '-' : overallAveragePerHole.toFixed(2)}
            </div>
          </div>

          <div className="card" style={{ borderRadius: 18 }}>
            <div className="muted">Snitt per hål (Kårsta)</div>
            <div style={{ fontSize: 36, fontWeight: 900, marginTop: 8 }}>
              {karstaAveragePerHole == null ? '-' : karstaAveragePerHole.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="card" style={{ borderRadius: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Svaste hal pa Kårsta</h2>
          <p className="meta" style={{ marginTop: 8 }}>
            Baserat pa dina sparade scorer.
          </p>

          {hardestKarstaHoles.length === 0 ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Ingen Kårsta-data an. Spela en avslutad runda pa Kårsta sa fylls den har.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {hardestKarstaHoles.map((hole) => (
                <div
                  key={`hard-hole-${hole.holeNumber}`}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Hal {hole.holeNumber}</div>
                  <div className="muted">
                    Snitt {hole.avg.toFixed(2)} slag
                    {hole.avgToPar == null ? '' : ` (${formatSigned(hole.avgToPar)} mot par)`}
                    {' · '}
                    {hole.count} varv
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ borderRadius: 24 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Senaste rundor</h2>

          {completedSummaries.length === 0 ? (
            <div className="notice" style={{ marginTop: 12 }}>
              Inga avslutade rundor med score hittades.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {completedSummaries.slice(0, 12).map((item) => (
                <div
                  key={item.round.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 14,
                    padding: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 900 }}>
                      {courseById.get(item.round.course_id)?.name ?? 'Okand bana'}
                    </div>
                    <div className="muted" style={{ fontSize: 14 }}>
                      {new Date(item.round.created_at).toLocaleDateString('sv-SE')} · {item.round.holes_mode ?? item.holes} hål
                    </div>
                  </div>

                  <div style={{ fontWeight: 900 }}>
                    {item.totalStrokes} slag ({item.avgPerHole.toFixed(2)} / hål)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
