'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type OwnerProfileRow = {
  email: string | null
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

  const { data: round } = await supabase
    .from('rounds')
    .select('id, title, owner_id')
    .eq('id', roundId)
    .maybeSingle()

  if (!round) {
    redirect('/dashboard')
  }

  const viewerIsOwner = round.owner_id === user.id
  const viewerEmail = String(user.email ?? '').trim().toLowerCase()

  const [{ data: membership }, { data: ownerProfileRaw }] = await Promise.all([
    supabase
      .from('round_members')
      .select('id')
      .eq('round_id', roundId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
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
    const { data: directFriend } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', round.owner_id)
      .eq('friend_email', viewerEmail)
      .maybeSingle()

    if (directFriend) {
      isFriendOfOwner = true
    } else if (ownerEmail) {
      const { data: reverseFriend } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_email', ownerEmail)
        .maybeSingle()

      isFriendOfOwner = Boolean(reverseFriend)
    }
  }

  if (!viewerIsOwner && !membership && !isFriendOfOwner) {
    redirect('/dashboard')
  }

  const [{ data: actorProfile }, { data: roundMembers }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('round_members')
      .select('user_id')
      .eq('round_id', roundId),
  ])

  const actorName =
    String(actorProfile?.display_name ?? '').trim() ||
    String(actorProfile?.email ?? '').trim() ||
    'En van'

  const cheerText = message || 'Heja! Ni spelar grymt.'

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
      title: `Hejarop: "${cheerText}"`,
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
