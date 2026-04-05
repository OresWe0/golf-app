import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'sigge@dufvander.se'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.email !== ADMIN_EMAIL) notFound()

  const { data: pendingUsers } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_approved', false)
    .order('created_at', { ascending: true })

  const { data: approvedUsers } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_approved', true)
    .order('display_name', { ascending: true })

  const pending = pendingUsers ?? []
  const approved = approvedUsers ?? []

  return (
    <main>
      <div className="container">
        <div
          style={{
            display: 'grid',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <span className="badge">🛠️ Admin</span>
            <h1 style={{ marginTop: 12, marginBottom: 10 }}>Användare</h1>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Godkänn nya användare och få överblick över vilka som redan har access.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <div
              className="card"
              style={{
                padding: 16,
                border: '1px solid #fde68a',
                background: '#fffbeb',
              }}
            >
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Väntar på godkännande
              </div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{pending.length}</div>
            </div>

            <div
              className="card"
              style={{
                padding: 16,
              }}
            >
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Godkända användare
              </div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{approved.length}</div>
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            marginBottom: 16,
            border: pending.length > 0 ? '1px solid #fde68a' : undefined,
            background: pending.length > 0 ? '#fffdf7' : undefined,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Väntande användare</h2>
              <p className="muted" style={{ margin: '6px 0 0 0' }}>
                Nya registreringar som behöver godkännas.
              </p>
            </div>

            <div
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: pending.length > 0 ? '#fef3c7' : '#f3f4f6',
                color: '#92400e',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {pending.length} st
            </div>
          </div>

          {pending.length === 0 ? (
            <div
              style={{
                border: '1px dashed #d1d5db',
                borderRadius: 16,
                padding: 18,
                background: '#f9fafb',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                Inga väntande användare 🎉
              </div>
              <div className="muted">
                Alla registrerade användare är redan hanterade.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {pending.map((profile: any) => (
                <div
                  key={profile.id}
                  style={{
                    border: '1px solid #fcd34d',
                    borderRadius: 18,
                    background: '#ffffff',
                    padding: 16,
                    display: 'grid',
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 900,
                          lineHeight: 1.1,
                          wordBreak: 'break-word',
                        }}
                      >
                        {profile.display_name || 'Saknar namn'}
                      </div>

                      <div className="muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                        {profile.email || 'Saknar e-post'}
                        <br />
                        HCP: {profile.handicap_index ?? '-'} · Standardtee:{' '}
                        {profile.default_tee === 'red' ? 'Röd' : 'Gul'}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: '#fef3c7',
                        color: '#92400e',
                        fontSize: 12,
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Väntar
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 10,
                    }}
                  >
                    <form action="/admin/approve-user" method="POST">
                      <input type="hidden" name="userId" value={profile.id} />
                      <button
                        type="submit"
                        className="button"
                        style={{
                          width: '100%',
                          minHeight: 50,
                          fontWeight: 800,
                        }}
                      >
                        Godkänn
                      </button>
                    </form>

                    <form action="/admin/deny-user" method="POST">
                      <input type="hidden" name="userId" value={profile.id} />
                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          minHeight: 50,
                          border: '1px solid #fecaca',
                          background: '#fff1f2',
                          color: '#b91c1c',
                          borderRadius: 14,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Avslå
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 14,
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Godkända användare</h2>
              <p className="muted" style={{ margin: '6px 0 0 0' }}>
                Alla användare som redan har tillgång till appen.
              </p>
            </div>

            <div
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: '#f0fdf4',
                color: '#166534',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {approved.length} st
            </div>
          </div>

          {approved.length === 0 ? (
            <div
              style={{
                border: '1px dashed #d1d5db',
                borderRadius: 16,
                padding: 18,
                background: '#f9fafb',
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                Inga godkända användare ännu
              </div>
              <div className="muted">
                När du godkänner användare visas de här.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {approved.map((profile: any) => (
                <div
                  key={profile.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: 14,
                    background: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 18,
                        lineHeight: 1.1,
                        wordBreak: 'break-word',
                      }}
                    >
                      {profile.display_name || 'Saknar namn'}
                    </div>

                    <div className="muted" style={{ marginTop: 4, lineHeight: 1.4 }}>
                      {profile.email || 'Saknar e-post'} · HCP {profile.handicap_index ?? '-'}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: '#dcfce7',
                      color: '#166534',
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Godkänd
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}