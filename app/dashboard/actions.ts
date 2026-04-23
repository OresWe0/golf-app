'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function likeFeedEvent(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const feedEventId = formData.get('feedEventId')
  if (typeof feedEventId !== 'string' || !feedEventId) return

  await supabase.from('feed_event_likes').upsert(
    {
      feed_event_id: feedEventId,
      user_id: user.id,
    },
    { onConflict: 'feed_event_id,user_id' }
  )

  const { data: feedEvent } = await supabase
    .from('feed_events')
    .select('id, user_id')
    .eq('id', feedEventId)
    .single()

  if (feedEvent && feedEvent.user_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: feedEvent.user_id,
      actor_user_id: user.id,
      type: 'like',
      title: 'Någon gillade ditt event',
      feed_event_id: feedEvent.id,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/feed/${feedEventId}`)
}

export async function unlikeFeedEvent(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const feedEventId = formData.get('feedEventId')
  if (typeof feedEventId !== 'string' || !feedEventId) return

  await supabase
    .from('feed_event_likes')
    .delete()
    .eq('feed_event_id', feedEventId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard')
  revalidatePath(`/feed/${feedEventId}`)
}

export async function addFeedEventComment(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const feedEventId = formData.get('feedEventId')
  const body = formData.get('body')

  if (typeof feedEventId !== 'string' || !feedEventId) return
  if (typeof body !== 'string') return

  const trimmedBody = body.trim()
  if (!trimmedBody) return
  if (trimmedBody.length > 200) return

  await supabase.from('feed_event_comments').insert({
    feed_event_id: feedEventId,
    user_id: user.id,
    body: trimmedBody,
  })

  const { data: feedEvent } = await supabase
    .from('feed_events')
    .select('id, user_id')
    .eq('id', feedEventId)
    .single()

  if (feedEvent && feedEvent.user_id !== user.id) {
    await supabase.from('notifications').insert({
      user_id: feedEvent.user_id,
      actor_user_id: user.id,
      type: 'comment',
      title: `Ny kommentar: "${trimmedBody}"`,
      feed_event_id: feedEvent.id,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath(`/feed/${feedEventId}`)
}

export async function markNotificationAsRead(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const notificationId = formData.get('notificationId')
  if (typeof notificationId !== 'string' || !notificationId) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard')
}

export async function markAllNotificationsAsRead() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  revalidatePath('/dashboard')
}
