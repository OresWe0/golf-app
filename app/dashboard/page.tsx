import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import type { Course, Profile, Round } from '@/lib/types'

const ADMIN_EMAIL = 'sigge@dufvander.se'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const isAdmin = user.email === ADMIN_EMAIL

  const [
    { data: courses },
    { data: rounds },
    { data: profile },
    { data: memberships },
    { data: pendingUsers },
  ] = await Promise.all([
    supabase.from('courses').select('*').order('name'),
    supabase.from('rounds').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('round_members').select('round_id, role').eq('user_id', user.id),
    isAdmin
      ? supabase.from('profiles').select('id').eq('is_approved', false)
      : Promise.resolve({ data: [] }),
  ])

  const membershipByRoundId = new Map(
    (memberships ?? []).map((member) => [member.round_id, member.role])
  )

  const displayName =
    (profile as Profile | null)?.display_name ?? user.email ?? 'Golfspelare'

  const pendingCount = pendingUsers?.length ?? 0
  const allRounds = (rounds as Round[] | null) ?? []
  const allCourses = (courses as Course[] | null) ?? []

  const activeRoundsCount = allRounds.filter((r) => r.status === 'active').length
  const sharedRoundsCount = allRounds.filter(
    (r) => membershipByRoundId.get(r.id) === 'player'
  ).length

  return (
    <main style={{ width: '100%', overflowX: 'hidden' }}>
      <div
        className="container"
        style={{
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <span className="badge">👋 Inloggad som {displayName}</span>
            <h1 style={{ marginTop: 12, marginBottom: 10 }}>Dashboard</h1>
            <p className="muted" style={{ marginBottom: 0 }}>
              Starta en ny runda eller fortsätt en delad runda med dina golfvänner.
              Ditt sparade HCP används som standard.
            </p>
          </div>

          <div
            className="row"
            style={{
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            {isAdmin ? (
              <Link href="/admin/users" className="button secondary">
                Admin
                {pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Link>
            ) : null}

            <Link href="/profile" className="button secondary">
              Min profil
            </Link>

            <form action={signOut}>
              <button type="submit" className="secondary">
                Logga ut
              </button>
            </form>
          </div>
        </div>

        {isAdmin && pendingCount > 0 ? (
          <div
            className="card"
            style={{
              background: '#fff7ed',
              border: '1px solid #fed7aa',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div>
                <h2 style={{ marginBottom: 6 }}>⏳ Väntande användare</h2>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Du har {pendingCount} användare som väntar på godkännande.
                </p>
              </div>

              <div>
                <Link href="/admin/users" className="button">
                  Öppna admin
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div className="kpi">
            <strong>{allCourses.length}</strong>
            <div className="muted">Banor i systemet</div>
          </div>

          <div className="kpi">
            <strong>{activeRoundsCount}</strong>
            <div className="muted">Aktiva rundor du ser</div>
          </div>

          <div className="kpi">
            <strong>{sharedRoundsCount}</strong>
            <div className="muted">Delade rundor</div>
          </div>
        </div>

        <div
          className="card"
          style={{
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div>
              <h2 style={{ marginBottom: 6 }}>Ny runda</h2>
              <p className="muted" style={{ marginBottom: 0 }}>
                Välj bana, spelare och scoring mode.
              </p>
            </div>

            <div>
              <Link href="/rounds/new" className="button">
                Starta ny runda
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginBottom: 12 }}>Mina och delade rundor</h2>

          {!allRounds || allRounds.length === 0 ? (
            <p className="muted">
              Inga rundor ännu. Starta en ny för att komma igång.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
              {allRounds.map((round) => {
                const role =
                  membershipByRoundId.get(round.id) === 'owner' ? 'Ägare' : 'Spelare'

                const status = round.status === 'active' ? 'Pågår' : 'Klar'
                const scoring =
                  round.scoring_mode === 'stableford' ? 'Stableford' : 'Slagspel'

                const href =
                  round.status === 'active'
                    ? `/rounds/${round.id}?hole=${round.current_hole}`
                    : `/rounds/${round.id}/summary`

                const buttonText =
                  round.status === 'active' ? 'Öppna runda' : 'Visa summary'

                return (
                  <div
                    key={round.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 18,
                      padding: 14,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 800,
                          marginBottom: 8,
                          wordBreak: 'break-word',
                        }}
                      >
                        {round.title}
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Roll
                          </div>
                          <div style={{ fontWeight: 700 }}>{role}</div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Status
                          </div>
                          <div style={{ fontWeight: 700 }}>{status}</div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Scoring
                          </div>
                          <div style={{ fontWeight: 700 }}>{scoring}</div>
                        </div>

                        <div>
                          <div className="muted" style={{ fontSize: 13 }}>
                            Aktuellt hål
                          </div>
                          <div style={{ fontWeight: 700 }}>{round.current_hole}</div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Link
                        className="button secondary"
                        href={href}
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          boxSizing: 'border-box',
                        }}
                      >
                        {buttonText}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}