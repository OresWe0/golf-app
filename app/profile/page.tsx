import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/app/login/actions'
import type { Profile } from '@/lib/types'

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const currentProfile = profile as Profile | null

  return (
    <main>
      <div className="container">
        <div className="nav">
          <div>
            <span className="badge">👤 Profil</span>
            <h1>Min profil</h1>
            <p className="muted">Här sparar du namn, HCP och standardtee som används när du startar nya rundor.</p>
          </div>
          <Link className="button secondary" href="/dashboard">Till dashboard</Link>
        </div>

        <div className="card stack" style={{ maxWidth: 680 }}>
          {params.message ? <div className="notice">{params.message}</div> : null}
          <form className="stack" action={updateProfile}>
            <div>
              <label htmlFor="displayName">Namn</label>
              <input id="displayName" name="displayName" defaultValue={currentProfile?.display_name ?? ''} required />
            </div>
            <div>
              <label htmlFor="handicapIndex">Handicapindex</label>
              <input id="handicapIndex" name="handicapIndex" type="number" step="0.1" min="0" defaultValue={currentProfile?.handicap_index ?? ''} />
            </div>
            <div>
              <label htmlFor="defaultTee">Standardtee</label>
              <select id="defaultTee" name="defaultTee" defaultValue={currentProfile?.default_tee ?? 'yellow'}>
                <option value="yellow">Gul tee</option>
                <option value="red">Röd tee</option>
              </select>
            </div>
            <button type="submit">Spara profil</button>
          </form>
        </div>
      </div>
    </main>
  )
}
