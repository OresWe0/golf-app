import {
  likeFeedEvent,
  unlikeFeedEvent,
  addFeedEventComment,
  markNotificationAsRead,
} from './actions'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
  hole_number?: number | null
  strokes?: number | null
}

type CourseHoleRow = {
  course_id: string
  hole_number: number
  par: number
}

type FriendRow = {
  friend_email: string | null
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
  if (role === 'owner') return 'Ã„gare'
  if (role === 'player') return 'Spelare'
  return 'Ej deltagare'
}

function getScoringLabel(scoringMode: Round['scoring_mode']) {
  return scoringMode === 'stableford' ? 'PoÃ¤ngbogey' : 'Slagspel'
}

function getRoundHref(round: Round) {
  return `/rounds/${round.id}?hole=${round.current_hole}`
}

function getFeedEventLabel(eventType: FeedEvent['event_type']) {
  if (eventType === 'birdie') return 'ðŸ¦ Birdie'
  if (eventType === 'eagle') return 'ðŸ¦… Eagle'
  return 'ðŸŽ¯ Hole-in-one'
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
    return `IgÃ¥r ${timeText}`
  }

  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: 'short',
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
  if (!round) return 'OkÃ¤nd bana'

  const course = courses.find((item) => item.id === round.course_id)
  return course?.name || 'OkÃ¤nd bana'
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

  return 'OkÃ¤nd spelare'
}
  
function normalizeCourseSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatSigned(value: number, digits = 1) {
  const rounded = Number(value.toFixed(digits))

  if (rounded > 0) return `+${rounded.toFixed(digits)}`
  if (rounded < 0) return rounded.toFixed(digits)
  return (0).toFixed(digits)
}
const dashboardStyles = {
  heroCard: {
    background:
      'linear-gradient(135deg, #163b2a 0%, #1f6b45 55%, #38a169 100%)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 28,
    boxShadow: '0 24px 56px rgba(22, 59, 42, 0.28)',
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
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  },
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
          ðŸ“¨ Du har en ny vÃ¤nfÃ¶rfrÃ¥gan
        </div>
        <div className="muted" style={{ color: '#7c5a12' }}>
          Du har {incomingFriendRequestsCount} inkommande vÃ¤nfÃ¶rfrÃ¥gan
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
        Ã–ppna Min profil
      </Link>
    </div>
  )
}

