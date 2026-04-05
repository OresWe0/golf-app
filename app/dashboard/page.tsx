import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
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
        border: '1px dashed #d1d5db',
        borderRadius: 16,
        padding: 18,
        background: '#f9fafb',
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div className="muted">{description}</div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900 }}>{value}</div>
    </div>
  )
}

function DashboardHeader({
  displayName,
  isAdmin,
  pendingCount,
}: {
  displayName: string
  isAdmin: boolean
  pendingCount: number
}) {
  return (
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
              Starta en ny runda eller fortsätt en aktiv runda med dina
              golfvänner. Ditt sparade HCP används som standard.
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
  )
}

function DashboardStats({
  coursesCount,
  activeRoundsCount,
  playerRoundsCount,
  completedRoundsCount,
}: {
  coursesCount: number
  activeRoundsCount: number
  playerRoundsCount: number
  completedRoundsCount: number
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
      }}
    >
      <StatCard label="Banor" value={coursesCount} />
      <StatCard label="Aktiva rundor" value={activeRoundsCount} />
      <StatCard label="Delade rundor" value={playerRoundsCount} />
      <StatCard label="Avslutade" value={completedRoundsCount} />
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
          {rounds.length} st
        </div>
      </div>

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
          {rounds.length} st
        </div>
      </div>

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

  const [
    { data: courses, error: coursesError },
    { data: rounds, error: roundsError },
    { data: profile, error: profileError },
    { data: memberships, error: membershipsError },
    { data: pendingUsers, error: pendingUsersError },
  ] = await Promise.all([
    supabase.from('courses').select('*').order('name'),
    supabase.from('rounds').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('round_members').select('round_id, role').eq('user_id', user.id),
    isAdmin
      ? supabase.from('profiles').select('id').eq('is_approved', false)
      : Promise.resolve({ data: [], error: null }),
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

  const allCourses = (courses as Course[] | null) ?? []
  const allRounds = (rounds as Round[] | null) ?? []
  const userProfile = (profile as Profile | null) ?? null
  const userMemberships = (memberships as Membership[] | null) ?? []
  const pendingCount = pendingUsers?.length ?? 0

  const membershipByRoundId = new Map(
    userMemberships.map((member) => [member.round_id, member.role] as const)
  )

  const displayName =
    userProfile?.display_name?.trim() || user.email || 'Golfspelare'

  const activeRounds = allRounds.filter((round) => round.status === 'active')
  const completedRounds = allRounds.filter((round) => round.status !== 'active')

  const playerRoundsCount = allRounds.filter(
    (round) => membershipByRoundId.get(round.id) === 'player'
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
        <div style={{ display: 'grid', gap: 14, marginBottom: 16 }}>
          <DashboardHeader
            displayName={displayName}
            isAdmin={isAdmin}
            pendingCount={pendingCount}
          />

          {isAdmin ? <AdminPendingBanner pendingCount={pendingCount} /> : null}

          <DashboardStats
            coursesCount={allCourses.length}
            activeRoundsCount={activeRounds.length}
            playerRoundsCount={playerRoundsCount}
            completedRoundsCount={completedRounds.length}
          />
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
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