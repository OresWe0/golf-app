import { NextResponse } from 'next/server'
import { sendPushNotification } from '@/lib/send-push'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  calculatePlayingHandicap,
  getPlayingHandicapForSelectedHoles,
  normalizeTeeKey,
} from '@/lib/scoring'

type InputPlayer = {
  name: string
  email?: string
  handicapIndex: number | null
  teeKey?: 'yellow' | 'red'
  sortOrder?: number
}

type CourseHole = {
  hole_number: number
  hcp_index: number
  par: number
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

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const body = await request.json()
  const players = Array.isArray(body.players) ? (body.players as InputPlayer[]) : []

  const holesMode = Number(body.holesMode) === 9 ? 9 : 18
  const roundStartSide = body.nineHoleSide === 'back' ? 'back' : 'front'

  const startHole =
    holesMode === 18
      ? roundStartSide === 'back'
        ? 10
        : 1
      : roundStartSide === 'front'
        ? 1
        : 10
  const endHole =
    holesMode === 18
      ? roundStartSide === 'back'
        ? 9
        : 18
      : roundStartSide === 'front'
        ? 9
        : 18

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

  const [
    { data: course, error: courseError },
    { data: tees, error: teesError },
    { data: holes, error: holesError },
  ] = await Promise.all([
    supabase
      .from('courses')
      .select('id, holes_count, total_par')
      .eq('id', body.courseId)
      .single(),
    supabase.from('course_tees').select('*').eq('course_id', body.courseId),
    supabase
      .from('course_holes')
      .select('hole_number, hcp_index, par')
      .eq('course_id', body.courseId)
      .order('hole_number'),
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

  if (holesError || !holes || holes.length === 0) {
    return NextResponse.json(
      { error: 'Ingen håldata hittades för banan.' },
      { status: 400 }
    )
  }

  const courseHoles = holes as CourseHole[]
  const expectedHoleNumbers = buildHoleOrder(startHole, endHole, courseHoles.length)
  const expectedHoleSet = new Set(expectedHoleNumbers)
  const visibleHoles = courseHoles.filter((hole) => expectedHoleSet.has(hole.hole_number))

  if (visibleHoles.length !== expectedHoleNumbers.length) {
    return NextResponse.json(
      { error: 'Ofullständig håldata för vald slinga.' },
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

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert(roundInsertPayload)
    .select('id')
    .single()

  if (roundError || !round) {
    return NextResponse.json(
      { error: roundError?.message || 'Kunde inte skapa rundan.' },
      { status: 400 }
    )
  }

  const memberMap = new Map<string, 'owner' | 'player'>([[user.id, 'owner']])
  let playerRows: Array<Record<string, unknown>> = []

  try {
    playerRows = players.map((player, index) => {
      const email = String(player.email || '').trim().toLowerCase()
      const profile = email ? profileByEmail.get(email) : null
      const userId = profile?.id ?? null

      if (userId && !memberMap.has(userId)) {
        memberMap.set(userId, userId === user.id ? 'owner' : 'player')
      }

      const exactHandicap = player.handicapIndex ?? profile?.handicap_index ?? null
      const teeKey = normalizeTeeKey(player.teeKey ?? profile?.default_tee ?? 'yellow')
      const tee = teeByKey.get(teeKey)

      if (!tee) {
        throw new Error(`Ogiltig tee: ${teeKey}`)
      }

      const courseHandicap = calculatePlayingHandicap({
        handicapIndex: exactHandicap,
        slopeRating: tee.slope_rating ?? null,
        courseRating: tee.course_rating ?? null,
        par: tee.tee_par ?? course.total_par,
      })

      const playingHandicap = getPlayingHandicapForSelectedHoles(
        courseHandicap,
        visibleHoles.map((hole) => hole.hcp_index)
      )

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
        active_from_hole: holesMode === 18 ? 1 : startHole,
        active_to_hole: holesMode === 18 ? courseHoles.length : endHole,
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ogiltig spelardata.' },
      { status: 400 }
    )
  }

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
    return NextResponse.json({ error: membersError.message }, { status: 400 })
  }

  const { data: roundPlayers, error: playersError } = await supabase
    .from('round_players')
    .insert(playerRows)
    .select('id')

  if (playersError || !roundPlayers) {
    return NextResponse.json(
      { error: playersError?.message || 'Kunde inte spara spelare.' },
      { status: 400 }
    )
  }

  const scoreRows = []
  for (const roundPlayer of roundPlayers) {
    for (const holeNumber of expectedHoleNumbers) {
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
    return NextResponse.json({ error: scoreError.message }, { status: 400 })
  }
// 🔥 Skicka push: vän är ute på banan nu
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  return NextResponse.json(
    { error: 'Serverkonfiguration saknas fÃ¶r push.' },
    { status: 500 }
  )
}

const supabaseAdmin = createAdminClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

const { data: actorProfile } = await supabaseAdmin
  .from('profiles')
  .select('display_name, email')
  .eq('id', user.id)
  .maybeSingle()

const actorName =
  actorProfile?.display_name?.trim() ||
  actorProfile?.email?.trim() ||
  'Din vän'

const { data: friends, error: friendsError } = await supabase
  .from('friends')
  .select('friend_email')
  .eq('user_id', user.id)

if (friendsError) {
  console.error('Failed to load friends for round start push:', friendsError)
} else {
  const friendEmails =
    friends
      ?.map((friend) => friend.friend_email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email)) ?? []

  if (friendEmails.length > 0) {
    const { data: friendProfiles, error: friendProfilesError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, email, push_friend_activity_enabled')
        .in('email', friendEmails)

    if (friendProfilesError) {
      console.error(
        'Failed to load friend profiles for round start push:',
        friendProfilesError
      )
    } else {
      const enabledFriendIds =
        friendProfiles
          ?.filter((profile) => profile.push_friend_activity_enabled)
          .map((profile) => profile.id) ?? []

      if (enabledFriendIds.length > 0) {
        const { data: subscriptions, error: subscriptionsError } =
          await supabaseAdmin
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth, user_id')
            .in('user_id', enabledFriendIds)

        if (subscriptionsError) {
          console.error(
            'Failed to load push subscriptions for round start:',
            subscriptionsError
          )
        } else {
          await Promise.allSettled(
            (subscriptions ?? []).map((sub) =>
              sendPushNotification(sub, {
                title: '⛳ Vän på banan',
                body: `${actorName} är ute på banan nu`,
                url: '/dashboard',
              })
            )
          )
        }
      }
    }
  }
}
  return NextResponse.json({
    roundId: round.id,
    startHole,
    endHole,
  })
}

