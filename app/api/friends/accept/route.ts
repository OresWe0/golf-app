import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type FriendRequestRow = {
  id: string
  requester_email: string
  recipient_email: string
  status: 'pending' | 'accepted' | 'declined'
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = String(searchParams.get('token') || '').trim()

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard', request.url), 303)
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url), 303)
  }

  const currentUserEmail = (user.email ?? '').trim().toLowerCase()

  if (!currentUserEmail) {
    return NextResponse.redirect(
      new URL('/profile?message=Kunde inte läsa din e-postadress', request.url),
      303
    )
  }

  const { data: requestRow, error: fetchError } = await supabase
    .from('friend_requests')
    .select('id, requester_email, recipient_email, status')
    .eq('token', token)
    .maybeSingle()

  if (fetchError) {
    console.error('API accept fetch failed:', fetchError)
    return NextResponse.redirect(
      new URL(
        `/friends/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          'Kunde inte läsa vänförfrågan'
        )}`,
        request.url
      ),
      303
    )
  }

  const friendRequest = requestRow as FriendRequestRow | null

  if (!friendRequest) {
    return NextResponse.redirect(
      new URL(
        `/friends/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          'Vänförfrågan hittades inte'
        )}`,
        request.url
      ),
      303
    )
  }

  if (friendRequest.recipient_email.trim().toLowerCase() !== currentUserEmail) {
    return NextResponse.redirect(
      new URL(
        `/friends/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          'Den här förfrågan tillhör en annan användare'
        )}`,
        request.url
      ),
      303
    )
  }

  const requesterEmail = friendRequest.requester_email.trim().toLowerCase()

  if (friendRequest.status === 'accepted') {
    return NextResponse.redirect(
      new URL(
        `/friends/accepted?email=${encodeURIComponent(requesterEmail)}`,
        request.url
      ),
      303
    )
  }

  if (friendRequest.status !== 'pending') {
    return NextResponse.redirect(
      new URL(
        `/friends/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          'Vänförfrågan är redan hanterad'
        )}`,
        request.url
      ),
      303
    )
  }

  const { error: rpcError } = await supabase.rpc('accept_friend_request', {
    request_id_input: friendRequest.id,
  })

  if (rpcError) {
    console.error('API accept rpc failed:', rpcError)
    return NextResponse.redirect(
      new URL(
        `/friends/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          'Kunde inte acceptera vänförfrågan'
        )}`,
        request.url
      ),
      303
    )
  }

  return NextResponse.redirect(
    new URL(
      `/friends/accepted?email=${encodeURIComponent(requesterEmail)}`,
      request.url
    ),
    303
  )
}