function DashboardHeader({
  displayName,
  isAdmin,
  pendingCount,
  incomingFriendRequestsCount,
}: {
  displayName: string
  isAdmin: boolean
  pendingCount: number
  incomingFriendRequestsCount: number
}) {
  return (
    <div className="card" style={dashboardStyles.heroCard}>
      <div style={{ display: 'grid', gap: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#ffffff',
                fontWeight: 900,
                backdropFilter: 'blur(6px)',
              }}
            >
              ðŸ‘‹ Inloggad som {displayName}
            </span>

            <h1
              style={{
                marginTop: 18,
                marginBottom: 12,
                fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
                lineHeight: 0.95,
                color: '#ffffff',
                letterSpacing: -1,
              }}
            >
              TrÃ¤ffa fairway,
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
              Redo fÃ¶r nÃ¤sta runda? Starta snabbt, fortsÃ¤tt en aktiv runda eller
              fÃ¶lj dina golfvÃ¤nner.
            </p>
          </div>

          {isAdmin && pendingCount > 0 ? (
            <div
              style={{
                ...dashboardStyles.pill,
                background: 'rgba(255, 245, 217, 0.96)',
                color: '#92400e',
                border: '1px solid rgba(244, 213, 124, 0.95)',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
              }}
            >
              {pendingCount} vÃ¤ntar pÃ¥ godkÃ¤nnande
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <Link
            href="/rounds/new"
            className="button"
            style={{
              width: '100%',
              minHeight: 64,
              fontSize: 21,
              fontWeight: 900,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
              color: '#fff',
              boxShadow: '0 20px 42px rgba(15, 47, 32, 0.32)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            â›³ Starta ny runda
          </Link>

          <div
            className="dashboard-header-actions"
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
                  ...dashboardStyles.softButton,
                  background: 'rgba(255,255,255,0.14)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Link>
            ) : null}

            <div style={{ position: 'relative' }}>
              <Link
                href="/profile"
                className="button secondary"
                style={{
                  ...dashboardStyles.softButton,
                  background: 'rgba(255,255,255,0.14)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                ðŸ‘¤ Profil & vÃ¤nner
              </Link>

              {incomingFriendRequestsCount > 0 ? (
                <span
                  aria-label={`${incomingFriendRequestsCount} inkommande vÃ¤nfÃ¶rfrÃ¥gningar`}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    minWidth: 24,
                    height: 24,
                    borderRadius: 999,
                    background: '#dc2626',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 7px',
                    boxShadow: '0 8px 18px rgba(220, 38, 38, 0.26)',
                    border: '2px solid #fff',
                  }}
                >
                  {incomingFriendRequestsCount}
                </span>
              ) : null}
            </div>

            <form action={signOut}>
              <button
                type="submit"
                className="button secondary"
                style={{
                  width: '100%',
                  minWidth: 120,
                  background: 'rgba(255,255,255,0.14)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                Logga ut
              </button>
            </form>
          </div>
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
        description="Det senaste som hÃ¤nt i ditt flÃ¶de."
        count={notifications.length}
        countTone="slate"
      />

      <div style={{ display: 'grid', gap: 10 }}>
        {notifications.map((notification) => {
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
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 800, color: '#1f3327' }}>
                  {notification.type === 'like'
                    ? `ðŸ‘ ${actorName} gillade ditt event`
                    : `ðŸ’¬ ${actorName} kommenterade: ${notification.title.replace(
                        'Ny kommentar: ',
                        ''
                      )}`}
                </div>

                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {formatFeedEventTime(notification.created_at)}
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
                  âœ“ Klart
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
          â³ VÃ¤ntande anvÃ¤ndare
        </div>
        <div className="muted">
          {pendingCount} anvÃ¤ndare vÃ¤ntar pÃ¥ att bli godkÃ¤nda.
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
        Ã–ppna admin
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
        label="ðŸ† BÃ¤sta 9 hÃ¥l"
        value={bestRound9Score ?? 'Ingen Ã¤nnu'}
        sublabel="LÃ¤gsta registrerade score pÃ¥ 9 hÃ¥l"
        tone="green"
      />

      <HighlightCard
        label="ðŸ† BÃ¤sta 18 hÃ¥l"
        value={bestRound18Score ?? 'Ingen Ã¤nnu'}
        sublabel="LÃ¤gsta registrerade score pÃ¥ 18 hÃ¥l"
        tone="blue"
      />

      <HighlightCard
        label="ðŸ“… Spelade rundor i Ã¥r"
        value={roundsThisYearCount}
        sublabel="Avslutade rundor under innevarande Ã¥r"
        tone="blue"
      />

      <HighlightCard
        label="ðŸ“ Senaste bana"
        value={latestCourseName}
        sublabel="FrÃ¥n din senast avslutade runda"
        tone="slate"
      />
    </div>
  )
}

function KarstaInsightsSection({
  roundsCount,
  playedHoleCount,
  averageStrokesPerHole,
  trendDeltaPerHole,
  holeInsights,
}: {
  roundsCount: number
  playedHoleCount: number
  averageStrokesPerHole: number | null
  trendDeltaPerHole: number | null
  holeInsights: Array<{
    holeNumber: number
    par: number | null
    averageStrokes: number
    averageToPar: number | null
    sampleCount: number
  }>
}) {
  const hardestHoles = [...holeInsights]
    .sort((a, b) => {
      const aScore = a.averageToPar ?? a.averageStrokes
      const bScore = b.averageToPar ?? b.averageStrokes

      if (bScore !== aScore) return bScore - aScore
      return b.sampleCount - a.sampleCount
    })
    .slice(0, 5)

  const trendLabel =
    trendDeltaPerHole == null
      ? 'For fa rundor'
      : trendDeltaPerHole < 0
        ? `Forbattring ${Math.abs(trendDeltaPerHole).toFixed(2)} slag/hal`
        : trendDeltaPerHole > 0
          ? `Lite tyngre ${trendDeltaPerHole.toFixed(2)} slag/hal`
          : 'Ofandrad trend'

  return (
    <div className="card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Karsta Insights"
        description="Personlig statistik for din hemmabana."
        count={roundsCount}
        countTone="green"
      />

      {roundsCount === 0 || holeInsights.length === 0 ? (
        <SectionEmptyState
          title="Inga Karsta-rundor med data annu"
          description="Spela och avsluta en runda pa Karsta sa dyker hal-insights upp har."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <HighlightCard
              label="Rundor pa Karsta"
              value={roundsCount}
              sublabel="Avslutade rundor med registrerad score"
              tone="green"
            />

            <HighlightCard
              label="Snitt per hal"
              value={
                averageStrokesPerHole == null
                  ? '-'
                  : `${averageStrokesPerHole.toFixed(2)} slag`
              }
              sublabel={`${playedHoleCount} registrerade hal totalt`}
              tone="purple"
            />

            <HighlightCard
              label="Trend senaste 5"
              value={
                trendDeltaPerHole == null
                  ? '-'
                  : `${
                      trendDeltaPerHole < 0
                        ? 'Ned'
                        : trendDeltaPerHole > 0
                          ? 'Upp'
                          : 'Plan'
                    } ${formatSigned(trendDeltaPerHole, 2)}`
              }
              sublabel={trendLabel}
              tone="blue"
            />
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 14,
              background: '#fbfdfb',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900, color: '#1f3327' }}>Svaraste hal just nu</div>

            {hardestHoles.length === 0 ? (
              <div className="muted">Ingen haldata an sa lange.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {hardestHoles.map((hole) => (
                  <div
                    key={`hardest-${hole.holeNumber}`}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      flexWrap: 'wrap',
                      background: '#fff',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#1f3327' }}>
                      Hal {hole.holeNumber}
                    </div>

                    <div className="muted" style={{ fontSize: 14 }}>
                      Snitt {hole.averageStrokes.toFixed(2)} slag
                      {hole.averageToPar != null
                        ? ` (${formatSigned(hole.averageToPar, 2)} mot par)`
                        : ''}
                      {' · '}
                      {hole.sampleCount} varv
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 14,
              background: '#ffffff',
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 900, color: '#1f3327' }}>Snittscore per hal</div>

            <div className="karsta-holes-grid">
              {holeInsights.map((hole) => (
                <div
                  key={`karsta-hole-${hole.holeNumber}`}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 12,
                    padding: 10,
                    background: '#fbfdfb',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ fontWeight: 900, color: '#1f3327' }}>Hal {hole.holeNumber}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Par {hole.par ?? '-'}
                  </div>
                  <div style={{ fontWeight: 800, color: '#1f3327' }}>
                    {hole.averageStrokes.toFixed(2)} slag
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {hole.averageToPar != null
                      ? `${formatSigned(hole.averageToPar, 2)} mot par`
                      : 'Par saknas'}
                    {' · '}
                    {hole.sampleCount} varv
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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

  return 'NÃ¥gon'
}

function getCommentAuthorName(
  comment: FeedEventCommentRow,
  profiles: Profile[]
) {
  const author = profiles.find((p) => p.id === comment.user_id)

  if (author?.display_name?.trim()) {
    return author.display_name.trim()
  }

  return 'En spelare'
}

function FeedEventCard({
  event,
  playerName,
  courseName,
  likesCount,
  likedByMe,
  comments,
  profiles,
}: {
  event: FeedEvent
  playerName: string
  courseName: string
  likesCount: number
  likedByMe: boolean
  comments: FeedEventCommentRow[]
  profiles: Profile[]
}) {
  const eventMeta =
    event.event_type === 'birdie'
      ? { emoji: 'ðŸ¦', text: 'birdie' }
      : event.event_type === 'eagle'
        ? { emoji: 'ðŸ¦…', text: 'eagle' }
        : { emoji: 'ðŸŽ¯', text: 'hole-in-one' }

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
      <div style={{ fontWeight: 900, color: '#1f3327' }}>
        {eventMeta.emoji} {playerName} gjorde {eventMeta.text}
      </div>

      <div className="muted">
        HÃ¥l {event.hole_number} Â· {courseName}
      </div>

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
          ðŸ‘ {likesCount}
        </div>

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
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          ðŸ’¬ {comments.length}
        </div>

        {comments.length > 0 && (
          <div
            style={{
              display: 'grid',
              gap: 6,
              padding: 10,
              borderRadius: 12,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
            }}
          >
            {comments.map((comment) => {
  const authorName = getCommentAuthorName(comment, profiles)

  return (
    <div
      key={comment.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 14,
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 900,
          flexShrink: 0,
          boxShadow: '0 6px 14px rgba(34, 197, 94, 0.08)',
        }}
      >
        {authorName.charAt(0).toUpperCase()}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontWeight: 800, color: '#1f2937' }}>
            {authorName}
          </span>
          <span style={{ color: '#374151' }}>{comment.body}</span>
        </div>
      </div>
    </div>
  )
   })}
  </div>
  )}
        <form action={addFeedEventComment} style={{ display: 'grid', gap: 6 }}>
          <input type="hidden" name="feedEventId" value={event.id} />
          <input
            type="text"
            name="body"
            maxLength={200}
            placeholder="Skriv en kommentar..."
          />
          <button type="submit" className="button secondary">
            Kommentera
          </button>
        </form>
      </div>
    </div>
  )
}

function ActiveRoundCard({
  round,
  membershipRole,
}: {
  round: Round
  membershipRole?: Membership['role']
}) {
  const role = getRoleLabel(membershipRole)
  const scoring = getScoringLabel(round.scoring_mode)
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
            {scoring} Â· Aktuellt hÃ¥l {round.current_hole} Â· {role}
          </div>
        </div>

        <div
          style={{
            ...dashboardStyles.pill,
            background: '#dcfce7',
            color: '#166534',
          }}
        >
          PÃ¥gÃ¥r
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
            HÃ¥l
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
        <Link
          className="button secondary"
          href={href}
          style={{
            width: '100%',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          FortsÃ¤tt runda
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
  round: Round
  membershipRole?: Membership['role']
}) {
  const role = getRoleLabel(membershipRole)
  const scoring = getScoringLabel(round.scoring_mode)

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
            {scoring} Â· {role}
          </div>
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
  rounds: Round[]
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
    <div className="card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Aktiva rundor"
        description="Rundor som pÃ¥gÃ¥r just nu."
        count={rounds.length}
        countTone="green"
      />

      {rounds.length === 0 ? (
        <SectionEmptyState
          title="Inga aktiva rundor Ã¤nnu"
          description="Starta en ny runda fÃ¶r att komma igÃ¥ng."
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
                  Visa fÃ¤rre aktiva
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
  rounds: Round[]
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
    <div className="card" style={dashboardStyles.sectionCard}>
      <SectionHeader
        title="Avslutade rundor"
        description="Tidigare spelade rundor och sammanfattningar."
        count={rounds.length}
        countTone="slate"
      />

      {rounds.length === 0 ? (
        <SectionEmptyState
          title="Inga avslutade rundor Ã¤nnu"
          description="NÃ¤r du avslutar en runda visas den hÃ¤r."
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
                  Visa fÃ¤rre avslutade
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
    { data: courseHoles, error: courseHolesError },
    { data: profile, error: profileError },
    { data: memberships, error: membershipsError },
    { data: pendingUsers, error: pendingUsersError },
    { data: incomingFriendRequests, error: incomingFriendRequestsError },
    { data: friendsData, error: friendsError },
    { data: notificationsData, error: notificationsError },
  ] = await Promise.all([
    supabase.from('courses').select('id, name').order('name'),
    supabase
      .from('rounds')
      .select(
        'id, title, course_id, status, current_hole, scoring_mode, holes_mode, created_at'
      )
      .order('created_at', { ascending: false }),
    supabase.from('course_holes').select('course_id, hole_number, par'),
    supabase.from('profiles').select('id, display_name').eq('id', user.id).single(),
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
  if (courseHolesError) console.error('Failed to load course holes:', courseHolesError)
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
  if (notificationsError) {
    console.error('Failed to load notifications:', notificationsError)
  }

  const allCourses = (courses as Course[] | null) ?? []
  const allRounds = (rounds as Round[] | null) ?? []
  const allCourseHoles = (courseHoles as CourseHoleRow[] | null) ?? []
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

  if (actorUserIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', actorUserIds)

    actorProfiles = data ?? []
  }

  const friendEmails = ((friendsData as FriendRow[] | null) ?? [])
    .map((friend) => friend.friend_email)
    .filter((email): email is string => typeof email === 'string')
    .map((email) => email.trim().toLowerCase())
    .filter(
      (email): email is string =>
        typeof email === 'string' && email.length > 0
    )

  let friendUserIds: string[] = []

  if (friendEmails.length > 0) {
    const { data: friendProfiles, error: friendProfilesError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', friendEmails)

    if (friendProfilesError) {
      console.error('Failed to load friend profiles:', friendProfilesError)
    }

    friendUserIds = (friendProfiles ?? []).map((profile) => profile.id)
  }

  const visibleUserIds = Array.from(new Set([user.id, ...friendUserIds]))

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
        .select('id, round_player_id, hole_number, strokes')
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

  const displayName =
    userProfile?.display_name?.trim() || user.email || 'Golfspelare'

  const activeRounds = allRounds.filter((round) => round.status === 'active')

  const completedRounds = allRounds.filter(
    (round) => round.status === 'finished' || round.status === 'completed'
  )

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
    ? allCourses.find((c) => c.id === latestRound.course_id)?.name || 'OkÃ¤nd bana'
    : 'Ingen Ã¤nnu'


  const karstaCourse = allCourses.find((course) =>
    normalizeCourseSearchText(course.name).includes('karsta')
  )

  const karstaCompletedRounds =
    karstaCourse == null
      ? []
      : completedRounds.filter((round) => round.course_id === karstaCourse.id)

  const karstaParByHole = new Map<number, number>()

  if (karstaCourse) {
    for (const hole of allCourseHoles) {
      if (hole.course_id !== karstaCourse.id) continue
      karstaParByHole.set(hole.hole_number, hole.par)
    }
  }

  const holeAccumulator = new Map<number, { totalStrokes: number; count: number }>()
  const karstaRoundPerformance: Array<{ createdAt: string; avgStrokesPerHole: number }> = []

  for (const round of karstaCompletedRounds) {
    const player = allRoundPlayers.find(
      (roundPlayer) => roundPlayer.round_id === round.id && roundPlayer.user_id === user.id
    )

    if (!player) continue

    const scoreRows = allHoleScores.filter((score) => {
      return (
        score.round_player_id === player.id &&
        typeof score.strokes === 'number' &&
        typeof score.hole_number === 'number'
      )
    })

    if (scoreRows.length === 0) continue

    let roundTotalStrokes = 0

    for (const row of scoreRows) {
      const holeNumber = Number(row.hole_number)
      const strokes = Number(row.strokes)

      if (!Number.isFinite(holeNumber) || !Number.isFinite(strokes)) continue

      roundTotalStrokes += strokes

      const existing = holeAccumulator.get(holeNumber) ?? { totalStrokes: 0, count: 0 }
      existing.totalStrokes += strokes
      existing.count += 1
      holeAccumulator.set(holeNumber, existing)
    }

    if (scoreRows.length > 0) {
      karstaRoundPerformance.push({
        createdAt: (round as Round & { created_at?: string }).created_at ?? '',
        avgStrokesPerHole: roundTotalStrokes / scoreRows.length,
      })
    }
  }

  const holeInsights = Array.from(holeAccumulator.entries())
    .map(([holeNumber, aggregate]) => {
      const averageStrokes = aggregate.totalStrokes / aggregate.count
      const par = karstaParByHole.get(holeNumber) ?? null

      return {
        holeNumber,
        par,
        averageStrokes,
        averageToPar: par != null ? averageStrokes - par : null,
        sampleCount: aggregate.count,
      }
    })
    .sort((a, b) => a.holeNumber - b.holeNumber)

  const totalKarstaStrokes = holeInsights.reduce(
    (sum, item) => sum + item.averageStrokes * item.sampleCount,
    0
  )
  const totalKarstaSamples = holeInsights.reduce((sum, item) => sum + item.sampleCount, 0)

  const karstaAverageStrokesPerHole =
    totalKarstaSamples > 0 ? totalKarstaStrokes / totalKarstaSamples : null

  const karstaTrendDeltaPerHole = (() => {
    const validRounds = karstaRoundPerformance
      .filter((item) => Number.isFinite(item.avgStrokesPerHole))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    if (validRounds.length < 3) return null

    const recentCount = Math.max(2, Math.floor(validRounds.length / 2))
    const recent = validRounds.slice(0, recentCount)
    const baseline = validRounds.slice(recentCount)

    if (baseline.length === 0) return null

    const recentAvg = recent.reduce((sum, item) => sum + item.avgStrokesPerHole, 0) / recent.length
    const baselineAvg =
      baseline.reduce((sum, item) => sum + item.avgStrokesPerHole, 0) / baseline.length

    return recentAvg - baselineAvg
  })()

  return (
    <main style={{ width: '100%', overflowX: 'hidden' }}>
      <style>{`
        .dashboard-header-actions,
        .dashboard-stats-grid,
        .round-meta-grid,
        .karsta-holes-grid,
        .round-actions-grid {
          min-width: 0;
        }

        @media (max-width: 820px) {
          .dashboard-header-actions {
            grid-template-columns: 1fr !important;
          }
        }

        .karsta-holes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
        }

        @media (max-width: 720px) {
          .round-meta-grid,
          .round-actions-grid {
            grid-template-columns: 1fr !important;
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

          <KarstaInsightsSection
            roundsCount={karstaCompletedRounds.length}
            playedHoleCount={totalKarstaSamples}
            averageStrokesPerHole={karstaAverageStrokesPerHole}
            trendDeltaPerHole={karstaTrendDeltaPerHole}
            holeInsights={holeInsights}
          />
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card" style={dashboardStyles.sectionCard}>
            <SectionHeader
              title="ðŸ“Š Din statistik"
              description="Din genomsnittliga score baserat pÃ¥ avslutade rundor."
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
                label="ðŸ“Š Snittscore"
                value={
                  averageScore !== null ? Math.round(averageScore).toString() : 'â€”'
                }
                sublabel="Genomsnittligt antal slag"
                tone="purple"
              />
            </div>
          </div>

          <div className="card" style={dashboardStyles.sectionCard}>
            <SectionHeader
              title="VÃ¤nflÃ¶de"
              description="Senaste hÃ¶jdpunkterna i spelet."
              count={feedEvents.length}
              countTone="slate"
            />

            {feedEvents.length === 0 ? (
              <SectionEmptyState
                title="Inga hÃ¶jdpunkter Ã¤nnu"
                description="Birdies, eagles och hole-in-one dyker upp hÃ¤r."
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
  courseName={getCourseNameForFeedEvent(
    event,
    allRounds,
    allCourses
  )}
  likesCount={likesCount}
  likedByMe={likedByMe}
  comments={comments}
  profiles={actorProfiles}
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
