import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type FriendRequestRow = {
  id: string
  requester_id: string
  requester_email: string
  recipient_email: string
  token: string
  status: 'pending' | 'accepted' | 'declined'
}

export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const params = await searchParams
  const token = params.token?.trim()

  if (!token) {
    redirect('/dashboard')
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const currentUserEmail = (user.email ?? '').trim().toLowerCase()

  if (!currentUserEmail) {
    redirect('/profile?message=Kunde inte läsa din e-postadress')
  }

  const { data: requestRaw } = await supabase
    .from('friend_requests')
    .select('*')
    .eq('token', token)
    .single()

  const request = requestRaw as FriendRequestRow | null

  if (!request) {
    redirect('/profile?message=Vänförfrågan hittades inte')
  }

  if (request.status !== 'pending') {
    redirect('/profile?message=Vänförfrågan är redan hanterad')
  }

  if (currentUserEmail !== request.recipient_email.trim().toLowerCase()) {
    redirect('/profile?message=Den här förfrågan tillhör en annan användare')
  }

  const requesterEmail = request.requester_email.trim().toLowerCase()

  const { data: existingForward } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', request.requester_id)
    .eq('friend_email', currentUserEmail)
    .maybeSingle()

  const { data: existingReverse } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', user.id)
    .eq('friend_email', requesterEmail)
    .maybeSingle()

  const inserts: Array<{ user_id: string; friend_email: string }> = []

  if (!existingForward) {
    inserts.push({
      user_id: request.requester_id,
      friend_email: currentUserEmail,
    })
  }

  if (!existingReverse) {
    inserts.push({
      user_id: user.id,
      friend_email: requesterEmail,
    })
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from('friends').insert(inserts)

    if (insertError) {
      redirect('/profile?message=Kunde inte skapa vänrelationen')
    }
  }

  const { error: updateError } = await supabase
    .from('friend_requests')
    .update({
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .eq('status', 'pending')

  if (updateError) {
    redirect('/profile?message=Vänskap skapades men förfrågan kunde inte uppdateras')
  }

  redirect('/profile?message=Vän tillagd 🎉')
}