import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type ScoreUpdate = {
  roundPlayerId: string
  strokes: number | null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const body = await request.json()
  const holeNumber = Number(body.holeNumber)
  const scoreUpdates: ScoreUpdate[] = Array.isArray(body.scores) ? body.scores : []

  if (!Number.isInteger(holeNumber) || holeNumber < 1) {
    return NextResponse.json({ error: 'Ogiltigt hålnummer.' }, { status: 400 })
  }

  if (scoreUpdates.length === 0) {
    return NextResponse.json({ error: 'Inga scorer att spara.' }, { status: 400 })
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, owner_id, start_hole, end_hole, current_hole, status')
    .eq('id', id)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Rundan hittades inte.' }, { status: 404 })
  }

  // Om du vill låsa till endast ägaren:
  if (round.owner_id !== user.id) {
    return NextResponse.json(
      { error: 'Du har inte behörighet att spara score i denna runda.' },
      { status: 403 }
    )
  }

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? 18

  if (holeNumber < startHole || holeNumber > endHole) {
    return NextResponse.json(
      { error: 'Hålet ligger utanför rundans intervall.' },
      { status: 400 }
    )
  }

  // Validera först allt innan vi skriver något
  for (const score of scoreUpdates) {
    const roundPlayerId = String(score.roundPlayerId || '')
    const strokes = score.strokes == null ? null : Number(score.strokes)

    if (!roundPlayerId) {
      return NextResponse.json({ error: 'Saknar roundPlayerId.' }, { status: 400 })
    }

    if (strokes != null && (!Number.isFinite(strokes) || strokes < 1)) {
      return NextResponse.json({ error: 'Ogiltig score.' }, { status: 400 })
    }
  }

  // Spara scorer
  for (const score of scoreUpdates) {
    const roundPlayerId = String(score.roundPlayerId || '')
    const strokes = score.strokes == null ? null : Number(score.strokes)

    const { error } = await supabase
      .from('hole_scores')
      .update({ strokes })
      .eq('round_id', id)
      .eq('round_player_id', roundPlayerId)
      .eq('hole_number', holeNumber)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  const requestedNextHole = holeNumber < endHole ? holeNumber + 1 : endHole
  const requestedStatus = holeNumber >= endHole ? 'completed' : 'active'

  // Viktigt:
  // Uppdatera ALDRIG current_hole bakåt om en gammal request kommer sent.
  const currentRoundHole =
    typeof round.current_hole === 'number' && Number.isFinite(round.current_hole)
      ? round.current_hole
      : startHole

  const safeNextHole = Math.max(currentRoundHole, requestedNextHole)

  const nextStatus =
    round.status === 'completed'
      ? 'completed'
      : requestedStatus

  const { error: updateRoundError } = await supabase
    .from('rounds')
    .update({
      current_hole: safeNextHole,
      status: nextStatus,
    })
    .eq('id', id)

  if (updateRoundError) {
    return NextResponse.json({ error: updateRoundError.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    currentHole: safeNextHole,
    status: nextStatus,
  })
}