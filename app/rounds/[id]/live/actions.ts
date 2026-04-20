'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

type OwnerProfileRow = {
  email: string | null
}

type RoundRow = {
  id: string
  owner_id: string
}

export async function sendRoundCheer(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const roundId = String(formData.get('round_id') ?? '').trim()
  const rawMessage = String(formData.get('message') ?? '').trim()
  const message = rawMessage.slice(0, 140)

  if (!roundId) {
    redirect('/dashboard')
  }

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

  const { data: roundFromUserClient } = await supabase
    .from('rounds')
    .select('id, owner_id')
    .eq('id', roundId)
    .maybeSingle()

  let roundRaw = roundFromUserClient

  if (!roundRaw && supabaseAdmin) {
    const { data: roundFromAdminClient } = await supabaseAdmin
      .from('rounds')
      .select('id, owner_id')
      .eq('id', roundId)
      .maybeSingle()

    roundRaw = roundFromAdminClient
  }

  if (!roundRaw) {
    redirect('/dashboard')
  }

  const round = roundRaw as RoundRow
  const viewerIsOwner = round.owner_id === user.id
  const viewerEmail = String(user.email ?? '').trim().toLowerCase()

  const [{ data: membership }, { data: ownerProfileRaw }] = await Promise.all([
    supabase
      .from('round_members')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', user.id)
      .maybeSingle(),
    (supabaseAdmin ?? supabase)
      .from('profiles')
      .select('email')
      .eq('id', round.owner_id)
      .maybeSingle(),
  ])

  const ownerProfile = (ownerProfileRaw as OwnerProfileRow | null) ?? null
  const ownerEmail = String(ownerProfile?.email ?? '')
    .trim()
    .toLowerCase()

  let isFriendOfOwner = false

  if (!viewerIsOwner && !membership && viewerEmail) {
    const friendReadClient = supabaseAdmin ?? supabase

    const { data: directFriend } = await friendReadClient
      .from('friends')
      .select('id')
      .eq('user_id', round.owner_id)
      .eq('friend_email', viewerEmail)
      .maybeSingle()

    if (directFriend) {
      isFriendOfOwner = true
    } else if (ownerEmail) {
      const { data: reverseFriend } = await friendReadClient
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_email', ownerEmail)
        .maybeSingle()

      isFriendOfOwner = Boolean(reverseFriend)
    }
  }

  if (!viewerIsOwner && !membership && !isFriendOfOwner) {
    redirect(`/rounds/${roundId}/live?message=Du+saknar+behorighet&type=error`)
  }

  const dataReadClient =
    !viewerIsOwner && !membership && isFriendOfOwner && supabaseAdmin
      ? supabaseAdmin
      : supabase

  const { data: roundMembers } = await dataReadClient
    .from('round_members')
    .select('user_id')
    .eq('round_id', roundId)

  const cheerText = message || 'Heja! Ni spelar grymt.'
  const cheerToken = crypto.randomUUID()
  const cheerTitle = `HejaropRound:${roundId}:${cheerToken}:${cheerText}`

  const recipientIds = Array.from(
    new Set(
      (roundMembers ?? [])
        .map((row) => String((row as { user_id?: string | null }).user_id ?? '').trim())
        .filter((id) => id.length > 0 && id !== user.id)
    )
  )

  if (recipientIds.length > 0) {
    const rows = recipientIds.map((recipientId) => ({
      user_id: recipientId,
      actor_user_id: user.id,
      type: 'comment',
      title: cheerTitle,
      feed_event_id: null,
    }))

    const { error: notificationInsertError } = await supabase
      .from('notifications')
      .insert(rows)

    if (notificationInsertError) {
      redirect(
        `/rounds/${roundId}/live?message=Kunde+inte+skicka+hejarop&type=error`
      )
    }
  }

  revalidatePath('/dashboard')
  revalidatePath(`/rounds/${roundId}/live`)

  redirect(`/rounds/${roundId}/live?message=Hejarop+skickat!&type=success`)
}
