import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import LiveAutoRefresh from '@/components/live-auto-refresh'
import { sendRoundCheer } from './actions'
import {
  getReceivedStrokesForSelectedHole,
  scoreVsPar,
  stablefordPoints,
} from '@/lib/scoring'

type RoundRow = {
  id: string
  title: string
  owner_id: string
  course_id: string
  status: string
  scoring_mode: 'stableford' | 'strokeplay'
  holes_mode: number | null
  current_hole: number | null
  start_hole: number | null
  end_hole: number | null
}

type CourseRow = {
  name: string
}

type HoleRow = {
  hole_number: number
  par: number
  hcp_index: number
}

type PlayerRow = {
  id: string
  user_id: string | null
  display_name: string | null
  playing_handicap: number | null
  active_from_hole: number | null
  active_to_hole: number | null
  sort_order: number | null
}

type ScoreRow = {
  round_player_id: string
  hole_number: number
  strokes: number | null
}

type OwnerProfileRow = {
  email: string | null
  display_name: string | null
}

type CheerNotificationRow = {
  id: string
  actor_user_id: string | null
  title: string
  created_at: string
}

type CheerEntry = {
  token: string
  message: string
  actorUserId: string
  createdAt: string
}

type CheerActorProfile = {
  id: string
  display_name: string | null
  email: string | null
  avatar_url?: string | null
}

type CheerActorView = {
  name: string
  avatarUrl: string | null
}

type LeaderRow = {
  playerId: string
  name: string
  holesPlayed: number
  totalStrokes: number
  totalPoints: number
  totalToPar: number
  position: number
}

function formatVsPar(value: number) {
  if (value > 0) return `+${value}`
  return `${value}`
}

function getScoringLabel(mode: RoundRow['scoring_mode']) {
  return mode === 'stableford' ? 'Poangbogey' : 'Slagspel'
}

function getModeLabel(round: RoundRow, startHole: number) {
  if (round.holes_mode === 18) return '18 hal'
  return startHole === 1 ? '9 hal - Framre 9' : '9 hal - Bakre 9'
}

function getNowLabel() {
  return new Date().toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function parseCheerTitleForRound(title: string, roundId: string) {
  const prefix = `HejaropRound:${roundId}:`
  if (!title.startsWith(prefix)) return null

  const rest = title.slice(prefix.length)
  const splitIndex = rest.indexOf(':')
  if (splitIndex < 1) return null

  const token = rest.slice(0, splitIndex).trim()
  const message = rest.slice(splitIndex + 1).trim()
  if (!token) return null

  return {
    token,
    message: message || 'Heja!',
  }
}

function formatCheerTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getAvatarInitial(name?: string | null) {
  const normalized = String(name ?? '').trim()
  return normalized ? normalized.charAt(0).toUpperCase() : 'G'
}

function buildLeaderboard(args: {
  players: PlayerRow[]
  holes: HoleRow[]
  scores: ScoreRow[]
  scoringMode: RoundRow['scoring_mode']
  currentHole: number
  startHole: number
  endHole: number
}): LeaderRow[] {
  const {
    players,
    holes,
    scores,
    scoringMode,
    currentHole,
    startHole,
    endHole,
  } = args

  const leaderboardBase = players.map((player) => {
    const activeFrom = Math.max(player.active_from_hole ?? startHole, startHole)
    const activeTo = Math.min(player.active_to_hole ?? endHole, endHole)
    const holeWindowEnd = Math.min(currentHole, activeTo)
    const activeHoleIndexes = holes
      .filter((hole) => hole.hole_number >= activeFrom && hole.hole_number <= activeTo)
      .map((hole) => hole.hcp_index)

    const visibleScores = scores.filter((row) => {
      return (
        row.round_player_id === player.id &&
        row.hole_number >= activeFrom &&
        row.hole_number <= holeWindowEnd &&
        typeof row.strokes === 'number'
      )
    })

    const totalStrokes = visibleScores.reduce((sum, row) => sum + (row.strokes ?? 0), 0)
    const totalToPar = visibleScores.reduce((sum, row) => {
      const hole = holes.find((item) => item.hole_number === row.hole_number)
      if (!hole) return sum
      return sum + (scoreVsPar(row.strokes, hole.par) ?? 0)
    }, 0)

    const totalPoints = visibleScores.reduce((sum, row) => {
      const hole = holes.find((item) => item.hole_number === row.hole_number)
      if (!hole || row.strokes == null) return sum
      return (
        sum +
        stablefordPoints(
          row.strokes,
          hole.par,
          getReceivedStrokesForSelectedHole(
            player.playing_handicap ?? 0,
            activeHoleIndexes,
            hole.hcp_index
          )
        )
      )
    }, 0)

    return {
      playerId: player.id,
      name: player.display_name?.trim() || 'Spelare',
      holesPlayed: visibleScores.length,
      totalStrokes,
      totalToPar,
      totalPoints,
      sortOrder: player.sort_order ?? 9999,
    }
  })

  const sorted = [...leaderboardBase].sort((a, b) => {
    if (scoringMode === 'stableford') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
      if (a.holesPlayed !== b.holesPlayed) return b.holesPlayed - a.holesPlayed
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
      return a.name.localeCompare(b.name, 'sv')
    }

    if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
    if (a.totalToPar !== b.totalToPar) return a.totalToPar - b.totalToPar
    if (a.holesPlayed !== b.holesPlayed) return b.holesPlayed - a.holesPlayed
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
    return a.name.localeCompare(b.name, 'sv')
  })

  let lastPosition = 0
  const withPositions: LeaderRow[] = []

  for (let index = 0; index < sorted.length; index++) {
    const current = sorted[index]
    const previous = sorted[index - 1]

    const sameAsPrevious =
      !!previous &&
      (scoringMode === 'stableford'
        ? previous.totalPoints === current.totalPoints &&
          previous.totalStrokes === current.totalStrokes &&
          previous.holesPlayed === current.holesPlayed
        : previous.totalStrokes === current.totalStrokes &&
          previous.totalToPar === current.totalToPar &&
          previous.holesPlayed === current.holesPlayed)

    const position = sameAsPrevious ? lastPosition : index + 1
    lastPosition = position

    withPositions.push({
      playerId: current.playerId,
      name: current.name,
      holesPlayed: current.holesPlayed,
      totalStrokes: current.totalStrokes,
      totalPoints: current.totalPoints,
      totalToPar: current.totalToPar,
      position,
    })
  }

  return withPositions
}

