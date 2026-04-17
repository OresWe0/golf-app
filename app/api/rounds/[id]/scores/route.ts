import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendPushNotification } from '@/lib/send-push'

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

function buildRequestId() {
  const rand = Math.random().toString(36).slice(2, 8)
  return `scores_${Date.now()}_${rand}`
}

function fail(
  requestId: string,
  stage: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>
) {
  console.error('[scores-api] fail', {
    requestId,
    stage,
    status,
    message,
    ...extra,
  })
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = buildRequestId()
  const { id } = await params
  const supabase = await createClient()

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createAdminClient(supabaseUrl, serviceRoleKey, {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          })
        : null

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return fail(requestId, 'auth', 'Inte inloggad.', 401, { roundId: id })
    }

    const body = await request.json().catch(() => null)
    const holeNumber = Number(body?.holeNumber)
    const rawScoreUpdates: ScoreUpdate[] = Array.isArray(body?.scores) ? body.scores : []

    if (!Number.isInteger(holeNumber) || holeNumber < 1) {
      return fail(requestId, 'validate_body', 'Ogiltigt halnummer.', 400, {
        roundId: id,
        userId: user.id,
        holeNumberRaw: body?.holeNumber,
      })
    }

    if (rawScoreUpdates.length === 0) {
      return fail(requestId, 'validate_body', 'Inga scorer att spara.', 400, {
        roundId: id,
        userId: user.id,
        holeNumber,
      })
    }

    const scoreUpdates: ScoreUpdate[] = []
    const seenRoundPlayerIds = new Set<string>()

    for (const score of rawScoreUpdates) {
      const roundPlayerId = String(score.roundPlayerId || '').trim()
      const strokes = score.strokes == null ? null : Number(score.strokes)

      if (!roundPlayerId) {
        return fail(requestId, 'validate_scores', 'Saknar roundPlayerId.', 400, {
          roundId: id,
          userId: user.id,
          holeNumber,
        })
      }

      if (seenRoundPlayerIds.has(roundPlayerId)) {
        return fail(
          requestId,
          'validate_scores',
          `Duplicerad roundPlayerId: ${roundPlayerId}`,
          400,
          { roundId: id, userId: user.id, holeNumber }
        )
      }

      if (strokes != null && (!Number.isFinite(strokes) || strokes < 1)) {
        return fail(requestId, 'validate_scores', 'Ogiltig score.', 400, {
          roundId: id,
          userId: user.id,
          holeNumber,
          roundPlayerId,
          strokes,
        })
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
      return fail(requestId, 'round_lookup', 'Rundan hittades inte.', 404, {
        roundId: id,
        userId: user.id,
        dbError: roundError?.message,
      })
    }

    if (round.owner_id !== user.id) {
      const { data: membership } = await supabase
        .from('round_members')
        .select('id')
        .eq('round_id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!membership) {
        return fail(
          requestId,
          'permission',
          'Du har inte behorighet att spara score i denna runda.',
          403,
          {
            roundId: id,
            userId: user.id,
            ownerId: round.owner_id,
          }
        )
      }
    }

    const startHole = round.start_hole ?? 1
    const endHole = round.end_hole ?? 18

    if (holeNumber < startHole || holeNumber > endHole) {
      return fail(
        requestId,
        'hole_range',
        'Halet ligger utanfor rundans intervall.',
        400,
        {
          roundId: id,
          userId: user.id,
          holeNumber,
          startHole,
          endHole,
        }
      )
    }

    const roundPlayerIds = scoreUpdates.map((score) => score.roundPlayerId)

    const { data: roundPlayers, error: roundPlayersError } = await supabase
      .from('round_players')
      .select('id, user_id')
      .eq('round_id', id)
      .in('id', roundPlayerIds)

    if (roundPlayersError) {
      return fail(requestId, 'round_players_lookup', roundPlayersError.message, 400, {
        roundId: id,
        userId: user.id,
        holeNumber,
      })
    }

    if (!roundPlayers || roundPlayers.length !== roundPlayerIds.length) {
      return fail(
        requestId,
        'round_players_validate',
        'En eller flera spelare tillhor inte rundan.',
        400,
        {
          roundId: id,
          userId: user.id,
          holeNumber,
          requestedRoundPlayers: roundPlayerIds.length,
          foundRoundPlayers: roundPlayers?.length ?? 0,
        }
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
        return fail(requestId, 'update_score', error.message, 400, {
          roundId: id,
          userId: user.id,
          holeNumber,
          roundPlayerId: score.roundPlayerId,
        })
      }

      if (!updatedScoreRow) {
        return fail(
          requestId,
          'update_score_missing_row',
          `Ingen scorerad hittades for spelare ${score.roundPlayerId}.`,
          400,
          {
            roundId: id,
            userId: user.id,
            holeNumber,
            roundPlayerId: score.roundPlayerId,
          }
        )
      }
    }

    if (!round.course_id) {
      return fail(requestId, 'missing_course_id', 'Rundan saknar course_id.', 400, {
        roundId: id,
        userId: user.id,
        holeNumber,
      })
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
      return fail(requestId, 'hole_par_lookup', 'Kunde inte hitta halets par.', 400, {
        roundId: id,
        userId: user.id,
        holeNumber,
        courseId: round.course_id,
        dbError: holeError?.message,
      })
    }

    const par = Number(holeRows[0].par)

    if (!Number.isFinite(par) || par < 1) {
      return fail(requestId, 'hole_par_validate', 'Ogiltigt par-varde for halet.', 400, {
        roundId: id,
        userId: user.id,
        holeNumber,
        parRaw: holeRows[0].par,
      })
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
        return fail(requestId, 'feed_cleanup', deleteFeedEventError.message, 400, {
          roundId: id,
          userId: user.id,
          holeNumber,
          roundPlayerId: score.roundPlayerId,
        })
      }

      if (score.strokes == null) continue

      const eventType = getFeedEventType(score.strokes, par)
      if (!eventType) continue

      const { data: playerProfile } = supabaseAdmin
        ? await supabaseAdmin
            .from('profiles')
            .select('display_name, email')
            .eq('id', roundPlayer.user_id)
            .maybeSingle()
        : { data: null }

      const playerName =
        playerProfile?.display_name?.trim() || playerProfile?.email?.trim() || 'Okand spelare'

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
        return fail(requestId, 'feed_insert', insertFeedEventError.message, 400, {
          roundId: id,
          userId: user.id,
          holeNumber,
          roundPlayerId: score.roundPlayerId,
          eventType,
        })
      }

      const { data: friends, error: friendsError } = await supabase
        .from('friends')
        .select('friend_email')
        .eq('user_id', roundPlayer.user_id)

      if (friendsError) {
        console.error('[scores-api] warn_friends_lookup', {
          requestId,
          roundId: id,
          userId: user.id,
          holeNumber,
          dbError: friendsError.message,
        })
        continue
      }

      const friendEmails =
        friends
          ?.map((friend) => friend.friend_email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)) ?? []

      if (friendEmails.length === 0) continue
      if (!supabaseAdmin) continue

      const { data: friendProfiles, error: friendProfilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, push_friend_activity_enabled')
        .in('email', friendEmails)

      if (friendProfilesError) {
        console.error('[scores-api] warn_friend_profiles_lookup', {
          requestId,
          roundId: id,
          userId: user.id,
          holeNumber,
          dbError: friendProfilesError.message,
        })
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
        console.error('[scores-api] warn_push_subscriptions_lookup', {
          requestId,
          roundId: id,
          userId: user.id,
          holeNumber,
          dbError: subscriptionsError.message,
        })
        continue
      }

      let title = 'Ny aktivitet'
      let pushBody = `${playerName} gjorde nagot bra!`

      if (eventType === 'birdie') {
        title = 'Birdie!'
        pushBody = `${playerName} gjorde birdie pa hal ${holeNumber}`
      } else if (eventType === 'eagle') {
        title = 'Eagle!'
        pushBody = `${playerName} gjorde eagle pa hal ${holeNumber}`
      } else if (eventType === 'hole_in_one') {
        title = 'Hole-in-one!'
        pushBody = `${playerName} gjorde hole-in-one pa hal ${holeNumber}!`
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
      return fail(requestId, 'round_update', updateRoundError.message, 400, {
        roundId: id,
        userId: user.id,
        holeNumber,
      })
    }

    return NextResponse.json({
      ok: true,
      currentHole: safeNextHole,
      status: nextStatus,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okant serverfel vid scores.'
    return fail(requestId, 'unhandled_exception', message, 500, { roundId: id })
  }
}
