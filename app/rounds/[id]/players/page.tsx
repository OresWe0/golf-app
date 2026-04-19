import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  calculatePlayingHandicap,
  getPlayingHandicapForSelectedHoles,
  normalizeTeeKey,
  type TeeKey,
} from '@/lib/scoring'

type RoundRow = {
  id: string
  owner_id: string
  course_id: string
  title: string
  status: string
  current_hole: number | null
  start_hole: number | null
  end_hole: number | null
}

type RoundPlayerRow = {
  id: string
  user_id: string | null
  invited_email: string | null
  display_name: string
  exact_handicap: number | null
  tee_key: string | null
  sort_order: number
  active_from_hole: number | null
  active_to_hole: number | null
}

type TeeRow = {
  tee_key: string
  slope_rating: number | null
  course_rating: number | null
  tee_par: number | null
}

type HoleRow = {
  hole_number: number
  hcp_index: number
}

type CourseRow = {
  total_par: number
}

type ProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  handicap_index: number | null
}

type FriendRow = {
  friend_email: string | null
  friend_name: string | null
}

type FriendProfileRow = {
  email: string | null
  display_name: string | null
}

function toNumberOrNull(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(',', '.')
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function getCurrentHole(round: RoundRow) {
  return Math.max(round.start_hole ?? 1, round.current_hole ?? round.start_hole ?? 1)
}

function isActiveOnHole(player: RoundPlayerRow, holeNumber: number, startHole: number, endHole: number) {
  const from = player.active_from_hole ?? startHole
  const to = player.active_to_hole ?? endHole
  return holeNumber >= from && holeNumber <= to
}

async function requireOwnerRoundContext(roundId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: round } = await supabase
    .from('rounds')
    .select('id, owner_id, course_id, title, status, current_hole, start_hole, end_hole')
    .eq('id', roundId)
    .single()

  if (!round) {
    notFound()
  }

  if (round.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('round_members')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      notFound()
    }

    redirect(`/rounds/${roundId}`)
  }

  return { supabase, user, round: round as RoundRow }
}