export default async function RoundLivePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ message?: string; type?: string }>
}) {
  const { id } = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const flashMessage = resolvedSearchParams.message
    ? decodeURIComponent(String(resolvedSearchParams.message).replace(/\+/g, ' '))
    : ''
  const supabase = await createClient()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseAdmin =
    supabaseUrl && serviceRoleKey
      ? createAdminClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      : null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: roundFromUserClient } = await supabase
    .from('rounds')
    .select(
      'id, title, owner_id, course_id, status, scoring_mode, holes_mode, current_hole, start_hole, end_hole'
    )
    .eq('id', id)
    .maybeSingle()

  let roundRaw = roundFromUserClient

  if (!roundRaw && supabaseAdmin) {
    const { data: roundFromAdminClient } = await supabaseAdmin
      .from('rounds')
      .select(
        'id, title, owner_id, course_id, status, scoring_mode, holes_mode, current_hole, start_hole, end_hole'
      )
      .eq('id', id)
      .maybeSingle()

    roundRaw = roundFromAdminClient
  }

  if (!roundRaw) {
    notFound()
  }

  const round = roundRaw as RoundRow
  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? 18
  const currentHole = Math.min(
    Math.max(round.current_hole ?? startHole, startHole),
    endHole
  )

  const viewerEmail = String(user.email ?? '').trim().toLowerCase()
  const viewerIsOwner = round.owner_id === user.id

  const [{ data: membership }, { data: ownerProfileRaw }] = await Promise.all([
    supabase
      .from('round_members')
      .select('id')
      .eq('round_id', round.id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      ? supabaseAdmin
          .from('profiles')
          .select('email, display_name')
          .eq('id', round.owner_id)
          .maybeSingle()
      : supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', round.owner_id)
          .maybeSingle(),
  ])

  const ownerProfile = (ownerProfileRaw as OwnerProfileRow | null) ?? null
  const ownerEmail = String(ownerProfile?.email ?? '')
    .trim()
    .toLowerCase()

  let isFriendOfOwner = false

  if (!viewerIsOwner && !membership && viewerEmail) {
    const friendReadClient = supabaseAdmin ?? supabase

    const { data: directFriend } = await friendReadClient
      .from('friends')
      .select('id')
      .eq('user_id', round.owner_id)
      .eq('friend_email', viewerEmail)
      .maybeSingle()

    if (directFriend) {
      isFriendOfOwner = true
    } else if (ownerEmail) {
      const { data: reverseFriend } = await friendReadClient
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_email', ownerEmail)
        .maybeSingle()

      isFriendOfOwner = Boolean(reverseFriend)
    }
  }

  if (!viewerIsOwner && !membership && !isFriendOfOwner) {
    notFound()
  }

  const isFriendViewer = !viewerIsOwner && !membership && isFriendOfOwner
  const dataReadClient = isFriendViewer && supabaseAdmin ? supabaseAdmin : supabase

  const [
    { data: courseRaw },
    { data: holesRaw },
    { data: playersRaw },
    { data: scoresRaw },
    { data: roundMembersRaw },
  ] =
    await Promise.all([
      dataReadClient
        .from('courses')
        .select('name')
        .eq('id', round.course_id)
        .maybeSingle(),
      dataReadClient
        .from('course_holes')
        .select('hole_number, par, hcp_index')
        .eq('course_id', round.course_id)
        .gte('hole_number', startHole)
        .lte('hole_number', endHole)
        .order('hole_number'),
      dataReadClient
        .from('round_players')
        .select(
          'id, user_id, display_name, playing_handicap, active_from_hole, active_to_hole, sort_order'
        )
        .eq('round_id', round.id)
        .order('sort_order'),
      dataReadClient
        .from('hole_scores')
        .select('round_player_id, hole_number, strokes')
        .eq('round_id', round.id),
      dataReadClient
        .from('round_members')
        .select('user_id')
        .eq('round_id', round.id),
    ])

  const course = (courseRaw as CourseRow | null) ?? null
  const holes = (holesRaw as HoleRow[] | null) ?? []
  const players = (playersRaw as PlayerRow[] | null) ?? []
  const scores = (scoresRaw as ScoreRow[] | null) ?? []

  if (!course || holes.length === 0 || players.length === 0) {
    notFound()
  }

  const roundMemberUserIds = Array.from(
    new Set(
      (roundMembersRaw ?? [])
        .map((row) => String((row as { user_id?: string | null }).user_id ?? '').trim())
        .filter((id) => id.length > 0)
    )
  )

  let cheerEntries: CheerEntry[] = []

  if (roundMemberUserIds.length > 0) {
    const notificationReadClient = supabaseAdmin ?? supabase
    const { data: cheerRowsRaw } = await notificationReadClient
      .from('notifications')
      .select('id, actor_user_id, title, created_at')
      .in('user_id', roundMemberUserIds)
      .like('title', `HejaropRound:${round.id}:%`)
      .order('created_at', { ascending: false })
      .limit(80)

    const cheerRows = (cheerRowsRaw as CheerNotificationRow[] | null) ?? []
    const byToken = new Map<string, CheerEntry>()

    for (const row of cheerRows) {
      const parsed = parseCheerTitleForRound(row.title, round.id)
      const actorUserId = String(row.actor_user_id ?? '').trim()
      if (!parsed || !actorUserId) continue
      if (byToken.has(parsed.token)) continue

      byToken.set(parsed.token, {
        token: parsed.token,
        message: parsed.message,
        actorUserId,
        createdAt: row.created_at,
      })
    }

    cheerEntries = Array.from(byToken.values()).slice(0, 12)
  }

  const cheerActorIds = Array.from(
    new Set(cheerEntries.map((item) => item.actorUserId).filter((id) => id.length > 0))
  )

  let cheerActorById = new Map<string, CheerActorView>()

  if (cheerActorIds.length > 0) {
    const profileReadClient = supabaseAdmin ?? supabase
    const { data: cheerActorProfilesRaw } = await profileReadClient
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .in('id', cheerActorIds)

    const cheerActorProfiles = (cheerActorProfilesRaw as CheerActorProfile[] | null) ?? []
    cheerActorById = new Map(
      cheerActorProfiles.map((profile) => [
        profile.id,
        {
          name: profile.display_name?.trim() || profile.email?.trim() || 'En vän',
          avatarUrl: profile.avatar_url?.trim() || null,
        },
      ])
    )
  }

  const leaderboard = buildLeaderboard({
    players,
    holes,
    scores,
    scoringMode: round.scoring_mode,
    currentHole,
    startHole,
    endHole,
  })

  const ownerName = ownerProfile?.display_name?.trim() || ownerEmail || 'van'
  const currentHolePar = holes.find((hole) => hole.hole_number === currentHole)?.par ?? null

  return (
    <main>
      <div className="container" style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <div className="badge">Publik livevy</div>
              <h1 className="title" style={{ margin: 0 }}>
                {round.title}
              </h1>
              <div className="muted">
                {course.name} - {getScoringLabel(round.scoring_mode)} - {getModeLabel(round, startHole)}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
              <LiveAutoRefresh intervalMs={15000} />
              <Link className="button secondary" href={`/rounds/${round.id}/live`}>
                Uppdatera live
              </Link>
              <div className="muted" style={{ fontSize: 13 }}>
                Senast uppdaterad {getNowLabel()}
              </div>
            </div>
          </div>

          <div
            style={{
              border: '1px solid #dbe7dd',
              background: '#f8fbf9',
              borderRadius: 14,
              padding: 12,
              display: 'grid',
              gap: 4,
            }}
          >
            <div style={{ fontWeight: 800, color: '#1f3327' }}>
              Folj {ownerName}s runda live
            </div>
            <div className="muted" style={{ fontSize: 14 }}>
              Aktuellt hal: {currentHole}
              {currentHolePar ? ` - Par ${currentHolePar}` : ''} - Status: {round.status}
            </div>
          </div>

          {flashMessage ? (
            <div
              style={{
                borderRadius: 12,
                padding: '10px 12px',
                border: `1px solid ${
                  resolvedSearchParams.type === 'success' ? '#86efac' : '#fecaca'
                }`,
                background:
                  resolvedSearchParams.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: resolvedSearchParams.type === 'success' ? '#166534' : '#991b1b',
                fontWeight: 700,
              }}
            >
              {flashMessage}
            </div>
          ) : null}

          <form action={sendRoundCheer} style={{ display: 'grid', gap: 8 }}>
            <input type="hidden" name="round_id" value={round.id} />
            <input
              name="message"
              type="text"
              maxLength={140}
              placeholder="Skriv hejarop, t.ex. Lycka till eller Snart kommer birdien!"
              style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
            />
            <button type="submit" className="button">
              Skicka hejarop
            </button>
            <div className="muted" style={{ fontSize: 13 }}>
              Skickar en notis till spelarna i den har rundan.
            </div>
          </form>
        </div>

        <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Publikchat</h2>
          {cheerEntries.length === 0 ? (
            <div className="muted" style={{ fontSize: 14 }}>
              Inga hejarop annu. Skriv ett peppmeddelande ovan.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {cheerEntries.map((entry) => (
                <div
                  key={entry.token}
                  style={{
                    border: '1px solid #dbe7dd',
                    borderRadius: 12,
                    padding: 10,
                    background: '#f8fbf9',
                    display: 'grid',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '1px solid #d1d5db',
                        background: '#e8f2ea',
                        color: '#1f3327',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      {cheerActorById.get(entry.actorUserId)?.avatarUrl ? (
                        <img
                          src={cheerActorById.get(entry.actorUserId)?.avatarUrl ?? ''}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        getAvatarInitial(cheerActorById.get(entry.actorUserId)?.name ?? 'En vän')
                      )}
                    </div>
                    <div style={{ fontWeight: 800, color: '#1f3327' }}>
                      Hejarop - {cheerActorById.get(entry.actorUserId)?.name ?? 'En van'}
                    </div>
                  </div>
                  <div style={{ color: '#1f3327' }}>{entry.message}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {formatCheerTime(entry.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
          <h2 style={{ margin: 0 }}>Leaderboard just nu</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {leaderboard.map((entry) => (
              <div
                key={entry.playerId}
                style={{
                  border: '1px solid #dbe7dd',
                  borderRadius: 14,
                  padding: 12,
                  display: 'grid',
                  gap: 8,
                  background:
                    entry.position === 1
                      ? 'linear-gradient(180deg, #ecfdf3 0%, #f7fffb 100%)'
                      : '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 900, color: '#1f3327' }}>
                    #{entry.position} {entry.name}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Registrerade hal: {entry.holesPlayed}
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
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      background: '#fff',
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      Slag
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>{entry.totalStrokes}</div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      background: '#fff',
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      Till par
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>{formatVsPar(entry.totalToPar)}</div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      background: '#f0f6ff',
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12 }}>
                      Poang
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 24 }}>{entry.totalPoints}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}

