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
  const completedRoundsCount = allRounds.filter((r) => r.status !== 'active').length
  const sharedRoundsCount = allRounds.filter(
    (r) => membershipByRoundId.get(r.id) === 'player'
  ).length

  const activeRounds = allRounds.filter((r) => r.status === 'active')
  const completedRounds = allRounds.filter((r) => r.status !== 'active')

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
        <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
          <div
            className="card"
            style={{
              background: 'linear-gradient(180deg, #f8fbf7 0%, #ffffff 100%)',
              border: '1px solid #dbeedc',
            }}
          >
            <div style={{ display: 'grid', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span className="badge">👋 Inloggad som {displayName}</span>
                  <h1 style={{ marginTop: 12, marginBottom: 10 }}>Dashboard</h1>
                  <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                    Starta en ny runda eller fortsätt en aktiv runda med dina golfvänner.
                    Ditt sparade HCP används som standard.
                  </p>
                </div>

                {isAdmin && pendingCount > 0 ? (
                  <div
                    style={{
                      padding: '7px 12px',
                      borderRadius: 999,
                      background: '#fef3c7',
                      color: '#92400e',
                      fontSize: 13,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pendingCount} väntar på godkännande
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <Link
                  href="/rounds/new"
                  className="button"
                  style={{
                    width: '100%',
                    minHeight: 56,
                    fontSize: 18,
                    fontWeight: 900,
                  }}
                >
                  ⛳ Starta ny runda
                </Link>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isAdmin ? '1fr 1fr auto' : '1fr auto',
                    gap: 10,
                    alignItems: 'stretch',
                  }}
                >
                  {isAdmin ? (
                    <Link
                      href="/admin/users"
                      className="button secondary"
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    >
                      Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
                    </Link>
                  ) : null}

                  <Link
                    href="/profile"
                    className="button secondary"
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    Min profil
                  </Link>

                  <form action={signOut}>
                    <button
                      type="submit"
                      className="secondary"
                      style={{
                        width: '100%',
                        minWidth: 120,
                      }}
                    >
                      Logga ut
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {isAdmin && pendingCount > 0 ? (
            <div
              style={{
                border: '1px solid #fde68a',
                background: '#fffbeb',
                borderRadius: 18,
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 900, marginBottom: 4 }}>
                  ⏳ Väntande användare
                </div>
                <div className="muted">
                  {pendingCount} användare väntar på att bli godkända.
                </div>
              </div>

              <Link href="/admin/users" className="button secondary">
                Öppna admin
              </Link>
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 12,
            }}
          >
            <div className="card" style={{ padding: 16 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Banor
              </div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{allCourses.length}</div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Aktiva rundor
              </div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{activeRoundsCount}</div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Delade rundor
              </div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{sharedRoundsCount}</div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
                Avslutade
              </div>
              <div style={{ fontSize: 30, fontWeight: 900 }}>{completedRoundsCount}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
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
                <h2 style={{ margin: 0 }}>Aktiva rundor</h2>
                <p className="muted" style={{ margin: '6px 0 0 0' }}>
                  Rundor som pågår just nu.
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
                {activeRounds.length} st
              </div>
            </div>

            {activeRounds.length === 0 ? (
              <div
                style={{
                  border: '1px dashed #d1d5db',
                  borderRadius: 16,
                  padding: 18,
                  background: '#f9fafb',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  Inga aktiva rundor ännu
                </div>
                <div className="muted">Starta en ny runda för att komma igång.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {activeRounds.map((round) => {
                  const role =
                    membershipByRoundId.get(round.id) === 'owner' ? 'Ägare' : 'Spelare'

                  const scoring =
                    round.scoring_mode === 'stableford' ? 'Stableford' : 'Slagspel'

                  const href = `/rounds/${round.id}?hole=${round.current_hole}`

                  return (
                    <div
                      key={round.id}
                      style={{
                        border: '1px solid #dbeedc',
                        borderRadius: 18,
                        background: '#f8fbf7',
                        padding: 16,
                        display: 'grid',
                        gap: 12,
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
                              marginBottom: 6,
                              wordBreak: 'break-word',
                            }}
                          >
                            {round.title}
                          </div>

                          <div className="muted" style={{ lineHeight: 1.45 }}>
                            {scoring} · Aktuellt hål {round.current_hole} · {role}
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
                          Pågår
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 14,
                            padding: 12,
                          }}
                        >
                          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                            Roll
                          </div>
                          <div style={{ fontWeight: 900 }}>{role}</div>
                        </div>

                        <div
                          style={{
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 14,
                            padding: 12,
                          }}
                        >
                          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                            Mode
                          </div>
                          <div style={{ fontWeight: 900 }}>{scoring}</div>
                        </div>

                        <div
                          style={{
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 14,
                            padding: 12,
                          }}
                        >
                          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                            Hål
                          </div>
                          <div style={{ fontWeight: 900 }}>{round.current_hole}</div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Link
                          className="button secondary"
                          href={href}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            boxSizing: 'border-box',
                          }}
                        >
                          Fortsätt runda
                        </Link>

                        <Link
                          className="button secondary"
                          href={`/rounds/${round.id}/summary`}
                          style={{
                            flex: 1,
                            textAlign: 'center',
                            boxSizing: 'border-box',
                          }}
                        >
                          Leaderboard
                        </Link>
                      </div>
                    </div>
                  )
                })}
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
                <h2 style={{ margin: 0 }}>Avslutade rundor</h2>
                <p className="muted" style={{ margin: '6px 0 0 0' }}>
                  Tidigare spelade rundor och sammanfattningar.
                </p>
              </div>

              <div
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: '#f3f4f6',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {completedRounds.length} st
              </div>
            </div>

            {completedRounds.length === 0 ? (
              <div
                style={{
                  border: '1px dashed #d1d5db',
                  borderRadius: 16,
                  padding: 18,
                  background: '#f9fafb',
                }}
              >
                <div style={{ fontWeight: 800, marginBottom: 4 }}>
                  Inga avslutade rundor ännu
                </div>
                <div className="muted">
                  När du avslutar en runda visas den här.
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {completedRounds.map((round) => {
                  const role =
                    membershipByRoundId.get(round.id) === 'owner' ? 'Ägare' : 'Spelare'

                  const scoring =
                    round.scoring_mode === 'stableford' ? 'Stableford' : 'Slagspel'

                  return (
                    <div
                      key={round.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 16,
                        background: '#fff',
                        padding: 14,
                        display: 'grid',
                        gap: 12,
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
                              fontSize: 18,
                              fontWeight: 900,
                              lineHeight: 1.1,
                              wordBreak: 'break-word',
                            }}
                          >
                            {round.title}
                          </div>

                          <div className="muted" style={{ marginTop: 4, lineHeight: 1.45 }}>
                            {scoring} · {role}
                          </div>
                        </div>

                        <div
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            background: '#f3f4f6',
                            color: '#334155',
                            fontSize: 12,
                            fontWeight: 900,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Klar
                        </div>
                      </div>

                      <Link
                        className="button secondary"
                        href={`/rounds/${round.id}/summary`}
                        style={{
                          width: '100%',
                          textAlign: 'center',
                          boxSizing: 'border-box',
                        }}
                      >
                        Visa summary
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}