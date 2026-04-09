import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/app/login/actions'
import type { Profile } from '@/lib/types'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: friends } = await supabase
    .from('friends')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const currentProfile = profile as Profile | null

  async function addFriend(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const email = String(formData.get('email') || '').trim().toLowerCase()

    if (!email) return
    if (email === (user.email ?? '').toLowerCase()) return

    const { data: existingFriend } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', user.id)
      .eq('friend_email', email)
      .maybeSingle()

    if (existingFriend) return

    await supabase.from('friends').insert({
      user_id: user.id,
      friend_email: email,
    })

    redirect('/profile')
  }

  async function removeFriend(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const id = String(formData.get('id'))

    await supabase.from('friends').delete().eq('id', id)

    redirect('/profile')
  }

  return (
    <main style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .profile-shell {
          display: grid;
          gap: 18px;
        }

        .profile-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          gap: 18px;
          align-items: start;
        }

        .profile-card {
          border-radius: 26px;
          border: 1px solid rgba(219, 238, 220, 0.95);
          background: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,247,0.98) 100%);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.07);
        }

        .profile-section-card {
          border-radius: 24px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
          box-shadow: 0 16px 38px rgba(15, 23, 42, 0.05);
        }

        .profile-form-grid {
          display: grid;
          gap: 14px;
        }

        .friend-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #fafcfb 100%);
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.03);
        }

        .friend-add-form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          width: 100%;
        }

        @media (max-width: 860px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .friend-add-form {
            grid-template-columns: 1fr;
          }

          .friend-row {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      <div
        className="container"
        style={{
          width: '100%',
          maxWidth: '100%',
          overflowX: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <div className="profile-shell">
          <div
            className="card profile-card"
            style={{
              padding: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 14,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ maxWidth: 760 }}>
                <span
                  className="badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, #eef8ef 0%, #e7f2e8 100%)',
                    border: '1px solid #d6e5d7',
                    fontWeight: 900,
                  }}
                >
                  👤 Profil
                </span>

                <h1
                  style={{
                    marginTop: 16,
                    marginBottom: 10,
                    fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                    lineHeight: 1,
                    color: '#20352a',
                  }}
                >
                  Min profil
                </h1>

                <p
                  className="muted"
                  style={{
                    margin: 0,
                    lineHeight: 1.6,
                    fontSize: 16,
                    maxWidth: 720,
                  }}
                >
                  Här sparar du namn, HCP och standardtee som används när du startar
                  nya rundor.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="button secondary"
                style={{
                  minWidth: 150,
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                ← Till dashboard
              </Link>
            </div>
          </div>

          {params.message ? (
            <div
              className="profile-section-card"
              style={{
                padding: 14,
                background: 'linear-gradient(180deg, #f0fdf4 0%, #ecfdf3 100%)',
                border: '1px solid #bbf7d0',
                color: '#166534',
                borderRadius: 18,
                fontWeight: 800,
              }}
            >
              {params.message}
            </div>
          ) : null}

          <div className="profile-grid">
            <div
              className="card profile-section-card"
              style={{
                padding: 20,
              }}
            >
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 24,
                      lineHeight: 1.1,
                      color: '#20352a',
                    }}
                  >
                    Profiluppgifter
                  </h2>

                  <p className="muted" style={{ margin: '8px 0 0 0', lineHeight: 1.55 }}>
                    Uppdatera dina standardinställningar för namn, handicap och tee.
                  </p>
                </div>

                <form className="profile-form-grid" action={updateProfile}>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <label
                      htmlFor="displayName"
                      style={{
                        fontWeight: 800,
                        color: '#1f3327',
                      }}
                    >
                      Namn
                    </label>
                    <input
                      id="displayName"
                      name="displayName"
                      defaultValue={currentProfile?.display_name ?? ''}
                      required
                      style={{
                        width: '100%',
                        minHeight: 54,
                        padding: '0 16px',
                        borderRadius: 16,
                        border: '1px solid #d1d5db',
                        fontSize: 16,
                        boxSizing: 'border-box',
                        background: '#fff',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <label
                      htmlFor="handicapIndex"
                      style={{
                        fontWeight: 800,
                        color: '#1f3327',
                      }}
                    >
                      HCP (t.ex. 18.4)
                    </label>
                    <input
                      id="handicapIndex"
                      name="handicapIndex"
                      type="number"
                      step="0.1"
                      min="0"
                      defaultValue={currentProfile?.handicap_index ?? ''}
                      style={{
                        width: '100%',
                        minHeight: 54,
                        padding: '0 16px',
                        borderRadius: 16,
                        border: '1px solid #d1d5db',
                        fontSize: 16,
                        boxSizing: 'border-box',
                        background: '#fff',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    <label
                      htmlFor="defaultTee"
                      style={{
                        fontWeight: 800,
                        color: '#1f3327',
                      }}
                    >
                      Standardtee
                    </label>
                    <select
                      id="defaultTee"
                      name="defaultTee"
                      defaultValue={currentProfile?.default_tee ?? 'yellow'}
                      style={{
                        width: '100%',
                        minHeight: 54,
                        padding: '0 16px',
                        borderRadius: 16,
                        border: '1px solid #d1d5db',
                        fontSize: 16,
                        boxSizing: 'border-box',
                        background: '#fff',
                      }}
                    >
                      <option value="yellow">Gul tee</option>
                      <option value="red">Röd tee</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="button"
                    style={{
                      width: '100%',
                      minHeight: 56,
                      fontSize: 17,
                      fontWeight: 900,
                      borderRadius: 18,
                      background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
                      boxShadow: '0 16px 34px rgba(34, 197, 94, 0.20)',
                      marginTop: 4,
                    }}
                  >
                    Spara profil
                  </button>
                </form>
              </div>
            </div>

            <div
              className="card profile-section-card"
              style={{
                padding: 20,
              }}
            >
              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 24,
                      lineHeight: 1.1,
                      color: '#20352a',
                    }}
                  >
                    Mina vänner
                  </h2>

                  <p className="muted" style={{ margin: '8px 0 0 0', lineHeight: 1.55 }}>
                    Lägg till vänner för att snabbt kunna välja dem när du startar en
                    runda.
                  </p>
                </div>

                <form action={addFriend} className="friend-add-form">
                  <input
                    name="email"
                    type="email"
                    placeholder="Skriv e-postadress"
                    required
                    style={{
                      width: '100%',
                      minHeight: 54,
                      padding: '0 16px',
                      borderRadius: 16,
                      border: '1px solid #d1d5db',
                      fontSize: 16,
                      boxSizing: 'border-box',
                      background: '#fff',
                    }}
                  />

                  <button
                    type="submit"
                    className="button"
                    style={{
                      minHeight: 54,
                      fontWeight: 900,
                      borderRadius: 16,
                      minWidth: 140,
                      background: 'linear-gradient(135deg, #1f6f32 0%, #2f7f37 100%)',
                      boxShadow: '0 12px 28px rgba(31, 111, 50, 0.16)',
                    }}
                  >
                    Lägg till
                  </button>
                </form>

                <div style={{ display: 'grid', gap: 10 }}>
                  {friends && friends.length > 0 ? (
                    friends.map((friend) => (
                      <div key={friend.id} className="friend-row">
                        <div
                          style={{
                            fontWeight: 700,
                            wordBreak: 'break-word',
                            color: '#1f3327',
                            lineHeight: 1.45,
                          }}
                        >
                          👤 {friend.friend_email}
                        </div>

                        <form action={removeFriend}>
                          <input type="hidden" name="id" value={friend.id} />
                          <button
                            type="submit"
                            style={{
                              background: 'linear-gradient(180deg, #fff5f5 0%, #fef2f2 100%)',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                              borderRadius: 12,
                              padding: '9px 12px',
                              cursor: 'pointer',
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              minHeight: 42,
                            }}
                          >
                            Ta bort
                          </button>
                        </form>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        border: '1px dashed #d1d5db',
                        borderRadius: 16,
                        padding: 16,
                        background: 'linear-gradient(180deg, #fbfdfb 0%, #f8faf9 100%)',
                      }}
                    >
                      <div className="muted">Inga vänner tillagda ännu.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}