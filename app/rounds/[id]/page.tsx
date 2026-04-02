import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { HolePlay } from '@/components/hole-play'

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
  const holeNumber = Number(resolvedSearchParams.hole || '1')

  const { data: round } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', id)
    .single()

  if (!round) {
    notFound()
  }

  const [{ data: players }, { data: course }, { data: holes }, { data: currentHoleScores }] =
    await Promise.all([
      supabase.from('round_players').select('*').eq('round_id', id).order('sort_order'),
      supabase.from('courses').select('*').eq('id', round.course_id).single(),
      supabase.from('course_holes').select('*').eq('course_id', round.course_id).order('hole_number'),
      supabase
        .from('hole_scores')
        .select('*')
        .eq('round_id', id)
        .eq('hole_number', holeNumber),
    ])

  if (!course || !holes || !players) {
    notFound()
  }

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length

  const visibleHoles = holes.filter(
    (item) => item.hole_number >= startHole && item.hole_number <= endHole
  )

  const currentHole =
    visibleHoles.find((item) => item.hole_number === holeNumber) ?? visibleHoles[0]

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
          key={`${id}-${currentHole.hole_number}`}
          roundId={id}
          currentHole={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          startHole={startHole}
          endHole={endHole}
          hole={currentHole}
          players={players}
          scores={currentHoleScores ?? []}
        />
      </div>
    </main>
  )
}