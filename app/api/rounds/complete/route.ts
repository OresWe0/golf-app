import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type CompleteRoundBody = {
  finishHoleNumber?: number
  isEarlyFinish?: boolean
}

function parseFinishHoleNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.floor(parsed)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  let body: CompleteRoundBody = {}
  try {
    body = (await request.json()) as CompleteRoundBody
  } catch {
    body = {}
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, owner_id, start_hole, end_hole, holes_mode, current_hole')
    .eq('id', id)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Round not found' }, { status: 404 })
  }

  if (round.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('round_members')
      .select('id')
      .eq('round_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const startHole = Number(round.start_hole ?? 1)
  const selectedEndHole = Number(round.end_hole ?? (round.holes_mode === 18 ? 18 : 9))
  const requestedFinishHole = parseFinishHoleNumber(body.finishHoleNumber)
  const finishHoleNumber = Math.min(
    Math.max(requestedFinishHole ?? selectedEndHole, startHole),
    selectedEndHole
  )

  const isEarlyFinish = Boolean(body.isEarlyFinish) && finishHoleNumber < selectedEndHole

  const updatePayload: Record<string, unknown> = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    current_hole: finishHoleNumber,
  }

  // If they selected 18 but stop after 9, make the played range the source of truth.
  // holes_mode remains 18, so the summary can show e.g. 9/18 holes.
  if (isEarlyFinish) {
    updatePayload.end_hole = finishHoleNumber
  }

  const { error: updateError } = await supabase
    .from('rounds')
    .update(updatePayload)
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    finishHoleNumber,
    isEarlyFinish,
  })
}
