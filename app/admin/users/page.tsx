import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'sigge@dufvander.se'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.email !== ADMIN_EMAIL) {
    redirect('/dashboard')
  }

  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main>
        <div className="container">
          <div className="card">
            <h1>Admin – användare</h1>
            <p className="notice">Kunde inte läsa användare: {error.message}</p>
          </div>
        </div>
      </main>
    )
  }

  const pendingCount = users?.filter((u) => !u.is_approved).length ?? 0

  return (
    <main>
      <div className="container">
        <div className="nav">
          <div>
            <span className="badge">🛠 Admin</span>
            <h1>Användare</h1>
            <p className="muted">
              Godkänn nya användare innan de får tillgång till appen.
            </p>
          </div>
          <div className="notice">
            Väntande: {pendingCount}
          </div>
        </div>

        <div className="stack">
          {users?.map((profile) => (
            <div className="card" key={profile.id}>
              <div className="header-line">
                <div>
                  <strong>{profile.display_name || 'Ingen namn angivet'}</strong>
                  <div className="muted">{profile.email}</div>
                  <div className="muted">
                    HCP: {profile.handicap_index ?? '-'} · Standardtee:{' '}
                    {profile.default_tee === 'red' ? 'Röd' : 'Gul'}
                  </div>
                  <div className="muted">
                    Status:{' '}
                    {profile.is_approved ? '✅ Godkänd' : '⏳ Väntar på godkännande'}
                  </div>
                </div>

                <div className="row">
                  {!profile.is_approved ? (
                    <form action="/api/admin/approve-user" method="post">
                      <input type="hidden" name="userId" value={profile.id} />
                      <button type="submit">Godkänn</button>
                    </form>
                  ) : (
                    <span className="badge">Godkänd</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}