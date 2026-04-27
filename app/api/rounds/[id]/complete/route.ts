import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function toIntOrNull(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.floor(parsed)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, owner_id, start_hole, end_hole, current_hole, status')
    .eq('id', id)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Rundan hittades inte.' }, { status: 404 })
  }

  if (round.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('round_members')
      .select('id')
      .eq('round_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { error: 'Du har inte behörighet att avsluta rundan.' },
        { status: 403 }
      )
    }
  }

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? 18

  const body = await request.json().catch(() => ({}))
  const requestedCompletedThroughHole = toIntOrNull(body?.completedThroughHole)
  const fallbackHole = toIntOrNull(round.current_hole) ?? endHole
  const completedThroughHole = clamp(
    requestedCompletedThroughHole ?? fallbackHole,
    startHole,
    endHole
  )

  const { error: updateError } = await supabase
    .from('rounds')
    .update({
      status: 'completed',
      current_hole: completedThroughHole,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message || 'Kunde inte avsluta rundan.' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    status: 'completed',
    currentHole: completedThroughHole,
  })
}
