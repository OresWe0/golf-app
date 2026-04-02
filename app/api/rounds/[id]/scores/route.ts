import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const body = await request.json()
  const holeNumber = Number(body.holeNumber)
  const scoreUpdates = Array.isArray(body.scores) ? body.scores : []

  for (const score of scoreUpdates) {
    const { error } = await supabase
      .from('hole_scores')
      .update({ strokes: score.strokes })
      .eq('round_id', id)
      .eq('round_player_id', score.roundPlayerId)
      .eq('hole_number', holeNumber)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  const { data: round } = await supabase.from('rounds').select('course_id').eq('id', id).single()
  if (!round) {
    return NextResponse.json({ error: 'Rundan hittades inte.' }, { status: 404 })
  }

  const { data: course } = await supabase.from('courses').select('holes_count').eq('id', round.course_id).single()
  const nextHole = Math.min((course?.holes_count ?? holeNumber), holeNumber + 1)
  const status = holeNumber >= (course?.holes_count ?? holeNumber) ? 'completed' : 'active'

  await supabase.from('rounds').update({ current_hole: nextHole, status }).eq('id', id)

  return NextResponse.json({ ok: true })
}
