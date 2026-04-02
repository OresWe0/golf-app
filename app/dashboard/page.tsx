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
      ? supabase
          .from('profiles')
          .select('id')
          .eq('is_approved', false)
      : Promise.resolve({ data: [] }),
  ])

  const membershipByRoundId = new Map(
    (memberships ?? []).map((member) => [member.round_id, member.role])
  )

  const displayName =
    (profile as Profile | null)?.display_name ?? user.email ?? 'Golfspelare'

  const pendingCount = pendingUsers?.length ?? 0

  return (
    <main>
      <div className="container">
        <div className="nav">
          <div>
            <span className="badge">👋 Inloggad som {displayName}</span>
            <h1>Dashboard</h1>
            <p className="muted">
              Starta en ny runda eller fortsätt en delad runda med dina golfvänner.
              Ditt sparade HCP används som standard.
            </p>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
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
            }}
          >
            <div className="header-line">
              <div>
                <h2 style={{ marginBottom: 6 }}>⏳ Väntande användare</h2>
                <p className="muted" style={{ marginBottom: 0 }}>
                  Du har {pendingCount} användare som väntar på godkännande.
                </p>
              </div>

              <Link href="/admin/users" className="button">
                Öppna admin
              </Link>
            </div>
          </div>
        ) : null}

        <div className="grid grid-3">
          <div className="kpi">
            <strong>{(courses as Course[] | null)?.length ?? 0}</strong>
            <div className="muted">Banor i systemet</div>
          </div>

          <div className="kpi">
            <strong>
              {(rounds as Round[] | null)?.filter((r) => r.status === 'active').length ?? 0}
            </strong>
            <div className="muted">Aktiva rundor du ser</div>
          </div>

          <div className="kpi">
            <strong>
              {(rounds as Round[] | null)?.filter(
                (r) => membershipByRoundId.get(r.id) === 'player'
              ).length ?? 0}
            </strong>
            <div className="muted">Delade rundor</div>
          </div>
        </div>

        <div className="card header-line">
          <div>
            <h2>Ny runda</h2>
            <p className="muted">Välj bana, spelare och scoring mode.</p>
          </div>
          <Link href="/rounds/new" className="button">
            Starta ny runda
          </Link>
        </div>

        <div className="card">
          <h2>Mina och delade rundor</h2>
          {!rounds || rounds.length === 0 ? (
            <p className="muted">
              Inga rundor ännu. Starta en ny för att komma igång.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Roll</th>
                  <th>Status</th>
                  <th>Scoring</th>
                  <th>Aktuellt hål</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(rounds as Round[]).map((round) => (
                  <tr key={round.id}>
                    <td>{round.title}</td>
                    <td>
                      {membershipByRoundId.get(round.id) === 'owner'
                        ? 'Ägare'
                        : 'Spelare'}
                    </td>
                    <td>{round.status === 'active' ? 'Pågår' : 'Klar'}</td>
                    <td>
                      {round.scoring_mode === 'stableford'
                        ? 'Stableford'
                        : 'Slagspel'}
                    </td>
                    <td>{round.current_hole}</td>
                    <td>
                      <Link
                        className="button secondary"
                        href={
                          round.status === 'active'
                            ? `/rounds/${round.id}?hole=${round.current_hole}`
                            : `/rounds/${round.id}/summary`
                        }
                      >
                        {round.status === 'active'
                          ? 'Öppna runda'
                          : 'Visa summary'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  )
}