async function addPlayerToRound(args: {
  roundId: string
  displayName: string
  exactHandicap: number | null
  teeKey: TeeKey
  userId?: string | null
  invitedEmail?: string | null
}) {
  const { supabase, round } = await requireOwnerRoundContext(args.roundId)

  if (round.status === 'completed') {
    throw new Error('Rundan ar redan avslutad.')
  }

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? 18
  const joinHole = Math.min(Math.max(getCurrentHole(round), startHole), endHole)

  const normalizedEmail = String(args.invitedEmail ?? '').trim().toLowerCase() || null

  if (args.userId) {
    const { data: existingByUser } = await supabase
      .from('round_players')
      .select('id')
      .eq('round_id', round.id)
      .eq('user_id', args.userId)
      .gte('active_to_hole', joinHole)
      .limit(1)

    if ((existingByUser ?? []).length > 0) {
      throw new Error('Spelaren ar redan med i bollen.')
    }
  } else if (normalizedEmail) {
    const { data: existingByEmail } = await supabase
      .from('round_players')
      .select('id')
      .eq('round_id', round.id)
      .eq('invited_email', normalizedEmail)
      .gte('active_to_hole', joinHole)
      .limit(1)

    if ((existingByEmail ?? []).length > 0) {
      throw new Error('Spelaren ar redan med i bollen.')
    }
  }

  const [{ data: course }, { data: tees }, { data: holes }, { data: latestSortOrderRow }] =
    await Promise.all([
      supabase.from('courses').select('total_par').eq('id', round.course_id).single(),
      supabase
        .from('course_tees')
        .select('tee_key, slope_rating, course_rating, tee_par')
        .eq('course_id', round.course_id),
      supabase
        .from('course_holes')
        .select('hole_number, hcp_index')
        .eq('course_id', round.course_id)
        .order('hole_number'),
      supabase
        .from('round_players')
        .select('sort_order')
        .eq('round_id', round.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (!course || !tees || !holes) {
    throw new Error('Kunde inte lasa banans data.')
  }

  const tee = (tees as TeeRow[]).find((item) => item.tee_key === args.teeKey)
  if (!tee) {
    throw new Error('Ogiltig tee vald.')
  }

  const visibleHoles = (holes as HoleRow[]).filter(
    (hole) => hole.hole_number >= joinHole && hole.hole_number <= endHole
  )

  if (visibleHoles.length === 0) {
    throw new Error('Kunde inte hitta hal for spelarens startposition.')
  }

  const courseHandicap = calculatePlayingHandicap({
    handicapIndex: args.exactHandicap,
    slopeRating: tee.slope_rating ?? null,
    courseRating: tee.course_rating ?? null,
    par: tee.tee_par ?? (course as CourseRow).total_par,
  })

  const playingHandicap = getPlayingHandicapForSelectedHoles(
    courseHandicap,
    visibleHoles.map((hole) => hole.hcp_index)
  )

  const nextSortOrder = Number(latestSortOrderRow?.sort_order ?? 0) + 1

  const { data: insertedPlayer, error: insertPlayerError } = await supabase
    .from('round_players')
    .insert({
      round_id: round.id,
      user_id: args.userId ?? null,
      invited_email: normalizedEmail,
      display_name: args.displayName,
      handicap_index: args.exactHandicap,
      exact_handicap: args.exactHandicap,
      tee_key: args.teeKey,
      playing_handicap: playingHandicap,
      sort_order: nextSortOrder,
      active_from_hole: joinHole,
      active_to_hole: endHole,
    })
    .select('id')
    .single()

  if (insertPlayerError || !insertedPlayer) {
    throw new Error(insertPlayerError?.message || 'Kunde inte lagga till spelaren.')
  }

  const scoreRows = visibleHoles.map((hole) => ({
    round_id: round.id,
    round_player_id: insertedPlayer.id,
    hole_number: hole.hole_number,
    strokes: null,
  }))

  const { error: insertScoresError } = await supabase.from('hole_scores').insert(scoreRows)
  if (insertScoresError) {
    throw new Error(insertScoresError.message)
  }

  if (args.userId) {
    await supabase
      .from('round_members')
      .upsert(
        {
          round_id: round.id,
          user_id: args.userId,
          role: 'player',
        },
        { onConflict: 'round_id,user_id' }
      )
  }
}

export default async function RoundPlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ message?: string; type?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = await searchParams

  const { supabase, round } = await requireOwnerRoundContext(id)

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? 18
  const currentHole = getCurrentHole(round)

  const [{ data: playersRaw }, { data: friendsRaw }, { data: friendProfilesRaw }] =
    await Promise.all([
      supabase
        .from('round_players')
        .select(
          'id, user_id, invited_email, display_name, exact_handicap, tee_key, sort_order, active_from_hole, active_to_hole'
        )
        .eq('round_id', id)
        .order('sort_order'),
      supabase
        .from('friends')
        .select('friend_email, friend_name')
        .eq('user_id', round.owner_id)
        .order('created_at', { ascending: true }),
      (async () => {
        const { data: friendRows } = await supabase
          .from('friends')
          .select('friend_email')
          .eq('user_id', round.owner_id)

        const emails =
          (friendRows ?? [])
            .map((row) => String(row.friend_email ?? '').trim().toLowerCase())
            .filter(Boolean) ?? []

        if (emails.length === 0) {
          return { data: [] as FriendProfileRow[] }
        }

        return supabase.from('profiles').select('email, display_name').in('email', emails)
      })(),
    ])

  const players = (playersRaw as RoundPlayerRow[] | null) ?? []
  const activePlayers = players.filter((player) =>
    isActiveOnHole(player, currentHole, startHole, endHole)
  )
  const inactivePlayers = players.filter(
    (player) => !isActiveOnHole(player, currentHole, startHole, endHole)
  )

  const friends = (friendsRaw as FriendRow[] | null) ?? []
  const friendProfiles = (friendProfilesRaw as FriendProfileRow[] | null) ?? []

  async function removePlayerAction(formData: FormData) {
    'use server'

    const roundPlayerId = String(formData.get('round_player_id') ?? '').trim()
    if (!roundPlayerId) {
      redirect(`/rounds/${id}/players?message=Saknar spelare&type=error`)
    }

    try {
      const { supabase, round } = await requireOwnerRoundContext(id)
      const currentHole = getCurrentHole(round)
      const startHole = round.start_hole ?? 1
      const endHole = round.end_hole ?? 18

      const { data: target } = await supabase
        .from('round_players')
        .select('id, display_name, active_from_hole, active_to_hole')
        .eq('round_id', id)
        .eq('id', roundPlayerId)
        .single()

      if (!target) {
        throw new Error('Spelaren hittades inte.')
      }

      const currentlyActive =
        currentHole >= (target.active_from_hole ?? startHole) &&
        currentHole <= (target.active_to_hole ?? endHole)

      if (!currentlyActive) {
        throw new Error('Spelaren ar redan borttagen.')
      }

      const { data: activeNow } = await supabase
        .from('round_players')
        .select('id, active_from_hole, active_to_hole')
        .eq('round_id', id)

      const activeNowCount =
        (activeNow ?? []).filter(
          (player) =>
            currentHole >= (player.active_from_hole ?? startHole) &&
            currentHole <= (player.active_to_hole ?? endHole)
        ).length ?? 0

      if (activeNowCount <= 1) {
        throw new Error('Minst en spelare maste vara kvar i bollen.')
      }

      const leaveAfterHole = currentHole - 1
      if (leaveAfterHole < (target.active_from_hole ?? startHole)) {
        throw new Error('Kan inte ta bort spelaren innan den borjat spela.')
      }

      const { error: updateError } = await supabase
        .from('round_players')
        .update({ active_to_hole: leaveAfterHole })
        .eq('round_id', id)
        .eq('id', roundPlayerId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      revalidatePath(`/rounds/${id}`)
      revalidatePath(`/rounds/${id}/summary`)
      revalidatePath(`/rounds/${id}/players`)

      redirect(
        `/rounds/${id}/players?message=Spelaren ar borttagen fran kommande hal&type=success`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte ta bort spelaren.'
      redirect(`/rounds/${id}/players?message=${encodeURIComponent(message)}&type=error`)
    }
  }

  async function addRegisteredPlayerAction(formData: FormData) {
    'use server'

    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase()
    const teeKey = normalizeTeeKey(formData.get('tee_key'))
    const handicapOverride = toNumberOrNull(formData.get('exact_handicap'))

    if (!email) {
      redirect(`/rounds/${id}/players?message=Ange e-post&type=error`)
    }

    try {
      const { supabase } = await requireOwnerRoundContext(id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, display_name, handicap_index')
        .eq('email', email)
        .maybeSingle()

      if (!profile) {
        throw new Error('Ingen registrerad anvandare hittades for e-posten.')
      }

      const profileRow = profile as ProfileRow
      const displayName =
        profileRow.display_name?.trim() ||
        String(profileRow.email ?? '').split('@')[0] ||
        'Spelare'

      await addPlayerToRound({
        roundId: id,
        displayName,
        exactHandicap: handicapOverride ?? profileRow.handicap_index ?? null,
        teeKey,
        userId: profileRow.id,
        invitedEmail: profileRow.email,
      })

      revalidatePath(`/rounds/${id}`)
      revalidatePath(`/rounds/${id}/summary`)
      revalidatePath(`/rounds/${id}/players`)

      redirect(`/rounds/${id}/players?message=Spelaren ar tillagd fran hal ${currentHole}&type=success`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte lagga till spelaren.'
      redirect(`/rounds/${id}/players?message=${encodeURIComponent(message)}&type=error`)
    }
  }

  async function addGuestPlayerAction(formData: FormData) {
    'use server'

    const displayName = String(formData.get('display_name') ?? '').trim()
    const teeKey = normalizeTeeKey(formData.get('tee_key'))
    const exactHandicap = toNumberOrNull(formData.get('exact_handicap'))

    if (!displayName) {
      redirect(`/rounds/${id}/players?message=Ange namn pa gastspelaren&type=error`)
    }

    try {
      await addPlayerToRound({
        roundId: id,
        displayName,
        exactHandicap,
        teeKey,
      })

      revalidatePath(`/rounds/${id}`)
      revalidatePath(`/rounds/${id}/summary`)
      revalidatePath(`/rounds/${id}/players`)

      redirect(`/rounds/${id}/players?message=Gastspelare ar tillagd fran hal ${currentHole}&type=success`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunde inte lagga till gastspelare.'
      redirect(`/rounds/${id}/players?message=${encodeURIComponent(message)}&type=error`)
    }
  }

  const flashMessage = resolvedSearchParams.message
    ? decodeURIComponent(resolvedSearchParams.message)
    : ''
  const flashType = resolvedSearchParams.type === 'success' ? 'success' : 'error'

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div className="badge">Hantera spelare</div>
              <h1 className="title" style={{ margin: '10px 0 6px' }}>
                {round.title}
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Aktuellt hal: {currentHole}. Nya spelare startar pa detta hal. Borttagning galler kommande hal.
              </p>
            </div>

            <Link className="button secondary" href={`/rounds/${id}`}>
              Till rundan
            </Link>
          </div>

          {flashMessage ? (
            <div
              style={{
                borderRadius: 12,
                padding: '10px 12px',
                border: `1px solid ${flashType === 'success' ? '#86efac' : '#fecaca'}`,
                background: flashType === 'success' ? '#f0fdf4' : '#fef2f2',
                color: flashType === 'success' ? '#166534' : '#991b1b',
                fontWeight: 700,
              }}
            >
              {flashMessage}
            </div>
          ) : null}
        </div>

        <div className="card" style={{ padding: 20, display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Aktiva spelare ({activePlayers.length})</h2>
            <div className="muted">Spelar mellan hal {currentHole} och hal {endHole}</div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {activePlayers.map((player) => (
              <div
                key={player.id}
                style={{
                  border: '1px solid #dbe7dd',
                  borderRadius: 14,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong>{player.display_name}</strong>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {player.tee_key === 'red' ? 'Red tee' : 'Yellow tee'} · Exakt HCP {player.exact_handicap ?? '-'}
                  </div>
                </div>

                <form action={removePlayerAction}>
                  <input type="hidden" name="round_player_id" value={player.id} />
                  <button type="submit" className="button secondary">
                    Ta bort fran kommande hal
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20, display: 'grid', gap: 16 }}>
          <h2 style={{ margin: 0 }}>Lagga till spelare</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Registrerad spelare</h3>
            <form action={addRegisteredPlayerAction} style={{ display: 'grid', gap: 10 }}>
              <input
                name="email"
                type="email"
                placeholder="epost@domain.se"
                list="friend-emails"
                required
                style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
              />

              <datalist id="friend-emails">
                {friends.map((friend) => {
                  const email = String(friend.friend_email ?? '').trim().toLowerCase()
                  if (!email) return null

                  const profile = friendProfiles.find(
                    (item) => String(item.email ?? '').trim().toLowerCase() === email
                  )

                  const label = friend.friend_name || profile?.display_name || email
                  return (
                    <option key={email} value={email}>
                      {label}
                    </option>
                  )
                })}
              </datalist>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <select
                  name="tee_key"
                  defaultValue="yellow"
                  style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
                >
                  <option value="yellow">Yellow tee</option>
                  <option value="red">Red tee</option>
                </select>

                <input
                  name="exact_handicap"
                  type="text"
                  placeholder="HCP (valfritt)"
                  style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
                />
              </div>

              <button type="submit" className="button">
                Lagg till registrerad spelare
              </button>
            </form>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Gastspelare</h3>
            <form action={addGuestPlayerAction} style={{ display: 'grid', gap: 10 }}>
              <input
                name="display_name"
                type="text"
                placeholder="Namn"
                required
                style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <select
                  name="tee_key"
                  defaultValue="yellow"
                  style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
                >
                  <option value="yellow">Yellow tee</option>
                  <option value="red">Red tee</option>
                </select>

                <input
                  name="exact_handicap"
                  type="text"
                  placeholder="HCP (valfritt)"
                  style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
                />
              </div>

              <button type="submit" className="button">
                Lagg till gastspelare
              </button>
            </form>
          </div>
        </div>

        {inactivePlayers.length > 0 ? (
          <div className="card" style={{ padding: 20, display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Tidigare spelare ({inactivePlayers.length})</h2>
            {inactivePlayers.map((player) => (
              <div key={player.id} className="muted" style={{ fontSize: 14 }}>
                {player.display_name} · spelade hal {player.active_from_hole ?? startHole} till{' '}
                {player.active_to_hole ?? endHole}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  )
}
