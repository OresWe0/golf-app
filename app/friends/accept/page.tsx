import Link from 'next/link'
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
            <p className="muted">Den här länken har redan använts tidigare.</p>
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

  const { data: existingFriend } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', user.id)
    .eq('friend_email', requesterEmail)
    .maybeSingle()

  if (!existingFriend) {
    const { error: insertError } = await supabase.from('friends').insert({
      user_id: user.id,
      friend_email: requesterEmail,
    })

    if (insertError) {
      console.error('AcceptPage friend insert failed:', insertError)

      return (
        <main style={{ padding: 24 }}>
          <div className="container" style={{ maxWidth: 680 }}>
            <div className="card">
              <h1>Kunde inte skapa vänrelationen</h1>
              <p className="muted">
                Något gick fel när vänförfrågan skulle accepteras.
              </p>
              <Link href="/profile" className="button secondary">
                Till profil
              </Link>
            </div>
          </div>
        </main>
      )
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
    console.error('AcceptPage request update failed:', updateError)

    return (
      <main style={{ padding: 24 }}>
        <div className="container" style={{ maxWidth: 680 }}>
          <div className="card">
            <h1>Vän tillagd, men förfrågan kunde inte uppdateras</h1>
            <p className="muted">
              Själva vänskapen verkar ha skapats, men statusen på förfrågan kunde inte uppdateras.
            </p>
            <Link href="/profile" className="button secondary">
              Till profil
            </Link>
          </div>
        </div>
      </main>
    )
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
            border: '1px solid #bbf7d0',
            background: 'linear-gradient(180deg, #f0fdf4 0%, #ecfdf3 100%)',
          }}
        >
          <span className="badge">🎉 Klar</span>
          <h1 style={{ margin: 0 }}>Vän tillagd</h1>
          <p className="muted" style={{ margin: 0 }}>
            Du är nu vän med <strong>{requesterEmail}</strong>.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/profile" className="button">
              Till profil
            </Link>
            <Link href="/dashboard" className="button secondary">
              Till dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}