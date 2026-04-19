'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/send-push'

type SavePushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

export async function savePushSubscription(
  input: SavePushSubscriptionInput
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not authenticated' }

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { ok: false, error: 'Missing subscription fields' }
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/profile')
  return { ok: true }
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not authenticated' }
  if (!endpoint) return { ok: false, error: 'Missing endpoint' }

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', endpoint)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/profile')
  return { ok: true }
}

export async function setPushFriendActivityEnabled(enabled: boolean) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not authenticated' }

  const { error } = await supabase
    .from('profiles')
    .update({ push_friend_activity_enabled: enabled })
    .eq('id', user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/profile')
  return { ok: true }
}

type PushSubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendTestPushNotification() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'Not authenticated' }

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  const rows = (subscriptions as PushSubscriptionRow[] | null) ?? []

  if (rows.length === 0) {
    return { ok: false, error: 'Ingen push-subscription hittades. Aktivera pushnotiser först.' }
  }

  await Promise.allSettled(
    rows.map((subscription) =>
      sendPushNotification(subscription, {
        title: 'Testnotis',
        body: 'Push fungerar i din golfapp.',
        url: '/profile',
      })
    )
  )

  return { ok: true }
}
