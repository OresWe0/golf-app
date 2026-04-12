import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type FriendRequestRow = {
  id: string
  requester_email: string
  recipient_email: string
  status: 'pending' | 'accepted' | 'declined'
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const token = String(body?.token || '').trim()

    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Token saknas' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Inte inloggad' },
        { status: 401 }
      )
    }

    const currentUserEmail = (user.email ?? '').trim().toLowerCase()

    if (!currentUserEmail) {
      return NextResponse.json(
        { ok: false, error: 'Kunde inte läsa din e-postadress' },
        { status: 400 }
      )
    }

    const { data: requestRow, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, requester_email, recipient_email, status')
      .eq('token', token)
      .maybeSingle()

    if (fetchError) {
      console.error('API accept fetch failed:', fetchError)
      return NextResponse.json(
        { ok: false, error: 'Kunde inte läsa vänförfrågan' },
        { status: 500 }
      )
    }

    const friendRequest = requestRow as FriendRequestRow | null

    if (!friendRequest) {
      return NextResponse.json(
        { ok: false, error: 'Vänförfrågan hittades inte' },
        { status: 404 }
      )
    }

    if (friendRequest.recipient_email.trim().toLowerCase() !== currentUserEmail) {
      return NextResponse.json(
        { ok: false, error: 'Den här förfrågan tillhör en annan användare' },
        { status: 403 }
      )
    }

    const requesterEmail = friendRequest.requester_email.trim().toLowerCase()

    if (friendRequest.status === 'accepted') {
      return NextResponse.json({
        ok: true,
        alreadyAccepted: true,
        redirectTo: `/friends/accepted?email=${encodeURIComponent(requesterEmail)}`,
      })
    }

    if (friendRequest.status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: 'Vänförfrågan är redan hanterad' },
        { status: 400 }
      )
    }

    const { error: rpcError } = await supabase.rpc('accept_friend_request', {
      request_id_input: friendRequest.id,
    })

    if (rpcError) {
      console.error('API accept rpc failed:', rpcError)
      return NextResponse.json(
        { ok: false, error: 'Kunde inte acceptera vänförfrågan' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      redirectTo: `/friends/accepted?email=${encodeURIComponent(requesterEmail)}`,
    })
  } catch (error) {
    console.error('API accept unexpected error:', error)

    return NextResponse.json(
      { ok: false, error: 'Något gick fel' },
      { status: 500 }
    )
  }
}