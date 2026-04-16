import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NewRoundForm } from '@/components/new-round-form'
import type { Course, Profile } from '@/lib/types'

type FriendRow = {
  id: string
  friend_email: string
  friend_name: string | null
  friend_handicap_index: number | null
  friend_default_tee: string | null
}

type FriendProfileRow = {
  email: string | null
  display_name: string | null
  handicap_index: number | null
  default_tee: string | null
}

export default async function NewRoundPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: courses }, { data: profile }, { data: friendsRaw }] =
    await Promise.all([
      supabase.from('courses').select('id, name').order('name'),
      supabase
        .from('profiles')
        .select('id, display_name, handicap_index, default_tee')
        .eq('id', user.id)
        .single(),
      supabase
        .from('friends')
        .select('id, friend_email, friend_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

  const friendEmails =
    friendsRaw
      ?.map((friend) => friend.friend_email?.trim().toLowerCase())
      .filter(Boolean) ?? []

  const { data: friendProfiles } =
    friendEmails.length > 0
      ? await supabase
          .from('profiles')
          .select('email, display_name, handicap_index, default_tee')
          .in('email', friendEmails)
      : { data: [] as FriendProfileRow[] }

  const normalizedFriendProfiles = (friendProfiles as FriendProfileRow[] | null) ?? []

  const friends: FriendRow[] =
    friendsRaw?.map((friend) => {
      const email = String(friend.friend_email ?? '')
        .trim()
        .toLowerCase()

      const matchedProfile =
        normalizedFriendProfiles.find(
          (profileRow) => profileRow.email?.trim().toLowerCase() === email
        ) ?? null

      return {
        id: friend.id,
        friend_email: friend.friend_email,
        friend_name: friend.friend_name ?? matchedProfile?.display_name ?? null,
        friend_handicap_index: matchedProfile?.handicap_index ?? null,
        friend_default_tee: matchedProfile?.default_tee ?? null,
      }
    }) ?? []

  const currentProfile = profile as Profile | null
  const allCourses = (courses as Course[] | null) ?? []

  const currentUser = {
    email: user.email ?? '',
    displayName:
      currentProfile?.display_name ?? user.email?.split('@')[0] ?? 'Jag',
    handicapIndex: currentProfile?.handicap_index ?? null,
    defaultTee: currentProfile?.default_tee ?? 'yellow',
  }

  return (
    <main style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .new-round-shell {
          display: grid;
          gap: 18px;
        }

        .new-round-hero {
          border-radius: 28px;
          border: 1px solid rgba(219, 238, 220, 0.95);
          background:
            linear-gradient(180deg, rgba(248,251,247,0.98) 0%, rgba(255,255,255,0.98) 100%);
          box-shadow: 0 20px 52px rgba(15, 23, 42, 0.08);
        }

        .new-round-form-card {
          border-radius: 26px;
          border: 1px solid #e5e7eb;
          background: linear-gradient(180deg, #ffffff 0%, #fbfcfb 100%);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
        }

        .new-round-top-row {
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .new-round-info-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .new-round-info-card {
          border-radius: 18px;
          border: 1px solid #dbe7dd;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbf7 100%);
          padding: 14px;
          box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
        }

        @media (max-width: 820px) {
          .new-round-info-grid {
            grid-template-columns: 1fr;
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
        <div className="new-round-shell">
          <div
            className="card new-round-hero"
            style={{
              padding: 22,
            }}
          >
            <div style={{ display: 'grid', gap: 18 }}>
              <div className="new-round-top-row">
                <div style={{ maxWidth: 780 }}>
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
                    📝 Ny runda
                  </span>

                  <h1
                    style={{
                      marginTop: 16,
                      marginBottom: 10,
                      fontSize: 'clamp(2rem, 4vw, 2.9rem)',
                      lineHeight: 1,
                      color: '#20352a',
                    }}
                  >
                    Starta ny runda
                  </h1>

                  <p
                    className="muted"
                    style={{
                      margin: 0,
                      lineHeight: 1.6,
                      fontSize: 16,
                      maxWidth: 760,
                    }}
                  >
                    När du sparar skickas ni direkt till hål 1. HCP och tee hämtas
                    från spelarnas profiler men kan justeras per runda.
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
                  ← Till startsidan
                </Link>
              </div>

              <div className="new-round-info-grid">
                <div className="new-round-info-card">
                  <div
                    className="muted"
                    style={{ fontSize: 13, marginBottom: 6, fontWeight: 700 }}
                  >
                    ⛳ Standardinställningar
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      lineHeight: 1.1,
                      color: '#1f3327',
                    }}
                  >
                    {currentUser.defaultTee === 'red' ? 'Röd tee' : 'Gul tee'}
                  </div>
                  <div className="muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                    HCP {currentUser.handicapIndex ?? '-'}
                  </div>
                </div>

                <div className="new-round-info-card">
                  <div
                    className="muted"
                    style={{ fontSize: 13, marginBottom: 6, fontWeight: 700 }}
                  >
                    👥 Spelare & banor
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      lineHeight: 1.1,
                      color: '#1f3327',
                    }}
                  >
                    {friends.length} vänner
                  </div>
                  <div className="muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                    {allCourses.length} banor att välja mellan
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="card new-round-form-card"
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
                  Ny runda
                </h2>

                <p className="muted" style={{ margin: '8px 0 0 0', lineHeight: 1.55 }}>
                  Välj bana, lägg till spelare och justera HCP eller tee vid behov
                  innan ni startar.
                </p>
              </div>

              <NewRoundForm
                courses={allCourses}
                friends={friends}
                currentUser={currentUser}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
