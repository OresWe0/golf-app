import Link from 'next/link'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/app/login/actions'
import { sendFriendRequestEmail } from '@/lib/email'
import type { Profile } from '@/lib/types'
import PushNotificationToggle from '@/components/push-notification-toggle'

type SearchParams = Promise<{
  message?: string
  type?: 'success' | 'warning' | 'error'
}>

type FriendRow = {
  id: string
  user_id: string
  friend_email: string
}

type FriendRequestRow = {
  id: string
  requester_id: string
  requester_email: string
  recipient_email: string
  token: string
  status: 'pending' | 'accepted' | 'declined'
  created_at?: string | null
  responded_at?: string | null
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const currentUserEmail = (user.email ?? '').trim().toLowerCase()

  const [
    { data: profile },
    { data: friendsRaw },
    { data: outgoingRequestsRaw },
    { data: incomingRequestsRaw },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('friends')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('friend_requests')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('friend_requests')
      .select('*')
      .eq('recipient_email', currentUserEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ])

  const currentProfile = profile as Profile | null
  const friends = (friendsRaw as FriendRow[] | null) ?? []
  const outgoingRequests = (outgoingRequestsRaw as FriendRequestRow[] | null) ?? []
  const incomingRequests = (incomingRequestsRaw as FriendRequestRow[] | null) ?? []

  const messageType = params.type || 'success'

  async function addFriend(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const email = String(formData.get('email') || '').trim().toLowerCase()
    const ownEmail = (user.email ?? '').trim().toLowerCase()

    if (!email) {
      redirect('/profile?message=Du måste ange en e-postadress&type=error')
    }

    if (!ownEmail) {
      redirect('/profile?message=Kunde inte läsa din e-postadress&type=error')
    }

    if (email === ownEmail) {
      redirect('/profile?message=Du kan inte lägga till dig själv&type=error')
    }

    const { data: existingFriend } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', user.id)
      .eq('friend_email', email)
      .maybeSingle()

    if (existingFriend) {
      redirect('/profile?message=Ni är redan vänner&type=warning')
    }

    const { data: existingPendingOutgoing } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('requester_id', user.id)
      .eq('recipient_email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPendingOutgoing) {
      redirect('/profile?message=Vänförfrågan är redan skickad&type=warning')
    }

    const { data: existingPendingIncoming } = await supabase
      .from('friend_requests')
      .select('id')
      .eq('requester_email', email)
      .eq('recipient_email', ownEmail)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPendingIncoming) {
      redirect(
        '/profile?message=Du har redan en inkommande vänförfrågan från den här användaren&type=warning'
      )
    }

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()

    const { data: request, error } = await supabase
      .from('friend_requests')
      .insert({
        requester_id: user.id,
        requester_email: ownEmail,
        recipient_email: email,
      })
      .select()
      .single()

    if (error || !request) {
      console.error('addFriend request insert failed:', error)
      redirect('/profile?message=Kunde inte skapa vänförfrågan&type=error')
    }

    const appUrl = process.env.NEXT_PUBLIC_SITE_URL

    if (!appUrl) {
      redirect('/profile?message=NEXT_PUBLIC_SITE_URL saknas i .env.local&type=error')
    }

    const acceptUrl = `${appUrl}/friends/accept?token=${request.token}`
    const requesterName =
      senderProfile?.display_name?.trim() || ownEmail || 'En användare'

    try {
      await sendFriendRequestEmail({
        to: email,
        requesterName,
        acceptUrl,
      })
    } catch (error) {
      console.error('Friend request email failed:', error)

      revalidatePath('/profile')
      revalidatePath('/dashboard')

      redirect('/profile?message=Förfrågan skapades, men mejlet kunde inte skickas&type=warning')
    }

    revalidatePath('/profile')
    revalidatePath('/dashboard')

    redirect('/profile?message=Vänförfrågan skickad&type=success')
  }

  async function cancelRequest(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const id = String(formData.get('id') || '')

    if (!id) {
      redirect('/profile?message=Kunde inte ta bort förfrågan&type=error')
    }

    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', id)
      .eq('requester_id', user.id)
      .eq('status', 'pending')

    if (error) {
      console.error('cancelRequest failed:', error)
      redirect('/profile?message=Kunde inte ta bort forfragan&type=error')
    }

    revalidatePath('/profile')
    revalidatePath('/dashboard')

    redirect('/profile?message=Vanforfragan borttagen&type=success')
  }

  async function declineRequest(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const id = String(formData.get('id') || '')
    const ownEmail = (user.email ?? '').trim().toLowerCase()

    if (!id || !ownEmail) {
      redirect('/profile?message=Kunde inte avvisa förfrågan&type=error')
    }

    const { error } = await supabase
      .from('friend_requests')
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('recipient_email', ownEmail)
      .eq('status', 'pending')

    if (error) {
      console.error('declineRequest failed:', error)
      redirect('/profile?message=Kunde inte avvisa forfragan&type=error')
    }

    revalidatePath('/profile')
    revalidatePath('/dashboard')

    redirect('/profile?message=Vanforfragan avvisad&type=success')
  }

  async function acceptRequest(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return
    }

    const id = String(formData.get('id') || '')

    if (!id) {
      return
    }

    const { error } = await supabase.rpc('accept_friend_request', {
      request_id_input: id,
    })

    if (error) {
      console.error('Profile acceptRequest rpc failed:', error)
      return
    }

    revalidatePath('/profile')
    revalidatePath('/dashboard')
  }

  async function removeFriend(formData: FormData) {
    'use server'

    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const friendEmail = String(formData.get('friend_email') || '')
      .trim()
      .toLowerCase()

    if (!friendEmail) {
      redirect('/profile?message=Kunde inte ta bort van&type=error')
    }

    const { error } = await supabase
      .from('friends')
      .delete()
      .eq('user_id', user.id)
      .eq('friend_email', friendEmail)

    if (error) {
      console.error('removeFriend failed:', error)
      redirect('/profile?message=Kunde inte ta bort van&type=error')
    }

    revalidatePath('/profile')
    revalidatePath('/dashboard')

    redirect('/profile?message=Van borttagen&type=success')
  }

  const flashStyles =
    messageType === 'success'
      ? {
          background: 'linear-gradient(180deg, #f0fdf4 0%, #ecfdf3 100%)',
          border: '1px solid #bbf7d0',
          color: '#166534',
          iconBg: '#dcfce7',
        }
      : messageType === 'warning'
      ? {
          background: 'linear-gradient(180deg, #fffbeb 0%, #fefce8 100%)',
          border: '1px solid #fde68a',
          color: '#92400e',
          iconBg: '#fef3c7',
        }
      : {
          background: 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)',
          border: '1px solid #fecaca',
          color: '#991b1b',
          iconBg: '#fee2e2',
        }

  const flashIcon =

    messageType === 'success' ? 'OK' : messageType === 'warning' ? '!' : 'X'
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

        .friend-row-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .friend-row-actions .button,
        .friend-row-actions button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .friend-add-form {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          width: 100%;
        }

        .friend-add-form .button {
          min-height: 54px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .section-stack {
          display: grid;
          gap: 18px;
        }

        .section-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.1;
          color: #20352a;
        }

        .sub-card {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #fafcfb 100%);
        }

        .sub-card-title {
          margin: 0;
          font-size: 18px;
          line-height: 1.2;
          color: #1f3327;
        }

        .empty-box {
          border: 1px dashed #d1d5db;
          border-radius: 16px;
          padding: 16px;
          background: linear-gradient(180deg, #fbfdfb 0%, #f8faf9 100%);
        }

        .btn-danger {
          background: linear-gradient(180deg, #fff5f5 0%, #fef2f2 100%);
          color: #991b1b;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 9px 12px;
          cursor: pointer;
          font-weight: 800;
          white-space: nowrap;
          min-height: 42px;
        }

        .btn-success {
          background: linear-gradient(135deg, #166534 0%, #22c55e 100%);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 9px 12px;
          cursor: pointer;
          font-weight: 800;
          white-space: nowrap;
          min-height: 42px;
          box-shadow: 0 10px 24px rgba(34, 197, 94, 0.18);
        }

        .flash-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 18px;
          font-weight: 800;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
          animation: flashFadeOut 6s ease forwards;
          transform-origin: top center;
          overflow: hidden;
        }

        .flash-banner-icon {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .flash-banner-text {
          line-height: 1.45;
          word-break: break-word;
        }

        @keyframes flashFadeOut {
          0% {
            opacity: 0;
            transform: translateY(-6px);
            max-height: 120px;
            margin-top: 0;
            margin-bottom: 0;
            padding-top: 14px;
            padding-bottom: 14px;
          }
          8% {
            opacity: 1;
            transform: translateY(0);
            max-height: 120px;
            margin-top: 0;
            margin-bottom: 0;
            padding-top: 14px;
            padding-bottom: 14px;
          }
          72% {
            opacity: 1;
            transform: translateY(0);
            max-height: 120px;
            margin-top: 0;
            margin-bottom: 0;
            padding-top: 14px;
            padding-bottom: 14px;
          }
          100% {
            opacity: 0;
            transform: translateY(-8px);
            max-height: 0;
            margin-top: -6px;
            margin-bottom: -6px;
            padding-top: 0;
            padding-bottom: 0;
            border-width: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .flash-banner {
            animation: none;
          }
        }

        @media (max-width: 860px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }

          .profile-back-link {
            width: 100%;
            min-height: 50px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
        }

        @media (max-width: 640px) {
          .profile-card {
            padding: 16px !important;
          }

          .profile-section-card {
            padding: 16px !important;
          }

          .friend-add-form {
            grid-template-columns: 1fr;
          }

          .friend-row {
            flex-direction: column;
            align-items: stretch;
          }

          .friend-row-actions {
            justify-content: stretch;
          }

          .friend-row-actions form {
            width: 100%;
          }

          .friend-row-actions button {
            width: 100%;
          }

          .flash-banner {
            align-items: flex-start;
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
                  Profil
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
                className="button secondary profile-back-link"
                style={{
                  minWidth: 150,
                  textAlign: 'center',
                  boxSizing: 'border-box',
                }}
              >
                Till dashboard
              </Link>
            </div>
          </div>

          {params.message ? (
            <div
              className="flash-banner"
              role="status"
              aria-live="polite"
              style={{
                background: flashStyles.background,
                border: flashStyles.border,
                color: flashStyles.color,
              }}
            >
              <div
                className="flash-banner-icon"
                style={{ background: flashStyles.iconBg }}
                aria-hidden="true"
              >
                {flashIcon}
              </div>
              <div className="flash-banner-text">{params.message}</div>
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
                  <h2 className="section-title">Profiluppgifter</h2>

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
<div className="sub-card">
  <h3 className="sub-card-title">Notiser</h3>

  <p className="muted" style={{ margin: '4px 0 0 0' }}>
    Få pushnotiser när dina vänner är ute på banan eller gör birdie, eagle eller hole-in-one.
  </p>

  <div style={{ marginTop: 8 }}>
    <PushNotificationToggle
      initialEnabled={
        currentProfile?.push_friend_activity_enabled ?? true
      }
    />
  </div>
</div>
              </div>
            </div>

            <div
              className="card profile-section-card"
              style={{
                padding: 20,
              }}
            >
              <div className="section-stack">
                <div>
                  <h2 className="section-title">Mina vänner</h2>

                  <p className="muted" style={{ margin: '8px 0 0 0', lineHeight: 1.55 }}>
                    Lägg till vänner, följ förfrågningar och acceptera nya kontakter
                    direkt i appen.
                  </p>
                </div>

                <div className="sub-card">
                  <h3 className="sub-card-title">Lägg till vän</h3>

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
                </div>

                <div className="sub-card">
                  <h3 className="sub-card-title">Inkommande förfrågningar</h3>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {incomingRequests.length > 0 ? (
                      incomingRequests.map((request) => (
                        <div key={request.id} className="friend-row">
                          <div
                            style={{
                              fontWeight: 700,
                              wordBreak: 'break-word',
                              color: '#1f3327',
                              lineHeight: 1.45,
                            }}
                          >
                            {request.requester_email}
                          </div>

                          <div className="friend-row-actions">
                            <form action={acceptRequest}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="btn-success">
                                Acceptera
                              </button>
                            </form>

                            <form action={declineRequest}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="btn-danger">
                                Avvisa
                              </button>
                            </form>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-box">
                        <div className="muted">Du har inga inkommande vänförfrågningar.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sub-card">
                  <h3 className="sub-card-title">Skickade förfrågningar</h3>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {outgoingRequests.length > 0 ? (
                      outgoingRequests.map((request) => (
                        <div key={request.id} className="friend-row">
                          <div
                            style={{
                              fontWeight: 700,
                              wordBreak: 'break-word',
                              color: '#1f3327',
                              lineHeight: 1.45,
                            }}
                          >
                            ⏳ {request.recipient_email}
                          </div>

                          <div className="friend-row-actions">
                            <form action={cancelRequest}>
                              <input type="hidden" name="id" value={request.id} />
                              <button type="submit" className="btn-danger">
                                Ta bort
                              </button>
                            </form>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-box">
                        <div className="muted">Du har inga väntande vänförfrågningar.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="sub-card">
                  <h3 className="sub-card-title">Vänner</h3>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {friends.length > 0 ? (
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
                            {friend.friend_email}
                          </div>

                          <div className="friend-row-actions">
                            <form action={removeFriend}>
                              <input
                                type="hidden"
                                name="friend_email"
                                value={friend.friend_email}
                              />
                              <button type="submit" className="btn-danger">
                                Ta bort
                              </button>
                            </form>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-box">
                        <div className="muted">Inga vänner tillagda ännu.</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

