import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type FriendRequestRow = {
  id: string
  requester_id: string
  requester_email: string
  recipient_email: string
  token: string
  status: 'pending' | 'accepted' | 'declined'
}

type AcceptPageProps = {
  searchParams: Promise<{
    token?: string
    error?: string
  }>
}

export default async function AcceptPage({ searchParams }: AcceptPageProps) {
  const params = await searchParams
  const token = params.token?.trim()
  const errorMessage =
    typeof params.error === 'string' && params.error.trim()
      ? params.error.trim()
      : null

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

  const { data: requestRaw, error: requestError } = await supabase
    .from('friend_requests')
    .select('id, requester_id, requester_email, recipient_email, token, status')
    .eq('token', token)
    .single()

  if (requestError) {
    console.error('AcceptPage request fetch failed:', requestError)
  }

  const request = requestRaw as FriendRequestRow | null

  if (!request) {
    return (
      <main style={{ padding: 24 }}>
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="card">
            <h1>Vänförfrågan hittades inte</h1>
            <p className="muted">Länken verkar vara ogiltig eller redan använd.</p>
            <Link href="/profile" className="button secondary">
              Till profil
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (request.status !== 'pending') {
    return (
      <main style={{ padding: 24 }}>
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="card">
            <h1>Vänförfrågan är redan hanterad</h1>
            <p className="muted">Den här förfrågan har redan accepterats eller avböjts.</p>
            <Link href="/profile" className="button secondary">
              Till profil
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (currentUserEmail !== request.recipient_email.trim().toLowerCase()) {
    return (
      <main style={{ padding: 24 }}>
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="card">
            <h1>Fel användare</h1>
            <p className="muted">Den här förfrågan tillhör en annan användare.</p>
            <Link href="/profile" className="button secondary">
              Till profil
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const requesterEmail = request.requester_email.trim().toLowerCase()

  async function acceptRequestAction() {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { error } = await supabase.rpc('accept_friend_request', {
      request_id_input: request.id,
    })

    if (error) {
      console.error('accept_friend_request rpc failed:', error)

      redirect(
        `/friends/accept?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          'Kunde inte acceptera vänförfrågan'
        )}`
      )
    }

    revalidatePath('/profile')
    revalidatePath('/dashboard')
    revalidatePath('/friends/accept')

    redirect('/profile?message=Vänförfrågan accepterad')
  }

  return (
    <main style={{ padding: 24 }}>
      <div className="container" style={{ maxWidth: 680 }}>
        <div
          className="card"
          style={{
            display: 'grid',
            gap: 14,
            borderRadius: 24,
            border: '1px solid #e5e7eb',
          }}
        >
          <span className="badge">🤝 Vänförfrågan</span>

          <h1 style={{ margin: 0 }}>Acceptera vänförfrågan</h1>

          <p className="muted" style={{ margin: 0 }}>
            <strong>{requesterEmail}</strong> vill bli vän med dig.
          </p>

          {errorMessage ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <strong>Något gick fel</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {errorMessage}
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <form action={acceptRequestAction}>
              <button type="submit" className="button">
                Acceptera
              </button>
            </form>

            <Link href="/profile" className="button secondary">
              Avbryt
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}