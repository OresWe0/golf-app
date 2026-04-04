import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewRoundForm } from '@/components/new-round-form'
import type { Course, Profile } from '@/lib/types'

type FriendRow = {
  id: string
  friend_email: string
  friend_name: string | null
}

export default async function NewRoundPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: courses }, { data: profile }, { data: friends }] = await Promise.all([
    supabase.from('courses').select('*').order('name'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('friends')
      .select('id, friend_email, friend_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  return (
    <main>
      <div className="container">
        <div className="card">
          <span className="badge">📝 Ny runda</span>
          <h1>Starta ny runda</h1>
          <p className="muted">
            När du sparar skickas ni direkt till hål 1. HCP och tee hämtas från
            spelarnas profiler men kan justeras per runda.
          </p>

          <NewRoundForm
            courses={(courses as Course[] | null) ?? []}
            friends={(friends as FriendRow[] | null) ?? []}
            currentUser={{
              email: user.email ?? '',
              displayName:
                (profile as Profile | null)?.display_name ??
                user.email?.split('@')[0] ??
                'Jag',
              handicapIndex: (profile as Profile | null)?.handicap_index ?? null,
              defaultTee: (profile as Profile | null)?.default_tee ?? 'yellow',
            }}
          />
        </div>
      </div>
    </main>
  )
}