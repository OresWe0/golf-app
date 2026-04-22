import {
  likeFeedEvent,
  unlikeFeedEvent,
  markNotificationAsRead,
} from './actions'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { signOut } from '@/app/login/actions'
import InstallAppPrompt from '@/components/install-app-prompt'
import type { Course, Profile, Round } from '@/lib/types'

const ADMIN_EMAIL = 'sigge@dufvander.se'
const ACTIVE_ROUNDS_PREVIEW_COUNT = 5
const COMPLETED_ROUNDS_PREVIEW_COUNT = 10

type DashboardSearchParams = {
  showActive?: string | string[]
  showCompleted?: string | string[]
}

type Membership = {
  round_id: string
  role: 'owner' | 'player'
}

type FriendRequestRow = {
  id: string
}

type HoleScore = {
  id: string
  round_player_id: string
  strokes?: number | null
}

type FriendRow = {
  friend_email: string | null
}

type ReverseFriendRow = {
  user_id: string | null
}

type FriendProfileLite = {
  id: string
  email: string | null
  display_name: string | null
}

type RoundPlayer = {
  id: string
  round_id: string
  user_id: string | null
  invited_email?: string | null
  display_name?: string | null
  handicap_index?: number | null
  exact_handicap?: number | null
  tee_key?: string | null
  playing_handicap?: number | null
  sort_order?: number | null
}

type FeedEvent = {
  id: string
  user_id: string
  round_id: string
  round_player_id: string
  event_type: 'birdie' | 'eagle' | 'hole_in_one'
  hole_number: number
  created_at: string
  player_name?: string | null
  course_name?: string | null
}

type FeedEventLikeRow = {
  id: string
  feed_event_id: string
  user_id: string
}

type FeedEventCommentRow = {
  id: string
  feed_event_id: string
  user_id: string
  body: string
  created_at: string
}

type NotificationRow = {
  id: string
  user_id: string
  actor_user_id: string | null
  type: string
  title: string
  feed_event_id: string | null
  is_read: boolean
  created_at: string
}

type RoundWithCreatedAt = Round & {
  created_at?: string | null
}

function getAvatarInitial(name?: string | null) {
  const normalized = String(name ?? '').trim()
  return normalized ? normalized.charAt(0).toUpperCase() : 'G'
}

function UserAvatar({
  profile,
  name,
  size = 32,
}: {
  profile?: Profile | null
  name?: string | null
  size?: number
}) {
  const avatarUrl = profile?.avatar_url?.trim()
  const initial = getAvatarInitial(name ?? profile?.display_name ?? profile?.email ?? '')

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        border: '1px solid #d1d5db',
        background: '#e8f2ea',
        color: '#1f3327',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        fontSize: Math.max(12, Math.round(size * 0.45)),
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        initial
      )}
    </div>
  )
}

function getSingleParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value
}

function buildDashboardHref(params: {
  showActive?: string
  showCompleted?: string
}) {
  const search = new URLSearchParams()

  if (params.showActive) {
    search.set('showActive', params.showActive)
  }

  if (params.showCompleted) {
    search.set('showCompleted', params.showCompleted)
  }

  const query = search.toString()
  return query ? `/dashboard?${query}` : '/dashboard'
}

function getRoleLabel(role?: Membership['role']) {
  if (role === 'owner') return 'Ägare'
  if (role === 'player') return 'Spelare'
  return 'Ej deltagare'
}

function getScoringLabel(scoringMode: Round['scoring_mode']) {
  return scoringMode === 'stableford' ? 'Poängbogey' : 'Slagspel'
}

function getRoundHref(round: Round) {
  return `/rounds/${round.id}?hole=${round.current_hole}`
}

function getFeedEventLabel(eventType: FeedEvent['event_type']) {
  if (eventType === 'birdie') return '🐦 Birdie'
  if (eventType === 'eagle') return '🦅 Eagle'
  return '🎯 Hole-in-one'
}

function formatFeedEventTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const sameAsYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()

  const timeText = date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (sameDay) {
    return `Idag ${timeText}`
  }

  if (sameAsYesterday) {
    return `Igår ${timeText}`
  }

  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatRoundDate(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRoundDateWithTime(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCourseNameForFeedEvent(
  event: FeedEvent,
  rounds: Round[],
  courses: Course[]
) {
  if (event.course_name?.trim()) {
    return event.course_name.trim()
  }

  const round = rounds.find((item) => item.id === event.round_id)
  if (!round) return 'Okänd bana'

  const course = courses.find((item) => item.id === round.course_id)
  return course?.name || 'Okänd bana'
}

function getPlayerNameForFeedEvent(
  event: FeedEvent,
  roundPlayers: RoundPlayer[]
) {
  if (event.player_name?.trim()) {
    return event.player_name.trim()
  }

  const roundPlayer = roundPlayers.find(
    (item) => item.id === event.round_player_id
  )

  if (roundPlayer?.display_name?.trim()) {
    return roundPlayer.display_name.trim()
  }

  const matchingUser = roundPlayers.find(
    (item) =>
      item.user_id === event.user_id &&
      typeof item.display_name === 'string' &&
      item.display_name.trim().length > 0
  )

  if (matchingUser?.display_name?.trim()) {
    return matchingUser.display_name.trim()
  }

  return 'Okänd spelare'
}

const dashboardStyles = {
  heroCard: {
    background:
      'linear-gradient(180deg, rgba(8, 20, 14, 0.42) 0%, rgba(13, 37, 26, 0.56) 46%, rgba(22, 59, 42, 0.74) 100%), url(/hero-karsta.jpg)',
    backgroundSize: 'cover',
    backgroundPosition: 'center 42%',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 28,
    boxShadow: '0 24px 56px rgba(22, 59, 42, 0.28)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    marginBottom: 24,
  },
  sectionCard: {
    borderRadius: 24,
    boxShadow: '0 16px 42px rgba(15, 23, 42, 0.06)',
    border: '1px solid #e5e7eb',
    background: '#ffffff',
  },
  pill: {
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: 'nowrap' as const,
  },
  softButton: {
    width: '100%',
    minHeight: 52,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  },
}

function getTimeGreetingSvSE(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat('sv-SE', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Europe/Stockholm',
    }).format(now)
  )

  if (hour >= 5 && hour < 10) return 'God morgon'
  if (hour >= 10 && hour < 17) return 'God dag'
  return 'God kväll'
}

function SectionEmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div
      style={{
        border: '1px dashed #cfd8d3',
        borderRadius: 18,
        padding: 18,
        background: 'linear-gradient(180deg, #fbfdfb 0%, #f8faf9 100%)',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4, color: '#1f3327' }}>
        {title}
      </div>
      <div className="muted">{description}</div>
    </div>
  )
}

function HighlightCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string
  value: string | number
  sublabel?: string
  tone: 'green' | 'blue' | 'purple' | 'slate'
}) {
  const toneMap = {
    green: {
      background: 'linear-gradient(180deg, #f6fff8 0%, #ecfdf3 100%)',
      border: '#ccefd7',
      glow: 'rgba(34, 197, 94, 0.10)',
    },
    blue: {
      background: 'linear-gradient(180deg, #f8fbff 0%, #eff6ff 100%)',
      border: '#bfdbfe',
      glow: 'rgba(59, 130, 246, 0.10)',
    },
    purple: {
      background: 'linear-gradient(180deg, #fbf7ff 0%, #f5f3ff 100%)',
      border: '#ddd6fe',
      glow: 'rgba(124, 58, 237, 0.08)',
    },
    slate: {
      background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      border: '#dbe2ea',
      glow: 'rgba(71, 85, 105, 0.08)',
    },
  } as const

  const palette = toneMap[tone]

  return (
    <div
      className="card"
      style={{
        padding: 16,
        borderRadius: 22,
        background: palette.background,
        border: `1px solid ${palette.border}`,
        boxShadow: `0 14px 30px ${palette.glow}`,
        minHeight: 116,
        display: 'grid',
        alignContent: 'space-between',
        gap: 10,
      }}
    >
      <div
        className="muted"
        style={{
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
          fontWeight: 900,
          lineHeight: 1.05,
          color: '#1f3327',
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>

      {sublabel ? (
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
          {sublabel}
        </div>
      ) : null}
    </div>
  )
}

function FriendRequestNotice({
  incomingFriendRequestsCount,
}: {
  incomingFriendRequestsCount: number
}) {
  if (incomingFriendRequestsCount <= 0) return null

  return (
    <div
      style={{
        border: '1px solid #fde68a',
        background: 'linear-gradient(180deg, #fffbeb 0%, #fefce8 100%)',
        borderRadius: 20,
        padding: 14,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 14,
        alignItems: 'center',
        flexWrap: 'wrap',
        boxShadow: '0 12px 28px rgba(245, 158, 11, 0.08)',
      }}
    >
      <div>
        <div style={{ fontWeight: 900, marginBottom: 4, color: '#1f3327' }}>
          📨 Du har en ny vänförfrågan
        </div>
        <div className="muted" style={{ color: '#7c5a12' }}>
          Du har {incomingFriendRequestsCount} inkommande vänförfrågan
          {incomingFriendRequestsCount > 1 ? 'ar' : ''} att hantera i Min profil.
        </div>
      </div>

      <Link
        href="/profile"
        className="button secondary"
        style={{
          minWidth: 170,
          textAlign: 'center',
          boxSizing: 'border-box',
          borderColor: '#eed38f',
          background: '#fffef8',
        }}
      >
        Öppna Min profil
      </Link>
    </div>
  )
}

function DashboardHeader({
  displayName,
  profile,
  greeting,
  isAdmin,
  pendingCount,
  incomingFriendRequestsCount,
}: {
  displayName: string
  profile: Profile | null
  greeting: string
  isAdmin: boolean
  pendingCount: number
  incomingFriendRequestsCount: number
}) {
  const iconButtonStyle: CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 14,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.24)',
    background: 'rgba(12, 35, 24, 0.36)',
    color: '#fff',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 8px 22px rgba(15, 23, 42, 0.2)',
    fontSize: 22,
    lineHeight: 1,
  }

  const menuItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
    width: '100%',
    minHeight: 38,
    padding: '8px 10px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.09)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 800,
    textDecoration: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div className="card" style={dashboardStyles.heroCard}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: 28,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 320,
            height: 320,
            right: -110,
            top: -130,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 72%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: 360,
            height: 360,
            left: -170,
            bottom: -210,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(187,247,208,0.26) 0%, rgba(187,247,208,0) 72%)',
          }}
        />
      </div>

      <div style={{ display: 'grid', gap: 20, position: 'relative', zIndex: 1 }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            display: 'inline-flex',
            gap: 10,
            alignItems: 'center',
            zIndex: 4,
          }}
        >
          <div style={{ position: 'relative' }}>
            <Link href="/profile" aria-label="Öppna profil" style={iconButtonStyle}>
              👤
            </Link>

            {incomingFriendRequestsCount > 0 ? (
              <span
                aria-label={`${incomingFriendRequestsCount} inkommande vänförfrågningar`}
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 20,
                  height: 20,
                  borderRadius: 999,
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                  boxShadow: '0 8px 18px rgba(220, 38, 38, 0.26)',
                  border: '2px solid #fff',
                }}
              >
                {incomingFriendRequestsCount}
              </span>
            ) : null}
          </div>

          <details style={{ position: 'relative' }}>
            <summary
              aria-label="Öppna meny"
              style={{
                ...iconButtonStyle,
                listStyle: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
              }}
            >
              ☰
            </summary>

            <div
              style={{
                position: 'absolute',
                top: 52,
                right: 0,
                minWidth: 172,
                zIndex: 6,
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.24)',
                background: 'rgba(12, 35, 24, 0.92)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 18px 36px rgba(15, 23, 42, 0.35)',
                padding: 8,
                display: 'grid',
                gap: 6,
              }}
            >
              {isAdmin ? (
                <Link href="/admin/users" style={menuItemStyle}>
                  🛠 Admin{pendingCount > 0 ? ` ${pendingCount}` : ''}
                </Link>
              ) : null}

              <Link href="/profile" style={menuItemStyle}>
                👤 Profil
              </Link>

              <Link href="/statistik" style={menuItemStyle}>
                📈 Stats
              </Link>

              <form action={signOut}>
                <button type="submit" style={menuItemStyle}>
                  ↪ Ut
                </button>
              </form>
            </div>
          </details>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            gap: 10,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <UserAvatar profile={profile} name={displayName} size={74} />
            </div>

            <h1
              style={{
                marginTop: 6,
                marginBottom: 12,
                fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
                lineHeight: 0.95,
                color: '#ffffff',
                letterSpacing: -1,
                fontWeight: 900,
              }}
            >
              {greeting},
              <br />
              <span style={{ fontWeight: 900 }}>{displayName}</span>
            </h1>

            <p
              style={{
                margin: 0,
                lineHeight: 1.6,
                fontSize: 16,
                maxWidth: 720,
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              Redo för nästa runda? Starta snabbt, fortsätt en aktiv runda eller följ dina
              golfvänner.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <Link
            href="/rounds/new"
            className="button"
            style={{
              width: '100%',
              minHeight: 56,
              fontSize: 18,
              fontWeight: 900,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
              color: '#fff',
              boxShadow: '0 20px 42px rgba(15, 47, 32, 0.32)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            ⛳ Starta ny runda
          </Link>
        </div>
      </div>
    </div>
  )
}

function NotificationsSection({
  notifications,
  actorProfiles,
}: {
  notifications: NotificationRow[]
  actorProfiles: Profile[]
}) {
  if (notifications.length === 0) return null

  return (
    <div className="card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Notiser"
        description="Det senaste som hänt i ditt flöde."
        count={notifications.length}
        countTone="slate"
      />

      <div style={{ display: 'grid', gap: 10 }}>
        {notifications.map((notification) => {
          const actorProfile =
            actorProfiles.find((profile) => profile.id === notification.actor_user_id) ?? null
          const actorName = getNotificationActorName(
            notification,
            actorProfiles
          )

          return (
            <div
              key={notification.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: 12,
                background: '#fafbfc',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ minWidth: 0, flex: 1, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <UserAvatar profile={actorProfile} name={actorName} size={34} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#1f3327' }}>
                    {getNotificationSummary(notification, actorName)}
                  </div>

                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {formatFeedEventTime(notification.created_at)}
                  </div>
                </div>
              </div>

              <form action={markNotificationAsRead}>
                <input
                  type="hidden"
                  name="notificationId"
                  value={notification.id}
                />
                <button
                  type="submit"
                  className="button secondary"
                  style={{ minWidth: 120 }}
                >
                  ✓ Klart
                </button>
              </form>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdminPendingBanner({
  pendingCount,
}: {
  pendingCount: number
}) {
  if (pendingCount <= 0) return null

  return (
    <div
      style={{
        border: '1px solid #f2d169',
        background: 'linear-gradient(180deg, #fffdf2 0%, #fff9e8 100%)',
        borderRadius: 22,
        padding: 16,
        display: 'flex',
        justifyContent: 'space-between',
        gap: 14,
        alignItems: 'center',
        flexWrap: 'wrap',
        boxShadow: '0 14px 30px rgba(245, 158, 11, 0.08)',
      }}
    >
      <div>
        <div style={{ fontWeight: 900, marginBottom: 4, color: '#1f3327' }}>
          ⏳ Väntande användare
        </div>
        <div className="muted">
          {pendingCount} användare väntar på att bli godkända.
        </div>
      </div>

      <Link
        href="/admin/users"
        className="button secondary"
        style={{
          minWidth: 170,
          textAlign: 'center',
          boxSizing: 'border-box',
          borderColor: '#eed38f',
          background: '#fffef8',
        }}
      >
        Öppna admin
      </Link>
    </div>
  )
}

function DashboardHighlights({
  bestRound9Score,
  bestRound18Score,
  roundsThisYearCount,
  latestCourseName,
}: {
  bestRound9Score: number | null
  bestRound18Score: number | null
  roundsThisYearCount: number
  latestCourseName: string
}) {
  return (
    <div
      className="dashboard-stats-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      <HighlightCard
        label="🏆 Bästa 9 hål"
        value={bestRound9Score ?? 'Ingen ännu'}
        sublabel="Lägsta registrerade score på 9 hål"
        tone="green"
      />

      <HighlightCard
        label="🏆 Bästa 18 hål"
        value={bestRound18Score ?? 'Ingen ännu'}
        sublabel="Lägsta registrerade score på 18 hål"
        tone="blue"
      />

      <HighlightCard
        label="📅 Spelade rundor i år"
        value={roundsThisYearCount}
        sublabel="Avslutade rundor under innevarande år"
        tone="blue"
      />

      <HighlightCard
        label="📍 Senaste bana"
        value={latestCourseName}
        sublabel="Från din senast avslutade runda"
        tone="slate"
      />
    </div>
  )
}

function SectionHeader({
  title,
  description,
  count,
  countTone = 'green',
}: {
  title: string
  description: string
  count: number
  countTone?: 'green' | 'slate'
}) {
  const badgeStyle =
    countTone === 'green'
      ? {
          background: '#f0fdf4',
          color: '#166534',
        }
      : {
          background: '#f3f4f6',
          color: '#334155',
        }

  return (
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
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            lineHeight: 1.1,
            color: '#20352a',
          }}
        >
          {title}
        </h2>
        <p className="muted" style={{ margin: '7px 0 0 0', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      <div
        style={{
          ...dashboardStyles.pill,
          ...badgeStyle,
          padding: '8px 14px',
        }}
      >
        {count} st
      </div>
    </div>
  )
}

function getNotificationActorName(
  notification: NotificationRow,
  profiles: Profile[]
) {
  const actor = profiles.find((p) => p.id === notification.actor_user_id)

  if (actor?.display_name?.trim()) {
    return actor.display_name.trim()
  }

  return 'Nagon'
}

function getNotificationSummary(notification: NotificationRow, actorName: string) {
  if (notification.type === 'like') {
    return `${actorName} gillade ditt event`
  }

  const rawTitle = String(notification.title ?? '').trim()

  if (rawTitle.startsWith('HejaropRound:')) {
    const firstColon = rawTitle.indexOf(':')
    const secondColon = rawTitle.indexOf(':', firstColon + 1)
    const thirdColon = rawTitle.indexOf(':', secondColon + 1)
    const cheerMessage = thirdColon >= 0 ? rawTitle.slice(thirdColon + 1).trim() : ''

    return cheerMessage.length > 0
      ? `${actorName} hejade: ${cheerMessage}`
      : `${actorName} skickade ett hejarop`
  }

  const commentBody = rawTitle.replace('Ny kommentar: ', '').replace(/^"|"$/g, '').trim()
  return commentBody.length > 0
    ? `${actorName} kommenterade: ${commentBody}`
    : `${actorName} kommenterade`
}

function FeedEventCard({
  event,
  playerName,
  playerProfile,
  courseName,
  likesCount,
  likedByMe,
  comments,
}: {
  event: FeedEvent
  playerName: string
  playerProfile?: Profile | null
  courseName: string
  likesCount: number
  likedByMe: boolean
  comments: FeedEventCommentRow[]
}) {
  const eventMeta =
  event.event_type === 'birdie'
    ? { emoji: '🐦', text: 'gjorde en birdie' }
    : event.event_type === 'eagle'
      ? { emoji: '🦅', text: 'gjorde en eagle' }
      : { emoji: '🎯', text: 'gjorde hole-in-one' }

  const timeLabel = formatFeedEventTime(event.created_at)

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
        padding: 14,
        display: 'grid',
        gap: 8,
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <UserAvatar profile={playerProfile} name={playerName} size={34} />
        <div style={{ fontWeight: 900, color: '#1f3327' }}>
          {eventMeta.emoji} {playerName} {eventMeta.text}
        </div>
      </div>

      <div className="muted">Hål {event.hole_number} - {courseName}</div>

      <div className="muted" style={{ fontSize: 13 }}>
        {timeLabel}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 4,
        }}
      >
        <div className="muted" style={{ fontSize: 13 }}>
          Likes {likesCount}
        </div>

        <Link href={`/rounds/${event.round_id}/live`} className="button secondary">
          Följ live
        </Link>

        {likedByMe ? (
          <form action={unlikeFeedEvent}>
            <input type="hidden" name="feedEventId" value={event.id} />
            <button type="submit" className="button secondary">
              Gillat
            </button>
          </form>
        ) : (
          <form action={likeFeedEvent}>
            <input type="hidden" name="feedEventId" value={event.id} />
            <button type="submit" className="button secondary">
              Gilla
            </button>
          </form>
        )}

        <Link href={`/feed/${event.id}`} className="button secondary">
          Öppna detaljer
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          Kommentarer {comments.length}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          Öppna detaljer för att läsa och skriva kommentarer.
        </div>
      </div>
    </div>
  )
}

function ActiveRoundCard({
  round,
  membershipRole,
}: {
  round: RoundWithCreatedAt
  membershipRole?: Membership['role']
}) {
  const role = getRoleLabel(membershipRole)
  const scoring = getScoringLabel(round.scoring_mode)
  const startedAt = formatRoundDateWithTime(round.created_at)
  const href = getRoundHref(round)

  return (
    <div
      style={{
        border: '1px solid #dbeedc',
        borderRadius: 22,
        background: 'linear-gradient(180deg, #f9fdf9 0%, #f4fbf5 100%)',
        padding: 16,
        display: 'grid',
        gap: 14,
        boxShadow: '0 16px 36px rgba(34, 197, 94, 0.07)',
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
              color: '#1f3327',
            }}
          >
            {round.title}
          </div>

          <div className="muted" style={{ lineHeight: 1.5 }}>
            {scoring} · Aktuellt hål {round.current_hole} · {role}
          </div>
        </div>

        <div
          style={{
            ...dashboardStyles.pill,
            background: '#dcfce7',
            color: '#166534',
          }}
        >
          Pågår
        </div>
      </div>

      <div
        className="round-meta-grid"
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
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Roll
          </div>
          <div style={{ fontWeight: 900, color: '#1f3327' }}>{role}</div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Spelform
          </div>
          <div style={{ fontWeight: 900, color: '#1f3327' }}>{scoring}</div>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 12,
          }}
        >
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Hål
          </div>
          <div style={{ fontWeight: 900, color: '#1f3327' }}>
            {round.current_hole}
          </div>
        </div>
      </div>

      <div
        className="round-actions-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        {startedAt ? (
          <div
            className="muted"
            style={{ gridColumn: '1 / -1', fontSize: 13, marginTop: -2 }}
          >
            Startad: {startedAt}
          </div>
        ) : null}

        <Link
          className="button secondary"
          href={href}
          style={{
            width: '100%',
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
            width: '100%',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          Leaderboard
        </Link>
      </div>
    </div>
  )
}

function CompletedRoundCard({
  round,
  membershipRole,
}: {
  round: RoundWithCreatedAt
  membershipRole?: Membership['role']
}) {
  const role = getRoleLabel(membershipRole)
  const scoring = getScoringLabel(round.scoring_mode)
  const roundDate = formatRoundDateWithTime(round.created_at)

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
        padding: 14,
        display: 'grid',
        gap: 12,
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
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
              color: '#1f3327',
            }}
          >
            {round.title}
          </div>

          <div className="muted" style={{ marginTop: 5, lineHeight: 1.45 }}>
            {scoring} · {role}
          </div>
          {roundDate ? (
            <div className="muted" style={{ marginTop: 2, fontSize: 13 }}>
              Avslutad: {roundDate}
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...dashboardStyles.pill,
            background: '#f3f4f6',
            color: '#334155',
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
}

function ActiveRoundsSection({
  rounds,
  membershipByRoundId,
  showAll,
  showAllCompleted,
}: {
  rounds: RoundWithCreatedAt[]
  membershipByRoundId: Map<string, Membership['role']>
  showAll: boolean
  showAllCompleted: boolean
}) {
  const visibleRounds = showAll
    ? rounds
    : rounds.slice(0, ACTIVE_ROUNDS_PREVIEW_COUNT)

  const hiddenCount = Math.max(rounds.length - ACTIVE_ROUNDS_PREVIEW_COUNT, 0)

  const showMoreHref = buildDashboardHref({
    showActive: 'all',
    showCompleted: showAllCompleted ? 'all' : undefined,
  })

  const showLessHref = buildDashboardHref({
    showCompleted: showAllCompleted ? 'all' : undefined,
  })

  return (
    <div className="card dashboard-mobile-card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Aktiva rundor"
        description="Rundor som pågår just nu."
        count={rounds.length}
        countTone="green"
      />

      {rounds.length === 0 ? (
        <SectionEmptyState
          title="Inga aktiva rundor ännu"
          description="Starta en ny runda för att komma igång."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {visibleRounds.map((round) => (
            <ActiveRoundCard
              key={round.id}
              round={round}
              membershipRole={membershipByRoundId.get(round.id)}
            />
          ))}

          {rounds.length > ACTIVE_ROUNDS_PREVIEW_COUNT ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 4,
              }}
            >
              {showAll ? (
                <Link
                  href={showLessHref}
                  scroll={false}
                  className="button secondary"
                  style={{ minWidth: 190, textAlign: 'center' }}
                >
                  Visa färre aktiva
                </Link>
              ) : (
                <Link
                  href={showMoreHref}
                  scroll={false}
                  className="button secondary"
                  style={{ minWidth: 220, textAlign: 'center' }}
                >
                  Visa fler aktiva ({hiddenCount})
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CompletedRoundsSection({
  rounds,
  membershipByRoundId,
  showAll,
  showAllActive,
}: {
  rounds: RoundWithCreatedAt[]
  membershipByRoundId: Map<string, Membership['role']>
  showAll: boolean
  showAllActive: boolean
}) {
  const visibleRounds = showAll
    ? rounds
    : rounds.slice(0, COMPLETED_ROUNDS_PREVIEW_COUNT)

  const hiddenCount = Math.max(
    rounds.length - COMPLETED_ROUNDS_PREVIEW_COUNT,
    0
  )

  const showMoreHref = buildDashboardHref({
    showActive: showAllActive ? 'all' : undefined,
    showCompleted: 'all',
  })

  const showLessHref = buildDashboardHref({
    showActive: showAllActive ? 'all' : undefined,
  })

  return (
    <div className="card dashboard-mobile-card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Avslutade rundor"
        description="Tidigare spelade rundor och sammanfattningar."
        count={rounds.length}
        countTone="slate"
      />

      {rounds.length === 0 ? (
        <SectionEmptyState
          title="Inga avslutade rundor ännu"
          description="När du avslutar en runda visas den här."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleRounds.map((round) => (
            <CompletedRoundCard
              key={round.id}
              round={round}
              membershipRole={membershipByRoundId.get(round.id)}
            />
          ))}

          {rounds.length > COMPLETED_ROUNDS_PREVIEW_COUNT ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
                marginTop: 4,
              }}
            >
              {showAll ? (
                <Link
                  href={showLessHref}
                  scroll={false}
                  className="button secondary"
                  style={{ minWidth: 210, textAlign: 'center' }}
                >
                  Visa färre avslutade
                </Link>
              ) : (
                <Link
                  href={showMoreHref}
                  scroll={false}
                  className="button secondary"
                  style={{ minWidth: 220, textAlign: 'center' }}
                >
                  Visa fler avslutade ({hiddenCount})
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function FriendActiveRoundsSection({
  rounds,
  coursesById,
  friendNameById,
}: {
  rounds: RoundWithCreatedAt[]
  coursesById: Map<string, string>
  friendNameById: Map<string, string>
}) {
  return (
    <div className="card dashboard-mobile-card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Vänners aktiva rundor"
        description="Följ vännernas spel live direkt när de är ute på banan."
        count={rounds.length}
        countTone="slate"
      />

      {rounds.length === 0 ? (
        <SectionEmptyState
          title="Inga vänrundor live just nu"
          description="När en vän startar en runda dyker den upp här."
        />
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rounds.map((round) => {
            const ownerName = friendNameById.get(round.owner_id) ?? 'Din vän'
            const courseName = coursesById.get(round.course_id) ?? 'Okänd bana'

            return (
              <div
                key={round.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 18,
                  background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
                  padding: 14,
                  display: 'grid',
                  gap: 10,
                  boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
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
                        color: '#1f3327',
                      }}
                    >
                      {round.title}
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {ownerName} · {courseName} · Hål {round.current_hole ?? 1}
                    </div>
                  </div>

                  <div
                    style={{
                      ...dashboardStyles.pill,
                      background: '#ecfdf3',
                      color: '#166534',
                    }}
                  >
                    Live
                  </div>
                </div>

                {formatRoundDateWithTime(round.created_at) ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Startad: {formatRoundDateWithTime(round.created_at)}
                  </div>
                ) : null}

                <Link
                  href={`/rounds/${round.id}/live`}
                  className="button secondary"
                  style={{ width: '100%', textAlign: 'center', boxSizing: 'border-box' }}
                >
                  Följ live
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const showAllActive = getSingleParam(resolvedSearchParams.showActive) === 'all'
  const showAllCompleted =
    getSingleParam(resolvedSearchParams.showCompleted) === 'all'

  const isAdmin = user.email === ADMIN_EMAIL
  const currentUserEmail = (user.email ?? '').trim().toLowerCase()

  const [
    { data: courses, error: coursesError },
    { data: rounds, error: roundsError },
    { data: profile, error: profileError },
    { data: memberships, error: membershipsError },
    { data: pendingUsers, error: pendingUsersError },
    { data: incomingFriendRequests, error: incomingFriendRequestsError },
    { data: friendsData, error: friendsError },
    { data: reverseFriendsData, error: reverseFriendsError },
    { data: notificationsData, error: notificationsError },
  ] = await Promise.all([
    supabase.from('courses').select('id, name').order('name'),
    supabase
      .from('rounds')
      .select(
        'id, owner_id, title, course_id, status, current_hole, scoring_mode, holes_mode, created_at'
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url, handicap_index')
      .eq('id', user.id)
      .single(),
    supabase.from('round_members').select('round_id, role').eq('user_id', user.id),
    isAdmin
      ? supabase.from('profiles').select('id').eq('is_approved', false)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('friend_requests')
      .select('id')
      .eq('recipient_email', currentUserEmail)
      .eq('status', 'pending'),
    supabase
      .from('friends')
      .select('friend_email')
      .eq('user_id', user.id),
    supabase
      .from('friends')
      .select('user_id')
      .eq('friend_email', currentUserEmail),
    supabase
      .from('notifications')
      .select(
        'id, user_id, actor_user_id, type, title, feed_event_id, is_read, created_at'
      )
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (coursesError) console.error('Failed to load courses:', coursesError)
  if (roundsError) console.error('Failed to load rounds:', roundsError)
  if (profileError) console.error('Failed to load profile:', profileError)
  if (membershipsError) {
    console.error('Failed to load memberships:', membershipsError)
  }
  if (pendingUsersError) {
    console.error('Failed to load pending users:', pendingUsersError)
  }
  if (incomingFriendRequestsError) {
    console.error(
      'Failed to load incoming friend requests:',
      incomingFriendRequestsError
    )
  }
  if (friendsError) {
    console.error('Failed to load friends:', friendsError)
  }
  if (reverseFriendsError) {
    console.error('Failed to load reverse friends:', reverseFriendsError)
  }
  if (notificationsError) {
    console.error('Failed to load notifications:', notificationsError)
  }

  const allCourses = (courses as Course[] | null) ?? []
  const allRounds = (rounds as Round[] | null) ?? []
  const userProfile = (profile as Profile | null) ?? null
  const userMemberships = (memberships as Membership[] | null) ?? []
  const pendingCount = pendingUsers?.length ?? 0
  const incomingFriendRequestsCount =
    (incomingFriendRequests as FriendRequestRow[] | null)?.length ?? 0
  const notifications = (notificationsData as NotificationRow[] | null) ?? []

  const actorUserIds = notifications
    .map((n) => n.actor_user_id)
    .filter((id): id is string => typeof id === 'string')

  let actorProfiles: Profile[] = []

  const friendEmails = ((friendsData as FriendRow[] | null) ?? [])
    .map((friend) => friend.friend_email)
    .filter((email): email is string => typeof email === 'string')
    .map((email) => email.trim().toLowerCase())
    .filter(
      (email): email is string =>
        typeof email === 'string' && email.length > 0
    )

  let friendUserIds: string[] = []
  let friendProfiles: FriendProfileLite[] = []

  if (friendEmails.length > 0) {
    const { data: friendProfilesData, error: friendProfilesError } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('email', friendEmails)

    if (friendProfilesError) {
      console.error('Failed to load friend profiles:', friendProfilesError)
    }

    friendProfiles = (friendProfilesData as FriendProfileLite[] | null) ?? []
    friendUserIds = friendProfiles.map((profile) => profile.id)
  }

  const reverseFriendUserIds = ((reverseFriendsData as ReverseFriendRow[] | null) ?? [])
    .map((row) => String(row.user_id ?? '').trim())
    .filter((id) => id.length > 0)

  const allFriendUserIds = Array.from(
    new Set([...friendUserIds, ...reverseFriendUserIds])
  )

  if (allFriendUserIds.length > 0) {
    const { data: friendProfilesById, error: friendProfilesByIdError } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', allFriendUserIds)

    if (friendProfilesByIdError) {
      console.error('Failed to load friend profiles by id:', friendProfilesByIdError)
    } else {
      friendProfiles = (friendProfilesById as FriendProfileLite[] | null) ?? friendProfiles
    }
  }

  friendUserIds = allFriendUserIds

  const visibleUserIds = Array.from(new Set([user.id, ...friendUserIds]))
  const friendNameById = new Map(
    friendProfiles.map((profile) => [
      profile.id,
      profile.display_name?.trim() || profile.email?.trim() || 'Din vän',
    ])
  )
  const coursesById = new Map(allCourses.map((course) => [course.id, course.name]))

  const { data: feedEventsData, error: feedEventsError } = await supabase
    .from('feed_events')
    .select(
      'id, user_id, round_id, round_player_id, event_type, hole_number, created_at, player_name, course_name'
    )
    .in('user_id', visibleUserIds)
    .order('created_at', { ascending: false })
    .limit(5)

  if (feedEventsError) {
    console.error('Failed to load feed events:', feedEventsError)
  }

  const feedEvents = (feedEventsData as FeedEvent[] | null) ?? []
  const roundIdsForPlayers = Array.from(
    new Set(
      [...allRounds.map((round) => round.id), ...feedEvents.map((event) => event.round_id)].filter(
        (roundId): roundId is string => typeof roundId === 'string' && roundId.length > 0
      )
    )
  )

  let allRoundPlayers: RoundPlayer[] = []
  let allHoleScores: HoleScore[] = []

  if (roundIdsForPlayers.length > 0) {
    const { data: roundPlayersData, error: roundPlayersError } = await supabase
      .from('round_players')
      .select(
        'id, round_id, user_id, invited_email, display_name, handicap_index, exact_handicap, tee_key, playing_handicap, sort_order'
      )
      .in('round_id', roundIdsForPlayers)

    if (roundPlayersError) {
      console.error('Failed to load round players:', roundPlayersError)
    }

    allRoundPlayers = (roundPlayersData as RoundPlayer[] | null) ?? []

    const roundPlayerIds = allRoundPlayers
      .map((player) => player.id)
      .filter((playerId): playerId is string => typeof playerId === 'string' && playerId.length > 0)

    if (roundPlayerIds.length > 0) {
      const { data: holeScoresData, error: holeScoresError } = await supabase
        .from('hole_scores')
        .select('id, round_player_id, strokes')
        .in('round_player_id', roundPlayerIds)

      if (holeScoresError) {
        console.error('Failed to load hole scores:', holeScoresError)
      }

      allHoleScores = (holeScoresData as HoleScore[] | null) ?? []
    }
  }

  let feedEventLikes: FeedEventLikeRow[] = []

  if (feedEvents.length > 0) {
    const { data: feedEventLikesData, error: feedEventLikesError } =
      await supabase
        .from('feed_event_likes')
        .select('id, feed_event_id, user_id')
        .in(
          'feed_event_id',
          feedEvents.map((event) => event.id)
        )

    if (feedEventLikesError) {
      console.error('Failed to load feed event likes:', feedEventLikesError)
    }

    feedEventLikes = (feedEventLikesData as FeedEventLikeRow[] | null) ?? []
  }

  let feedEventComments: FeedEventCommentRow[] = []

  if (feedEvents.length > 0) {
    const { data: feedEventCommentsData, error: feedEventCommentsError } =
      await supabase
        .from('feed_event_comments')
        .select('id, feed_event_id, user_id, body, created_at')
        .in(
          'feed_event_id',
          feedEvents.map((event) => event.id)
        )
        .order('created_at', { ascending: true })

    if (feedEventCommentsError) {
      console.error(
        'Failed to load feed event comments:',
        feedEventCommentsError
      )
    }

    feedEventComments =
      (feedEventCommentsData as FeedEventCommentRow[] | null) ?? []
  }

  const feedEventUserIds = feedEvents
    .map((event) => event.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const commentAuthorUserIds = feedEventComments
    .map((comment) => comment.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const profileIdsForFeedAndNotifications = Array.from(
    new Set([...actorUserIds, ...feedEventUserIds, ...commentAuthorUserIds])
  )

  if (profileIdsForFeedAndNotifications.length > 0) {
    const { data: profileData, error: profileDataError } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .in('id', profileIdsForFeedAndNotifications)

    if (profileDataError) {
      console.error('Failed to load profiles for feed/notifications:', profileDataError)
    }

    actorProfiles = (profileData as Profile[] | null) ?? []
  }

  const commentsByEventId = new Map<string, FeedEventCommentRow[]>()

  for (const comment of feedEventComments) {
    const existing = commentsByEventId.get(comment.feed_event_id) ?? []
    existing.push(comment)
    commentsByEventId.set(comment.feed_event_id, existing)
  }

  const likesByEventId = new Map<string, FeedEventLikeRow[]>()

  for (const like of feedEventLikes) {
    const existing = likesByEventId.get(like.feed_event_id) ?? []
    existing.push(like)
    likesByEventId.set(like.feed_event_id, existing)
  }

  const membershipByRoundId = new Map(
    userMemberships.map((member) => [member.round_id, member.role] as const)
  )

  const profileById = new Map(actorProfiles.map((profile) => [profile.id, profile] as const))

  const displayName =
    userProfile?.display_name?.trim() || user.email || 'Golfspelare'
  const greeting = getTimeGreetingSvSE()

  const activeRounds = allRounds.filter((round) => round.status === 'active')

  const completedRounds = allRounds.filter(
    (round) => round.status === 'finished' || round.status === 'completed'
  )
  const friendUserIdSet = new Set(friendUserIds)
  const friendActiveRoundsFromVisibleRounds = activeRounds.filter(
    (round) => round.owner_id !== user.id && friendUserIdSet.has(round.owner_id)
  )

  let friendActiveRounds: RoundWithCreatedAt[] = friendActiveRoundsFromVisibleRounds

  if (friendUserIds.length > 0) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.warn(
        'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. Falling back to visible rounds only.'
      )
    } else {
      const supabaseAdmin = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })

      const { data: friendActiveRoundsData, error: friendActiveRoundsError } =
        await supabaseAdmin
          .from('rounds')
          .select(
            'id, owner_id, title, course_id, status, current_hole, scoring_mode, holes_mode, created_at'
          )
          .eq('status', 'active')
          .in('owner_id', friendUserIds)
          .order('created_at', { ascending: false })

      if (friendActiveRoundsError) {
        console.error(
          'Failed to load friend active rounds via admin client:',
          friendActiveRoundsError
        )
      } else {
        friendActiveRounds =
          (friendActiveRoundsData as RoundWithCreatedAt[] | null)?.filter(
            (round) => round.owner_id !== user.id
          ) ?? friendActiveRoundsFromVisibleRounds
      }
    }
  }

  const currentYear = new Date().getFullYear()

  const completedRoundsThisYear = completedRounds.filter((round) => {
    const createdAt = (round as Round & { created_at?: string }).created_at
    if (!createdAt) return false

    const date = new Date(createdAt)
    return !Number.isNaN(date.getTime()) && date.getFullYear() === currentYear
  })

  const roundsWithScores = completedRounds
    .map((round) => {
      const player = allRoundPlayers.find(
        (roundPlayer) =>
          roundPlayer.round_id === round.id && roundPlayer.user_id === user.id
      )

      if (!player) return null

      const scores = allHoleScores.filter(
        (score) => score.round_player_id === player.id
      )

      const expectedHoleCount = Number(round.holes_mode) === 9 ? 9 : 18

      const validScores = scores.filter(
        (score) => typeof score.strokes === 'number'
      )

      if (validScores.length < expectedHoleCount) return null

      const strokes = validScores.reduce((sum, score) => {
        return sum + (score.strokes ?? 0)
      }, 0)

      return {
        round,
        strokes,
      }
    })
    .filter((item): item is { round: Round; strokes: number } => item !== null)

  const roundsWithScores9 = roundsWithScores.filter(
    (item) => Number(item.round.holes_mode) === 9
  )

  const roundsWithScores18 = roundsWithScores.filter(
    (item) => Number(item.round.holes_mode) === 18
  )

  const bestRound9 =
    roundsWithScores9.length > 0
      ? roundsWithScores9.reduce((best, current) =>
          current.strokes < best.strokes ? current : best
        )
      : null

  const bestRound18 =
    roundsWithScores18.length > 0
      ? roundsWithScores18.reduce((best, current) =>
          current.strokes < best.strokes ? current : best
        )
      : null

  const averageScore =
    roundsWithScores.length > 0
      ? roundsWithScores.reduce((sum, item) => sum + item.strokes, 0) /
        roundsWithScores.length
      : null

  const latestRound = completedRounds[0] ?? null

  const latestCourseName = latestRound
    ? allCourses.find((c) => c.id === latestRound.course_id)?.name || 'Okänd bana'
    : 'Ingen ännu'

  return (
    <main style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .dashboard-header-actions,
        .dashboard-stats-grid,
        .round-meta-grid,
        .round-actions-grid {
          min-width: 0;
        }

        @media (max-width: 820px) {
          .dashboard-header-actions {
            flex-wrap: nowrap !important;
            overflow-x: auto;
            padding-bottom: 2px;
            scrollbar-width: thin;
          }
        }

        @media (max-width: 720px) {
          .round-meta-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .round-meta-grid,
          .round-actions-grid {
            gap: 10px !important;
          }
        }

        @media (max-width: 520px) {
          .round-meta-grid,
          .round-actions-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .dashboard-lower-stack {
            gap: 12px !important;
          }

          .dashboard-mobile-card {
            border-radius: 18px !important;
          }

          .dashboard-mobile-card .button.secondary {
            min-height: 46px;
            padding-top: 10px;
            padding-bottom: 10px;
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
        <div style={{ display: 'grid', gap: 16, marginBottom: 18 }}>
          <DashboardHeader
            displayName={displayName}
            profile={userProfile}
            greeting={greeting}
            isAdmin={isAdmin}
            pendingCount={pendingCount}
            incomingFriendRequestsCount={incomingFriendRequestsCount}
          />

          <InstallAppPrompt />

          <FriendRequestNotice
            incomingFriendRequestsCount={incomingFriendRequestsCount}
          />

          <NotificationsSection
            notifications={notifications}
            actorProfiles={actorProfiles}
          />

          {isAdmin ? <AdminPendingBanner pendingCount={pendingCount} /> : null}

          <DashboardHighlights
            bestRound9Score={bestRound9 ? bestRound9.strokes : null}
            bestRound18Score={bestRound18 ? bestRound18.strokes : null}
            roundsThisYearCount={completedRoundsThisYear.length}
            latestCourseName={latestCourseName}
          />
        </div>

        <div className="dashboard-lower-stack" style={{ display: 'grid', gap: 18 }}>
          <div id="friend-feed" className="card" style={dashboardStyles.sectionCard}>
            <SectionHeader
              title="📊 Din statistik"
              description="Din genomsnittliga score baserat på avslutade rundor."
              count={completedRounds.length}
              countTone="slate"
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 12,
              }}
            >
              <HighlightCard
                label="📊 Snittscore"
                value={
                  averageScore !== null ? Math.round(averageScore).toString() : '—'
                }
                sublabel="Genomsnittligt antal slag"
                tone="purple"
              />
            </div>
          </div>

          <FriendActiveRoundsSection
            rounds={friendActiveRounds}
            coursesById={coursesById}
            friendNameById={friendNameById}
          />

          <div className="card dashboard-mobile-card" style={dashboardStyles.sectionCard}>
            <SectionHeader
              title="Vänflöde"
              description="Senaste höjdpunkterna i spelet."
              count={feedEvents.length}
              countTone="slate"
            />

            {feedEvents.length === 0 ? (
              <SectionEmptyState
                title="Inga höjdpunkter ännu"
                description="Birdies, eagles och hole-in-one dyker upp här."
              />
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {feedEvents.map((event) => {
                  const likes = likesByEventId.get(event.id) ?? []
                  const comments = commentsByEventId.get(event.id) ?? []
                  const likesCount = likes.length
                  const likedByMe = likes.some((like) => like.user_id === user.id)

                  return (
                    <FeedEventCard
                      key={event.id}
                      event={event}
                      playerName={getPlayerNameForFeedEvent(event, allRoundPlayers)}
                      playerProfile={profileById.get(event.user_id) ?? null}
                      courseName={getCourseNameForFeedEvent(
                        event,
                        allRounds,
                        allCourses
                      )}
                      likesCount={likesCount}
                      likedByMe={likedByMe}
                      comments={comments}
                    />
                  )
                })}
              </div>
            )}
          </div>

          <ActiveRoundsSection
            rounds={activeRounds}
            membershipByRoundId={membershipByRoundId}
            showAll={showAllActive}
            showAllCompleted={showAllCompleted}
          />

          <CompletedRoundsSection
            rounds={completedRounds}
            membershipByRoundId={membershipByRoundId}
            showAll={showAllCompleted}
            showAllActive={showAllActive}
          />
        </div>
      </div>
    </main>
  )
}

