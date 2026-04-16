import { sendPushNotification } from '@/lib/send-push'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

type ScoreUpdate = {
  roundPlayerId: string
  strokes: number | null
}

type FeedEventType = 'birdie' | 'eagle' | 'hole_in_one'

function getFeedEventType(strokes: number, par: number): FeedEventType | null {
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Serverkonfiguration saknas fÃ¶r push.' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const holeNumber = Number(body?.holeNumber)
  const rawScoreUpdates: ScoreUpdate[] = Array.isArray(body?.scores) ? body.scores : []

  if (!Number.isInteger(holeNumber) || holeNumber < 1) {
    return NextResponse.json({ error: 'Ogiltigt hÃ¥lnummer.' }, { status: 400 })
  }

  if (rawScoreUpdates.length === 0) {
    return NextResponse.json({ error: 'Inga scorer att spara.' }, { status: 400 })
  }

  const scoreUpdates: ScoreUpdate[] = []
  const seenRoundPlayerIds = new Set<string>()

  for (const score of rawScoreUpdates) {
    const roundPlayerId = String(score.roundPlayerId || '').trim()
    const strokes = score.strokes == null ? null : Number(score.strokes)

    if (!roundPlayerId) {
      return NextResponse.json({ error: 'Saknar roundPlayerId.' }, { status: 400 })
    }

    if (seenRoundPlayerIds.has(roundPlayerId)) {
      return NextResponse.json(
        { error: `Duplicerad roundPlayerId: ${roundPlayerId}` },
        { status: 400 }
      )
    }

    if (strokes != null && (!Number.isFinite(strokes) || strokes < 1)) {
      return NextResponse.json({ error: 'Ogiltig score.' }, { status: 400 })
    }

    seenRoundPlayerIds.add(roundPlayerId)
    scoreUpdates.push({ roundPlayerId, strokes })
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
      { error: 'Du har inte behÃ¶righet att spara score i denna runda.' },
      { status: 403 }
    )
  }

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? 18

  if (holeNumber < startHole || holeNumber > endHole) {
    return NextResponse.json(
      { error: 'HÃ¥let ligger utanfÃ¶r rundans intervall.' },
      { status: 400 }
    )
  }

  const roundPlayerIds = scoreUpdates.map((score) => score.roundPlayerId)

  const { data: roundPlayers, error: roundPlayersError } = await supabase
    .from('round_players')
    .select('id, user_id')
    .eq('round_id', id)
    .in('id', roundPlayerIds)

  if (roundPlayersError) {
    return NextResponse.json({ error: roundPlayersError.message }, { status: 400 })
  }

  if (!roundPlayers || roundPlayers.length !== roundPlayerIds.length) {
    return NextResponse.json(
      { error: 'En eller flera spelare tillhÃ¶r inte rundan.' },
      { status: 400 }
    )
  }

  const roundPlayerById = new Map(roundPlayers.map((player) => [player.id, player] as const))

  for (const score of scoreUpdates) {
    const { data: updatedScoreRow, error } = await supabase
      .from('hole_scores')
      .update({ strokes: score.strokes })
      .eq('round_id', id)
      .eq('round_player_id', score.roundPlayerId)
      .eq('hole_number', holeNumber)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!updatedScoreRow) {
      return NextResponse.json(
        { error: `Ingen scorerad hittades fÃ¶r spelare ${score.roundPlayerId}.` },
        { status: 400 }
      )
    }
  }

  if (!round.course_id) {
    return NextResponse.json({ error: 'Rundan saknar course_id.' }, { status: 400 })
  }

  const [{ data: holeRows, error: holeError }, { data: courseDetails }] = await Promise.all([
    supabase
      .from('course_holes')
      .select('par')
      .eq('course_id', round.course_id)
      .eq('hole_number', holeNumber)
      .limit(1),
    supabase.from('courses').select('name').eq('id', round.course_id).maybeSingle(),
  ])

  if (holeError || !holeRows || holeRows.length === 0) {
    return NextResponse.json({ error: 'Kunde inte hitta hÃ¥lets par.' }, { status: 400 })
  }

  const par = Number(holeRows[0].par)

  if (!Number.isFinite(par) || par < 1) {
    return NextResponse.json({ error: 'Ogiltigt par-vÃ¤rde fÃ¶r hÃ¥let.' }, { status: 400 })
  }

  for (const score of scoreUpdates) {
    const roundPlayer = roundPlayerById.get(score.roundPlayerId)
    if (!roundPlayer?.user_id) continue

    const { error: deleteFeedEventError } = await supabase
      .from('feed_events')
      .delete()
      .eq('round_id', id)
      .eq('round_player_id', score.roundPlayerId)
      .eq('hole_number', holeNumber)

    if (deleteFeedEventError) {
      return NextResponse.json({ error: deleteFeedEventError.message }, { status: 400 })
    }

    if (score.strokes == null) continue

    const eventType = getFeedEventType(score.strokes, par)
    if (!eventType) continue

    const { data: playerProfile } = await supabaseAdmin
      .from('profiles')
      .select('display_name, email')
      .eq('id', roundPlayer.user_id)
      .maybeSingle()

    const playerName =
      playerProfile?.display_name?.trim() || playerProfile?.email?.trim() || 'OkÃ¤nd spelare'

    const { error: insertFeedEventError } = await supabase.from('feed_events').insert({
      user_id: roundPlayer.user_id,
      round_id: id,
      round_player_id: score.roundPlayerId,
      event_type: eventType,
      hole_number: holeNumber,
      player_name: playerName,
      course_name: courseDetails?.name ?? null,
    })

    if (insertFeedEventError) {
      return NextResponse.json({ error: insertFeedEventError.message }, { status: 400 })
    }

    const { data: friends, error: friendsError } = await supabase
      .from('friends')
      .select('friend_email')
      .eq('user_id', roundPlayer.user_id)

    if (friendsError) {
      console.error('Failed to load friends for push:', friendsError)
      continue
    }

    const friendEmails =
      friends
        ?.map((friend) => friend.friend_email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)) ?? []

    if (friendEmails.length === 0) continue

    const { data: friendProfiles, error: friendProfilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, push_friend_activity_enabled')
      .in('email', friendEmails)

    if (friendProfilesError) {
      console.error('Failed to load friend profiles for push:', friendProfilesError)
      continue
    }

    const enabledFriendIds =
      friendProfiles
        ?.filter((profile) => profile.push_friend_activity_enabled)
        .map((profile) => profile.id) ?? []

    if (enabledFriendIds.length === 0) continue

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', enabledFriendIds)

    if (subscriptionsError) {
      console.error('Failed to load push subscriptions:', subscriptionsError)
      continue
    }

    let title = 'â›³ Ny aktivitet'
    let pushBody = `${playerName} gjorde nÃ¥got bra!`

    if (eventType === 'birdie') {
      title = 'ðŸ¦ Birdie!'
      pushBody = `${playerName} gjorde birdie pÃ¥ hÃ¥l ${holeNumber}`
    } else if (eventType === 'eagle') {
      title = 'ðŸ¦… Eagle!'
      pushBody = `${playerName} gjorde eagle pÃ¥ hÃ¥l ${holeNumber}`
    } else if (eventType === 'hole_in_one') {
      title = 'ðŸŽ¯ Hole-in-one!'
      pushBody = `${playerName} gjorde hole-in-one pÃ¥ hÃ¥l ${holeNumber}!`
    }

    await Promise.allSettled(
      (subscriptions ?? []).map((sub) =>
        sendPushNotification(sub, {
          title,
          body: pushBody,
          url: '/dashboard',
        })
      )
    )
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
