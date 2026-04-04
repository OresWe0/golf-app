import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePlayingHandicap } from '@/lib/scoring'

type InputPlayer = {
  name: string
  email?: string
  handicapIndex: number | null
  teeKey?: 'yellow' | 'red'
  sortOrder?: number
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('AUTH USER:', user)
  console.log('AUTH USER ID:', user?.id)

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const body = await request.json()
  const players = Array.isArray(body.players) ? (body.players as InputPlayer[]) : []

  const holesMode = body.holesMode === 9 ? 9 : 18
  const nineHoleSide = body.nineHoleSide === 'back' ? 'back' : 'front'

  const startHole = holesMode === 18 ? 1 : nineHoleSide === 'front' ? 1 : 10
  const endHole = holesMode === 18 ? 18 : nineHoleSide === 'front' ? 9 : 18

  if (!body.title || !body.courseId || players.length === 0) {
    return NextResponse.json(
      { error: 'Titel, bana och minst en spelare krävs.' },
      { status: 400 }
    )
  }

  const registeredEmails = [
    ...new Set(
      players
        .map((player) => String(player.email || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ]

  const [{ data: course, error: courseError }, { data: tees, error: teesError }] =
    await Promise.all([
      supabase
        .from('courses')
        .select('id, holes_count, total_par')
        .eq('id', body.courseId)
        .single(),
      supabase.from('course_tees').select('*').eq('course_id', body.courseId),
    ])

  if (courseError || !course) {
    return NextResponse.json({ error: 'Banan kunde inte hittas.' }, { status: 400 })
  }

  if (teesError || !tees || tees.length === 0) {
    return NextResponse.json(
      { error: 'Ingen tee-data hittades för banan.' },
      { status: 400 }
    )
  }

  const teeByKey = new Map(tees.map((tee) => [tee.tee_key, tee]))

  const registeredProfiles =
    registeredEmails.length > 0
      ? await supabase
          .from('profiles')
          .select('id, email, display_name, handicap_index, default_tee')
          .in('email', registeredEmails)
      : { data: [], error: null as { message?: string } | null }

  if (registeredProfiles.error) {
    return NextResponse.json(
      { error: registeredProfiles.error.message || 'Kunde inte läsa användare.' },
      { status: 400 }
    )
  }

  const profileByEmail = new Map(
    (registeredProfiles.data ?? []).map((profile) => [
      String(profile.email).toLowerCase(),
      profile,
    ])
  )

  const ownerEmail = String(user.email || '').toLowerCase()

  if (ownerEmail && !profileByEmail.has(ownerEmail)) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id, email, display_name, handicap_index, default_tee')
      .eq('id', user.id)
      .single()

    if (ownerProfile?.email) {
      profileByEmail.set(String(ownerProfile.email).toLowerCase(), ownerProfile)
    }
  }

  for (const player of players) {
    const email = String(player.email || '').trim().toLowerCase()

    if (email && !profileByEmail.has(email)) {
      return NextResponse.json(
        {
          error: `Ingen registrerad användare hittades för ${email}. Be vännen skapa konto först eller lägg till som gäst.`,
        },
        { status: 400 }
      )
    }
  }

  const roundInsertPayload = {
    owner_id: user.id,
    course_id: body.courseId,
    title: body.title,
    scoring_mode: body.scoringMode === 'strokeplay' ? 'strokeplay' : 'stableford',
    status: 'active',
    holes_mode: holesMode,
    start_hole: startHole,
    end_hole: endHole,
    current_hole: startHole,
  }

  console.log('ROUND INSERT PAYLOAD:', roundInsertPayload)

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert(roundInsertPayload)
    .select('id')
    .single()

  if (roundError || !round) {
    console.log('ROUND INSERT ERROR:', roundError)
    return NextResponse.json(
      { error: roundError?.message || 'Kunde inte skapa rundan.' },
      { status: 400 }
    )
  }

  const memberMap = new Map<string, 'owner' | 'player'>([[user.id, 'owner']])

  const playerRows = players.map((player, index) => {
    const email = String(player.email || '').trim().toLowerCase()
    const profile = email ? profileByEmail.get(email) : null
    const userId = profile?.id ?? null

    if (userId && !memberMap.has(userId)) {
      memberMap.set(userId, userId === user.id ? 'owner' : 'player')
    }

    const exactHandicap = player.handicapIndex ?? profile?.handicap_index ?? null
    const teeKey = (player.teeKey || profile?.default_tee || 'yellow') as 'yellow' | 'red'
    const tee = teeByKey.get(teeKey)

const fullPlayingHandicap = calculatePlayingHandicap({
  handicapIndex: exactHandicap,
  slopeRating: tee?.slope_rating ?? null,
  courseRating: tee?.course_rating ?? null,
  par: tee?.tee_par ?? course.total_par,
})

const holesPlayed = endHole - startHole + 1

const playingHandicap =
  holesPlayed < 18
    ? Math.round((fullPlayingHandicap * holesPlayed) / 18)
    : fullPlayingHandicap

    return {
      round_id: round.id,
      user_id: userId,
      invited_email: email || null,
      display_name: player.name,
      handicap_index: exactHandicap,
      exact_handicap: exactHandicap,
      tee_key: teeKey,
      playing_handicap: playingHandicap,
      sort_order: player.sortOrder ?? index + 1,
    }
  })

  const { error: membersError } = await supabase
    .from('round_members')
    .insert(
      [...memberMap.entries()].map(([userId, role]) => ({
        round_id: round.id,
        user_id: userId,
        role,
      }))
    )

  if (membersError) {
    console.log('ROUND MEMBERS ERROR:', membersError)
    return NextResponse.json({ error: membersError.message }, { status: 400 })
  }

  const { data: roundPlayers, error: playersError } = await supabase
    .from('round_players')
    .insert(playerRows)
    .select('id')

  if (playersError || !roundPlayers) {
    console.log('ROUND PLAYERS ERROR:', playersError)
    return NextResponse.json(
      { error: playersError?.message || 'Kunde inte spara spelare.' },
      { status: 400 }
    )
  }

  const scoreRows = []
  for (const roundPlayer of roundPlayers) {
    for (let holeNumber = startHole; holeNumber <= endHole; holeNumber += 1) {
      scoreRows.push({
        round_id: round.id,
        round_player_id: roundPlayer.id,
        hole_number: holeNumber,
        strokes: null,
      })
    }
  }

  const { error: scoreError } = await supabase.from('hole_scores').insert(scoreRows)

  if (scoreError) {
    console.log('HOLE SCORES ERROR:', scoreError)
    return NextResponse.json({ error: scoreError.message }, { status: 400 })
  }

  return NextResponse.json({
    roundId: round.id,
    startHole,
    endHole,
  })
}