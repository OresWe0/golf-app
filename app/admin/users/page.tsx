import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: me } = await supabase
    .from('profiles')
    .select('id, is_admin, is_approved, email, display_name')
    .eq('id', user.id)
    .single()

  if (!me?.is_admin) {
    redirect('/dashboard')
  }

  const { data: pendingUsers, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, is_approved, is_admin')
    .eq('is_approved', false)
    .order('created_at', { ascending: true })

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 80 }}>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="badge">Admin</div>
        <h1 style={{ marginTop: 12 }}>Godkänn användare</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Här kan du godkänna nya användare som registrerat sig.
        </p>

        {message ? (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 14,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              color: '#0f172a',
              fontWeight: 600,
            }}
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 14,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontWeight: 600,
            }}
          >
            Kunde inte läsa användare: {error.message}
          </div>
        ) : null}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>
          Väntande användare ({pendingUsers?.length ?? 0})
        </h2>

        {!pendingUsers || pendingUsers.length === 0 ? (
          <div className="muted">Inga användare väntar på godkännande 🎉</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {pendingUsers.map((profile) => (
              <div
                key={profile.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 16,
                  padding: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {profile.display_name || 'Ingen namnuppgift'}
                  </div>
                  <div className="muted" style={{ marginTop: 4 }}>
                    {profile.email}
                  </div>
                </div>

                <form action="/api/admin/approve-user" method="POST">
                  <input type="hidden" name="userId" value={profile.id} />
                  <button
                    type="submit"
                    style={{
                      minHeight: 46,
                      padding: '10px 16px',
                      borderRadius: 14,
                      border: '1px solid #166534',
                      background: '#166534',
                      color: '#fff',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Godkänn
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}