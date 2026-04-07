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
    <main>
      <div className="container">
        <div className="nav">
          <div>
            <span className="badge">👤 Profil</span>
            <h1>Min profil</h1>
            <p className="muted">
              Här sparar du namn, HCP och standardtee som används när du startar
              nya rundor.
            </p>
          </div>

          <Link className="muted" href="/dashboard">
            ← Till dashboard
          </Link>
        </div>

        <div className="card stack" style={{ maxWidth: 680, marginBottom: 20 }}>
          {params.message ? (
            <div
              className="notice"
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
              }}
            >
              {params.message}
            </div>
          ) : null}

          <form className="stack" action={updateProfile}>
            <div>
              <label htmlFor="displayName">Namn</label>
              <input
                id="displayName"
                name="displayName"
                defaultValue={currentProfile?.display_name ?? ''}
                required
              />
            </div>

            <div>
              <label htmlFor="handicapIndex">HCP (t.ex. 18.4)</label>
              <input
                id="handicapIndex"
                name="handicapIndex"
                type="number"
                step="0.1"
                min="0"
                defaultValue={currentProfile?.handicap_index ?? ''}
              />
            </div>

            <div>
              <label htmlFor="defaultTee">Standardtee</label>
              <select
                id="defaultTee"
                name="defaultTee"
                defaultValue={currentProfile?.default_tee ?? 'yellow'}
              >
                <option value="yellow">Gul tee</option>
                <option value="red">Röd tee</option>
              </select>
            </div>

            <button type="submit">Spara profil</button>
          </form>
        </div>

        <div className="card stack" style={{ maxWidth: 680 }}>
          <h2 style={{ margin: 0 }}>Mina vänner</h2>

          <p className="muted" style={{ margin: 0 }}>
            Lägg till vänner för att snabbt kunna välja dem när du startar en
            runda.
          </p>

          <form
            action={addFriend}
            style={{
              display: 'grid',
              gap: 10,
              width: '100%',
            }}
          >
            <input
              name="email"
              type="email"
              placeholder="Skriv e-postadress"
              required
              style={{
                width: '100%',
                minHeight: 52,
                padding: '0 14px',
                borderRadius: 14,
                border: '1px solid #d1d5db',
                fontSize: 16,
                boxSizing: 'border-box',
                background: '#fff',
              }}
            />

            <button
              type="submit"
              style={{
                width: '100%',
                minHeight: 52,
                fontWeight: 800,
              }}
            >
              Lägg till
            </button>
          </form>

          <div style={{ display: 'grid', gap: 10 }}>
            {friends && friends.length > 0 ? (
              friends.map((friend) => (
                <div
                  key={friend.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    background: '#fff',
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>
                    👤 {friend.friend_email}
                  </div>

                  <form action={removeFriend}>
                    <input type="hidden" name="id" value={friend.id} />
                    <button
                      type="submit"
                      style={{
                        background: '#fef2f2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                        borderRadius: 10,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Ta bort
                    </button>
                  </form>
                </div>
              ))
            ) : (
              <div className="muted">Inga vänner tillagda ännu.</div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}