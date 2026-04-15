import { sendPushNotification } from '@/lib/send-push'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'


type ScoreUpdate = {
  roundPlayerId: string
  strokes: number | null
}

type FeedEventType = 'birdie' | 'eagle' | 'hole_in_one'

function getFeedEventType(
  strokes: number,
  par: number
): FeedEventType | null {
  if (strokes === 1) return 'hole_in_one'
  if (strokes === par - 2) return 'eagle'
  if (strokes === par - 1) return 'birdie'
  return null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const holeNumber = Number(body?.holeNumber)
  const scoreUpdates: ScoreUpdate[] = Array.isArray(body?.scores)
    ? body.scores
    : []

  if (!Number.isInteger(holeNumber) || holeNumber < 1) {
    return NextResponse.json({ error: 'Ogiltigt hålnummer.' }, { status: 400 })
  }

  if (scoreUpdates.length === 0) {
    return NextResponse.json({ error: 'Inga scorer att spara.' }, { status: 400 })
  }

  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('id, owner_id, start_hole, end_hole, current_hole, status, course_id')
    .eq('id', id)
    .single()

  if (roundError || !round) {
    return NextResponse.json({ error: 'Rundan hittades inte.' }, { status: 404 })
  }

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

  // Hämta spelare i rundan så att feed-events kopplas till rätt user_id
  const roundPlayerIds = scoreUpdates.map((score) => String(score.roundPlayerId || ''))

  const { data: roundPlayers, error: roundPlayersError } = await supabase
    .from('round_players')
    .select('id, user_id')
    .in('id', roundPlayerIds)

  if (roundPlayersError) {
    return NextResponse.json({ error: roundPlayersError.message }, { status: 400 })
  }

  const roundPlayerById = new Map(
    (roundPlayers ?? []).map((player) => [player.id, player] as const)
  )

  if (!round.course_id) {
    return NextResponse.json(
      { error: 'Rundan saknar course_id.' },
      { status: 400 }
    )
  }

  // Hämta par för aktuellt hål
  const { data: holeRows, error: holeError } = await supabase
    .from('course_holes')
    .select('par')
    .eq('course_id', round.course_id)
    .eq('hole_number', holeNumber)
    .limit(1)

  if (holeError || !holeRows || holeRows.length === 0) {
    return NextResponse.json(
      { error: 'Kunde inte hitta hålets par.' },
      { status: 400 }
    )
  }

  const par = Number(holeRows[0].par)

  if (!Number.isFinite(par) || par < 1) {
    return NextResponse.json(
      { error: 'Ogiltigt par-värde för hålet.' },
      { status: 400 }
    )
  }

  // Skapa eller ta bort feed-events för detta hål
  for (const score of scoreUpdates) {
    const roundPlayerId = String(score.roundPlayerId || '')
    const strokes = score.strokes == null ? null : Number(score.strokes)
    const roundPlayer = roundPlayerById.get(roundPlayerId)

    if (!roundPlayer?.user_id) {
      continue
    }

    // Ta alltid bort gammal event för samma spelare + hål först
    const { error: deleteFeedEventError } = await supabase
      .from('feed_events')
      .delete()
      .eq('round_player_id', roundPlayerId)
      .eq('hole_number', holeNumber)

    if (deleteFeedEventError) {
      return NextResponse.json(
        { error: deleteFeedEventError.message },
        { status: 400 }
      )
    }

    if (strokes == null) {
      continue
    }

    const eventType = getFeedEventType(strokes, par)

    if (!eventType) {
      continue
    }

    const { data: playerProfile } = await supabaseAdmin
  .from('profiles')
  .select('display_name, email')
  .eq('id', roundPlayer.user_id)
  .maybeSingle()

const playerName =
  playerProfile?.display_name?.trim() ||
  playerProfile?.email?.trim() ||
  'Okänd spelare'

const { data: courseDetails } = await supabase
  .from('courses')
  .select('name')
  .eq('id', round.course_id)
  .maybeSingle()

const { error: insertFeedEventError } = await supabase
  .from('feed_events')
  .insert({
    user_id: roundPlayer.user_id,
    round_id: id,
    round_player_id: roundPlayerId,
    event_type: eventType,
    hole_number: holeNumber,
    player_name: playerName,
    course_name: courseDetails?.name ?? null,
  })

if (insertFeedEventError) {
  return NextResponse.json(
    { error: insertFeedEventError.message },
    { status: 400 }
  )
}
// 🔥 Skicka push vid birdie/eagle/hole-in-one
if (
  eventType === 'birdie' ||
  eventType === 'eagle' ||
  eventType === 'hole_in_one'
) {
  const { data: actorProfile } = await supabaseAdmin
    .from('profiles')
    .select('display_name, email')
    .eq('id', roundPlayer.user_id)
    .maybeSingle()

  const actorName =
    actorProfile?.display_name?.trim() ||
    actorProfile?.email?.trim() ||
    'Din vän'

  // 1. hämta vänners e-post
  const { data: friends, error: friendsError } = await supabase
    .from('friends')
    .select('friend_email')
    .eq('user_id', roundPlayer.user_id)

  if (friendsError) {
    console.error('Failed to load friends for push:', friendsError)
  } else {
    const friendEmails =
      friends
        ?.map((friend) => friend.friend_email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)) ?? []

    if (friendEmails.length > 0) {
      // 2. hitta profiler för dessa vänner
      const { data: friendProfiles, error: friendProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, push_friend_activity_enabled')
        .in('email', friendEmails)

      if (friendProfilesError) {
        console.error('Failed to load friend profiles for push:', friendProfilesError)
      } else {
        const enabledFriendIds =
          friendProfiles
            ?.filter((profile) => profile.push_friend_activity_enabled)
            .map((profile) => profile.id) ?? []

        if (enabledFriendIds.length > 0) {
          // 3. hämta deras subscriptions
          const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth, user_id')
            .in('user_id', enabledFriendIds)

          if (subscriptionsError) {
            console.error('Failed to load push subscriptions:', subscriptionsError)
          } else {
            let title = '⛳ Ny aktivitet'
            let body = `${actorName} gjorde något bra!`

            if (eventType === 'birdie') {
              title = '🐦 Birdie!'
              body = `${actorName} gjorde birdie på hål ${holeNumber}`
            }

            if (eventType === 'eagle') {
              title = '🦅 Eagle!'
              body = `${actorName} gjorde eagle på hål ${holeNumber}`
            }

            if (eventType === 'hole_in_one') {
              title = '🎯 Hole-in-one!'
              body = `${actorName} gjorde hole-in-one på hål ${holeNumber}!`
            }

                        await Promise.all(
              (subscriptions ?? []).map((sub) =>
                sendPushNotification(sub, {
                  title,
                  body,
                  url: '/dashboard',
                })
              )
            )
          }
        }
      }
    }
  }
}
}

const requestedNextHole = holeNumber < endHole ? holeNumber + 1 : endHole
  const requestedStatus = holeNumber >= endHole ? 'completed' : 'active'

  const currentRoundHole =
    typeof round.current_hole === 'number' && Number.isFinite(round.current_hole)
      ? round.current_hole
      : startHole

  const safeNextHole = Math.max(currentRoundHole, requestedNextHole)
  const nextStatus = round.status === 'completed' ? 'completed' : requestedStatus

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