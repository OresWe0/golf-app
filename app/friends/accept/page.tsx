import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AcceptButton from './AcceptButton'

type AcceptPageProps = {
  searchParams: {
    token?: string
  }
}

export default async function AcceptPage({ searchParams }: AcceptPageProps) {
  const token = searchParams.token?.trim()

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

  const { data: request } = await supabase
    .from('friend_requests')
    .select('requester_email, recipient_email, status')
    .eq('token', token)
    .maybeSingle()

  if (!request) {
    return <p>Vänförfrågan hittades inte</p>
  }

  if (request.recipient_email.trim().toLowerCase() !== currentUserEmail) {
    return <p>Denna förfrågan tillhör inte dig</p>
  }

  if (request.status === 'accepted') {
    redirect(`/friends/accepted?email=${encodeURIComponent(request.requester_email)}`)
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Acceptera vänförfrågan</h1>
      <p>{request.requester_email} vill bli vän med dig</p>

      <AcceptButton token={token} />
    </main>
  )
}