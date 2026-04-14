import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/app/login/actions'
import { sendFriendRequestEmail } from '@/lib/email'
import type { Profile } from '@/lib/types'
import PushNotificationToggle from '@/components/push-notification-toggle'

type SearchParams = Promise<{
  message?: string
  type?: 'success' | 'warning' | 'error'
}>

type FriendRow = {
  id: string
  user_id: string
  friend_email: string
}

type FriendRequestRow = {
  id: string
  requester_id: string
  requester_email: string
  recipient_email: string
  token: string
  status: 'pending' | 'accepted' | 'declined'
  created_at?: string | null
  responded_at?: string | null
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const currentUserEmail = (user.email ?? '').trim().toLowerCase()

  const [
    { data: profile },
    { data: friendsRaw },
    { data: outgoingRequestsRaw },
    { data: incomingRequestsRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('friends')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('friend_requests')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('friend_requests')
      .select('*')
      .eq('recipient_email', currentUserEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  const currentProfile = profile as Profile | null
  const friends = (friendsRaw as FriendRow[] | null) ?? []
  const outgoingRequests = (outgoingRequestsRaw as FriendRequestRow[] | null) ?? []
  const incomingRequests = (incomingRequestsRaw as FriendRequestRow[] | null) ?? []

  const messageType = params.type || 'success'

  async function addFriend(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const email = String(formData.get('email') || '').trim().toLowerCase()
    const ownEmail = (user.email ?? '').trim().toLowerCase()

    if (!email) {
      redirect('/profile?message=Du måste ange en e-postadress&type=error')
    }

    if (!ownEmail) {
      redirect('/profile?message=Kunde inte läsa din e-postadress&type=error')
    }

    if (email === ownEmail) {
      redirect('/profile?message=Du kan inte lägga till dig själv&type=error')
    }

    const { data: existingFriend } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', user.id)
      .eq('friend_email', email)
      .maybeSingle()

    if (existingFriend) {
      redirect('/profile?message=Ni är redan vänner&type=warning')
    }

    const { data: existingPendingOutgoing } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('requester_id', user.id)
      .eq('recipient_email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPendingOutgoing) {
      redirect('/profile?message=Vänförfrågan är redan skickad&type=warning')
    }

    const { data: existingPendingIncoming } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('requester_email', email)
      .eq('recipient_email', ownEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPendingIncoming) {
      redirect(
        '/profile?message=Du har redan en inkommande vänförfrågan från den här användaren&type=warning'
      )
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: request, error } = await supabase
      .from('friend_requests')
      .insert({
        requester_id: user.id,
        requester_email: ownEmail,
        recipient_email: email,
      })
      .select()
      .single()

    if (error || !request) {
      console.error('addFriend request insert failed:', error)
      redirect('/profile?message=Kunde inte skapa vänförfrågan&type=error')
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!appUrl) {
      redirect('/profile?message=NEXT_PUBLIC_SITE_URL saknas&type=error')
    }

    const acceptUrl = `${appUrl}/friends/accept?token=${request.token}`
    const requesterName =
      senderProfile?.display_name?.trim() || ownEmail || 'En användare'

    try {
      await sendFriendRequestEmail({
        to: email,
        requesterName,
        acceptUrl,
      })
    } catch (error) {
      console.error(error)
      redirect('/profile?message=Mejl kunde inte skickas&type=warning')
    }

    revalidatePath('/profile')
    redirect('/profile?message=Vänförfrågan skickad&type=success')
  }

  const flashStyles =
    messageType === 'success'
      ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }
      : messageType === 'warning'
      ? { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
      : { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }

  return (
    <main>
      <div className="profile-shell">
        <div className="profile-grid">
          <div className="profile-section-card" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <h2 className="section-title">Profiluppgifter</h2>
                <p className="muted">
                  Uppdatera dina standardinställningar för namn, handicap och tee.
                </p>
              </div>

              <form className="profile-form-grid" action={updateProfile}>
                <input
                  name="displayName"
                  defaultValue={currentProfile?.display_name ?? ''}
                />
                <input
                  name="handicapIndex"
                  defaultValue={currentProfile?.handicap_index ?? ''}
                />
                <button type="submit">Spara</button>
              </form>

              {/* 🔥 SNYGG WRAPPER */}
              <div className="sub-card">
                <div style={{ display: 'grid', gap: 6 }}>
                  <h3 className="sub-card-title">Notiser</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    Få pushnotiser när dina vänner registrerar aktivitet.
                  </p>
                </div>

                <div style={{ marginTop: 6 }}>
                  <PushNotificationToggle
                    initialEnabled={
                      currentProfile?.push_friend_activity_enabled ?? true
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}