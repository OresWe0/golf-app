'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { sendPushNotification } from '@/lib/send-push'

type SavePushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
}

type UploadedAvatarFile = {
  size: number
  type: string
}

const AVATAR_BUCKET = 'avatars'
const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function isUploadedAvatarFile(value: FormDataEntryValue | null): value is File {
  return (
    !!value &&
    typeof value === 'object' &&
    'size' in value &&
    'type' in value &&
    typeof (value as UploadedAvatarFile).size === 'number' &&
    typeof (value as UploadedAvatarFile).type === 'string'
  )
}

function getAvatarFileExt(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

function getAvatarPathFromPublicUrl(url: string) {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const markerIndex = url.indexOf(marker)
  if (markerIndex < 0) return null
  return url.slice(markerIndex + marker.length)
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const fileEntry = formData.get('avatar')

  if (!isUploadedAvatarFile(fileEntry) || fileEntry.size <= 0) {
    redirect('/profile?message=Valj en bild att ladda upp&type=error')
  }

  const file = fileEntry

  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    redirect('/profile?message=Anvand JPG, PNG eller WEBP&type=error')
  }

  if (file.size > MAX_AVATAR_BYTES) {
    redirect('/profile?message=Bilden ar for stor, max 5 MB&type=error')
  }

  const ext = getAvatarFileExt(file)
  const avatarPath = `${user.id}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarPath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    })

  if (uploadError) {
    console.error('uploadAvatar storage upload failed:', uploadError)
    redirect('/profile?message=Kunde inte ladda upp bild. Kontrollera bucket avatars&type=error')
  }

  const { data: publicUrlData } = supabase.storage
    .from(AVATAR_BUCKET)
    .getPublicUrl(avatarPath)

  const avatarUrl = publicUrlData.publicUrl

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (updateError) {
    console.error('uploadAvatar profile update failed:', updateError)
    redirect('/profile?message=Kunde inte spara profilbild&type=error')
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  revalidatePath('/feed/[id]', 'page')

  redirect('/profile?message=Profilbild sparad&type=success')
}

export async function removeAvatar() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  const avatarUrl = String((profileData as { avatar_url?: string | null } | null)?.avatar_url ?? '')
  const avatarPath = avatarUrl ? getAvatarPathFromPublicUrl(avatarUrl) : null

  if (avatarPath) {
    await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath])
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id)

  if (updateError) {
    console.error('removeAvatar profile update failed:', updateError)
    redirect('/profile?message=Kunde inte ta bort profilbild&type=error')
  }

  revalidatePath('/profile')
  revalidatePath('/dashboard')
  revalidatePath('/feed/[id]', 'page')

  redirect('/profile?message=Profilbild borttagen&type=success')
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
    return { ok: false, error: 'Ingen push-subscription hittades. Aktivera pushnotiser forst.' }
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
