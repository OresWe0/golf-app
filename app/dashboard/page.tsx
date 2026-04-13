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
  strokes?: number | null
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
  return scoringMode === 'stableford' ? 'Stableford' : 'Slagspel'
}

function getRoundHref(round: Round) {
  return `/rounds/${round.id}?hole=${round.current_hole}`
}

function getFeedEventLabel(eventType: FeedEvent['event_type']) {
  if (eventType === 'birdie') return '🐦 Birdie'
  if (eventType === 'eagle') return '🦅 Eagle'
  return '🎯 Hole-in-one'
}

const dashboardStyles = {
  heroCard: {
    background:
      'linear-gradient(180deg, rgba(248,251,247,0.98) 0%, rgba(255,255,255,0.98) 100%)',
    border: '1px solid #dbeedc',
    borderRadius: 28,
    boxShadow: '0 20px 52px rgba(15, 23, 42, 0.08)',
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
      <div style={{ fontWeight: 800, marginBottom: 4, color: '#1f3327' }}>{title}</div>
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
      <div style={{ display: 'grid', gap: 18 }}>
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
              👋 Inloggad som {displayName}
            </span>

            <h1
              style={{
                marginTop: 16,
                marginBottom: 12,
                fontSize: 'clamp(2rem, 4vw, 3rem)',
                lineHeight: 1,
                color: '#20352a',
              }}
            >
              Dashboard
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
              Starta en ny runda eller fortsätt en aktiv runda med dina golfvänner.
              Ditt sparade HCP används som standard.
            </p>
          </div>

          {isAdmin && pendingCount > 0 ? (
            <div
              style={{
                ...dashboardStyles.pill,
                background: 'linear-gradient(180deg, #fff5d9 0%, #fef3c7 100%)',
                color: '#92400e',
                border: '1px solid #f4d57c',
                boxShadow: '0 10px 24px rgba(245, 158, 11, 0.14)',
              }}
            >
              {pendingCount} väntar på godkännande
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <Link
            href="/rounds/new"
            className="button"
            style={{
              width: '100%',
              minHeight: 60,
              fontSize: 20,
              fontWeight: 900,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #166534 0%, #22c55e 100%)',
              boxShadow: '0 18px 40px rgba(34, 197, 94, 0.24)',
            }}
          >
            ⛳ Starta ny runda
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
                style={dashboardStyles.softButton}
              >
                Admin{pendingCount > 0 ? ` (${pendingCount})` : ''}
              </Link>
            ) : null}

            <div style={{ position: 'relative' }}>
              <Link
                href="/profile"
                className="button secondary"
                style={dashboardStyles.softButton}
              >
                Min profil
              </Link>

              {incomingFriendRequestsCount > 0 ? (
                <span
                  aria-label={`${incomingFriendRequestsCount} inkommande vänförfrågningar`}
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

function FeedEventCard({
  event,
  playerName,
}: {
  event: FeedEvent
  playerName: string
}) {
  const eventMeta =
    event.event_type === 'birdie'
      ? { emoji: '🐦', text: 'birdie' }
      : event.event_type === 'eagle'
        ? { emoji: '🦅', text: 'eagle' }
        : { emoji: '🎯', text: 'hole-in-one' }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 18,
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
        padding: 14,
        display: 'grid',
        gap: 6,
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div style={{ fontWeight: 900, color: '#1f3327' }}>
        {eventMeta.emoji} {playerName} gjorde {eventMeta.text}
      </div>

      <div className="muted">Hål {event.hole_number}</div>
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
            Mode
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
          <div style={{ fontWeight: 900, color: '#1f3327' }}>{round.current_hole}</div>
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
            {scoring} · {role}
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
    { data: holeScores, error: holeScoresError },
    { data: roundPlayers, error: roundPlayersError },
    { data: feedEventsData, error: feedEventsError },
  ] = await Promise.all([
    supabase.from('courses').select('*').order('name'),
    supabase.from('rounds').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('round_members').select('round_id, role').eq('user_id', user.id),
    isAdmin
      ? supabase.from('profiles').select('id').eq('is_approved', false)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('friend_requests')
      .select('id')
      .eq('recipient_email', currentUserEmail)
      .eq('status', 'pending'),
    supabase.from('hole_scores').select('*'),
    supabase.from('round_players').select('*'),
    supabase
  supabase
  .from('feed_events')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5)
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
  if (holeScoresError) {
    console.error('Failed to load hole scores:', holeScoresError)
  }
  if (roundPlayersError) {
    console.error('Failed to load round players:', roundPlayersError)
  }
  if (feedEventsError) {
    console.error('Failed to load feed events:', feedEventsError)
  }

  const allCourses = (courses as Course[] | null) ?? []
  const allRounds = (rounds as Round[] | null) ?? []
  const userProfile = (profile as Profile | null) ?? null
  const userMemberships = (memberships as Membership[] | null) ?? []
  const pendingCount = pendingUsers?.length ?? 0
  const incomingFriendRequestsCount =
    (incomingFriendRequests as FriendRequestRow[] | null)?.length ?? 0
  const allHoleScores = (holeScores as HoleScore[] | null) ?? []
  const allRoundPlayers = (roundPlayers as RoundPlayer[] | null) ?? []
  const feedEvents = (feedEventsData as FeedEvent[] | null) ?? []

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
            grid-template-columns: 1fr !important;
          }
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

          {isAdmin ? <AdminPendingBanner pendingCount={pendingCount} /> : null}

          <DashboardHighlights
            bestRound9Score={bestRound9 ? bestRound9.strokes : null}
            bestRound18Score={bestRound18 ? bestRound18.strokes : null}
            roundsThisYearCount={completedRoundsThisYear.length}
            latestCourseName={latestCourseName}
          />
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div className="card" style={dashboardStyles.sectionCard}>
            <SectionHeader
              title="Statistik"
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
                value={averageScore !== null ? Math.round(averageScore).toString() : '—'}
                sublabel="Genomsnittligt antal slag"
                tone="purple"
              />
            </div>
          </div>

          <div className="card" style={dashboardStyles.sectionCard}>
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
              {feedEvents.map((event) => (
  <FeedEventCard
    key={event.id}
    event={event}
    playerName={displayName}
  />
))}
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