import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import LiveAutoRefresh from '@/components/live-auto-refresh'
import LiveCheerForm from '@/components/live-cheer-form'
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

type PlayerProfileView = {
  id: string
  display_name: string | null
  email: string | null
  avatar_url?: string | null
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
  return mode === 'stableford' ? 'Poängbogey' : 'Slagspel'
}

function getModeLabel(round: RoundRow, startHole: number) {
  if (round.holes_mode === 18) return '18 hål'
  return startHole === 1 ? '9 hål - Främre 9' : '9 hål - Bakre 9'
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

function UserAvatar({
  name,
  avatarUrl,
  size = 38,
}: {
  name?: string | null
  avatarUrl?: string | null
  size?: number
}) {
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
        fontSize: Math.max(12, Math.round(size * 0.42)),
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
        getAvatarInitial(name ?? 'Spelare')
      )}
    </div>
  )
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

  const playerUserIds = Array.from(
    new Set(players.map((player) => player.user_id).filter((id): id is string => !!id))
  )
  let playerProfileByUserId = new Map<string, PlayerProfileView>()

  if (playerUserIds.length > 0) {
    const profileReadClient = supabaseAdmin ?? supabase
    const { data: playerProfilesRaw } = await profileReadClient
      .from('profiles')
      .select('id, display_name, email, avatar_url')
      .in('id', playerUserIds)

    const playerProfiles = (playerProfilesRaw as PlayerProfileView[] | null) ?? []
    playerProfileByUserId = new Map(playerProfiles.map((profile) => [profile.id, profile]))
  }

  const scoreByPlayerHole = new Map<string, ScoreRow>()
  for (const row of scores) {
    scoreByPlayerHole.set(`${row.round_player_id}:${row.hole_number}`, row)
  }

  const playerById = new Map(players.map((player) => [player.id, player]))
  const ownerName = ownerProfile?.display_name?.trim() || ownerEmail || 'vän'
  const currentHolePar = holes.find((hole) => hole.hole_number === currentHole)?.par ?? null

  const playedHoles = holes.filter(
    (hole) => hole.hole_number >= startHole && hole.hole_number <= currentHole
  )
  const currentHoleInfo = holes.find((hole) => hole.hole_number === currentHole) ?? null
  const nextHoleInfo = holes.find((hole) => hole.hole_number > currentHole) ?? null
  const totalRoundHoles = Math.max(1, endHole - startHole + 1)
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((currentHole - startHole + 1) / totalRoundHoles) * 100))
  )
  const leader = leaderboard[0]
  const secondPlace = leaderboard[1]
  const scoreUnit = round.scoring_mode === 'stableford' ? 'p' : 'slag'
  const getPrimaryScore = (entry: LeaderRow) =>
    round.scoring_mode === 'stableford' ? `${entry.totalPoints} p` : `${entry.totalStrokes} slag`
  const getScoreDelta = (entry: LeaderRow) =>
    `${formatVsPar(entry.totalToPar)} mot par · ${entry.holesPlayed}/${totalRoundHoles} hål`
  const statusText = round.status === 'active' ? 'Live just nu' : round.status

  return (
    <main>
      <style>{`
        .premium-live-shell {
          --green-950: #0e2418;
          --green-900: #123421;
          --green-800: #176536;
          --green-700: #16853e;
          --green-100: #eaf8ee;
          --green-50: #f5fbf6;
          --sand: #f7f4ec;
          --ink: #102016;
          --muted: #607367;
          --line: rgba(18, 52, 33, 0.12);
          --shadow: 0 18px 50px rgba(18, 52, 33, 0.14);
          width: min(940px, 100%);
          margin: 0 auto;
          padding: calc(env(safe-area-inset-top) + 8px) 14px calc(env(safe-area-inset-bottom) + 92px);
          display: grid;
          gap: 14px;
          color: var(--ink);
        }

        .premium-live-topbar {
          position: sticky;
          top: max(0px, calc(env(safe-area-inset-top) - 2px));
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 0 6px;
          backdrop-filter: blur(18px);
        }

        .premium-icon-button {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.82);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--green-900);
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 8px 24px rgba(18, 52, 33, 0.08);
        }

        .premium-pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          width: fit-content;
          border: 1px solid rgba(22, 133, 62, 0.16);
          background: rgba(234, 248, 238, 0.9);
          color: #146b38;
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.01em;
        }

        .premium-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #ef4444;
          box-shadow: 0 0 0 7px rgba(239, 68, 68, 0.12);
        }

        .premium-hero {
          position: relative;
          overflow: hidden;
          border-radius: 32px;
          padding: 22px;
          color: white;
          background:
            radial-gradient(circle at 18% 10%, rgba(94, 234, 140, 0.38), transparent 31%),
            linear-gradient(145deg, #07170f 0%, #123421 48%, #16853e 100%);
          box-shadow: var(--shadow);
          isolation: isolate;
        }

        .premium-hero::after {
          content: '';
          position: absolute;
          inset: auto -30% -45% -30%;
          height: 58%;
          background: radial-gradient(circle, rgba(255,255,255,0.22), transparent 60%);
          z-index: -1;
        }

        .premium-hero-kicker {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .premium-hero h1 {
          margin: 0;
          font-size: clamp(33px, 8vw, 58px);
          line-height: 0.95;
          letter-spacing: -0.07em;
          max-width: 680px;
        }

        .premium-hero-subtitle {
          margin: 12px 0 0;
          color: rgba(255,255,255,0.78);
          font-size: clamp(15px, 4vw, 18px);
          line-height: 1.35;
        }

        .premium-hero-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 12px;
          margin-top: 20px;
        }

        .premium-glass-card {
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.12);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.18);
          border-radius: 22px;
          padding: 16px;
          backdrop-filter: blur(20px);
        }

        .premium-hero-label {
          color: rgba(255,255,255,0.72);
          font-size: 13px;
          font-weight: 800;
        }

        .premium-hero-score {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          margin-top: 8px;
          line-height: 1;
        }

        .premium-hero-score strong {
          font-size: clamp(40px, 11vw, 68px);
          letter-spacing: -0.08em;
        }

        .premium-hero-score span {
          padding-bottom: 9px;
          color: rgba(255,255,255,0.78);
          font-weight: 900;
        }

        .premium-progress-track {
          height: 9px;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(255,255,255,0.18);
          margin-top: 13px;
        }

        .premium-progress-fill {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #bbf7d0, #ffffff);
        }

        .premium-section {
          border: 1px solid var(--line);
          border-radius: 28px;
          padding: 18px;
          background: rgba(255,255,255,0.9);
          box-shadow: 0 12px 34px rgba(18, 52, 33, 0.08);
          display: grid;
          gap: 14px;
        }

        .premium-section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10px;
        }

        .premium-section h2 {
          margin: 0;
          font-size: clamp(23px, 6vw, 34px);
          letter-spacing: -0.055em;
          line-height: 1;
        }

        .premium-muted {
          color: var(--muted);
          font-weight: 650;
        }

        .premium-leaderboard {
          display: grid;
          gap: 9px;
        }

        .premium-rank-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: linear-gradient(180deg, #fff 0%, #f7fbf8 100%);
        }

        .premium-rank-row.is-leader {
          background: linear-gradient(135deg, #e9fbef 0%, #ffffff 100%);
          border-color: rgba(22, 133, 62, 0.26);
        }

        .premium-rank-number {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--green-100);
          color: var(--green-800);
          font-weight: 950;
        }

        .premium-rank-name {
          font-size: 17px;
          font-weight: 950;
          letter-spacing: -0.03em;
        }

        .premium-rank-score {
          text-align: right;
          font-weight: 950;
          font-size: 18px;
          white-space: nowrap;
        }

        .premium-now-card {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 24px;
          background: linear-gradient(135deg, var(--green-50) 0%, #fff 100%);
          border: 1px solid rgba(22, 133, 62, 0.16);
        }

        .premium-now-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .premium-stat-tile {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 12px;
          background: rgba(255,255,255,0.8);
        }

        .premium-stat-tile span {
          display: block;
          color: var(--muted);
          font-size: 12px;
          font-weight: 850;
        }

        .premium-stat-tile strong {
          display: block;
          margin-top: 5px;
          color: var(--green-950);
          font-size: 24px;
          line-height: 1;
          letter-spacing: -0.05em;
        }

        .premium-score-strip {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 7px;
        }

        .premium-hole-chip {
          min-height: 62px;
          border: 1px solid var(--line);
          border-radius: 16px;
          background: #fff;
          padding: 9px 7px;
          display: grid;
          align-content: center;
          gap: 3px;
          text-align: center;
        }

        .premium-hole-chip.is-current {
          border-color: rgba(22, 133, 62, 0.45);
          background: #ecfdf3;
          box-shadow: 0 8px 20px rgba(22, 133, 62, 0.1);
        }

        .premium-hole-chip span {
          font-size: 10px;
          color: var(--muted);
          font-weight: 850;
        }

        .premium-hole-chip strong {
          font-size: 19px;
          color: var(--green-950);
          line-height: 1;
        }

        .premium-player-card {
          border: 1px solid var(--line);
          border-radius: 26px;
          background: #fff;
          overflow: hidden;
        }

        .premium-player-head {
          padding: 14px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: center;
          background: linear-gradient(180deg, #f8fbf9 0%, #fff 100%);
        }

        .premium-player-card.is-leader .premium-player-head {
          background: linear-gradient(135deg, #e7fbef 0%, #ffffff 100%);
        }

        .premium-player-name {
          font-size: 20px;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .premium-player-score {
          text-align: right;
          font-weight: 950;
          font-size: 22px;
          letter-spacing: -0.05em;
          color: var(--green-900);
        }

        .premium-player-body {
          display: grid;
          gap: 12px;
          padding: 14px;
        }

        .premium-details summary {
          cursor: pointer;
          list-style: none;
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 13px 14px;
          color: var(--green-900);
          background: var(--green-50);
          font-weight: 950;
          text-align: center;
        }

        .premium-details summary::-webkit-details-marker {
          display: none;
        }

        .premium-full-grid {
          margin-top: 10px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .premium-cheer-form {
          display: grid;
          gap: 10px;
        }

        .premium-input {
          width: 100%;
          min-height: 52px;
          border-radius: 18px;
          border: 1px solid var(--line);
          background: #fff;
          padding: 0 14px;
          font: inherit;
          font-weight: 750;
          color: var(--green-950);
        }

        .premium-button {
          min-height: 52px;
          border: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, #16853e 0%, #38c160 100%);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          font-weight: 950;
          font-size: 16px;
          text-decoration: none;
          box-shadow: 0 12px 26px rgba(22, 133, 62, 0.22);
        }

        .premium-button.secondary {
          background: #fff;
          color: var(--green-900);
          border: 1px solid var(--line);
          box-shadow: none;
        }

        .premium-quick-cheers {
          display: flex;
          gap: 10px;
          overflow-x: auto;
          padding: 2px 2px 8px;
          margin-inline: -2px;
          scroll-padding-inline: 12px;
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
          mask-image: linear-gradient(90deg, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%);
        }

        .premium-quick-cheers::-webkit-scrollbar {
          display: none;
        }

        .premium-quick-cheers button {
          flex: 0 0 92px;
          min-height: 82px;
          border: 1px solid rgba(22, 133, 62, 0.18);
          background: linear-gradient(180deg, #f8fffa 0%, #eef9f1 100%);
          color: var(--green-900);
          border-radius: 22px;
          padding: 10px 8px;
          font-weight: 950;
          font-size: 13px;
          line-height: 1.1;
          white-space: normal;
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 7px;
          text-align: center;
          scroll-snap-align: start;
          box-shadow: 0 8px 18px rgba(22, 62, 38, 0.06);
        }

        .premium-quick-cheers button:active {
          transform: translateY(1px);
        }

        .premium-cheer-emoji {
          font-size: 25px;
          line-height: 1;
        }

        .premium-cheer-label {
          display: block;
        }

        .premium-chat-list {
          display: grid;
          gap: 9px;
        }

        .premium-chat-item {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 10px;
          border: 1px solid var(--line);
          border-radius: 20px;
          padding: 12px;
          background: #fff;
        }

        .premium-flash {
          border-radius: 18px;
          padding: 12px 14px;
          font-weight: 900;
        }

        .premium-bottom-bar {
          position: fixed;
          left: 50%;
          bottom: 12px;
          transform: translateX(-50%);
          width: min(920px, calc(100% - 24px));
          z-index: 40;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          padding: 10px;
          border-radius: 24px;
          background: rgba(255,255,255,0.86);
          border: 1px solid var(--line);
          box-shadow: 0 18px 42px rgba(18, 52, 33, 0.18);
          backdrop-filter: blur(18px);
        }

        @media (max-width: 720px) {
          .container {
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          .premium-live-shell {
            gap: 12px;
            padding-left: 10px;
            padding-right: 10px;
            padding-bottom: calc(env(safe-area-inset-bottom) + 88px);
          }

          .premium-hero {
            border-radius: 26px;
            padding: 18px;
          }

          .premium-hero-grid {
            grid-template-columns: 1fr;
          }

          .premium-section {
            border-radius: 22px;
            padding: 14px;
          }

          .premium-now-grid {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .premium-score-strip {
            grid-template-columns: repeat(6, minmax(56px, 1fr));
            overflow-x: auto;
            padding-bottom: 3px;
          }

          .premium-player-head {
            grid-template-columns: auto 1fr;
          }

          .premium-player-score {
            grid-column: 1 / -1;
            text-align: left;
            padding-left: 58px;
            margin-top: -8px;
          }

          .premium-bottom-bar {
            width: calc(100% - 20px);
            bottom: calc(env(safe-area-inset-bottom) + 8px);
            border-radius: 20px;
            padding: 8px;
          }
        }

        @media (max-width: 420px) {
          .premium-hero h1 {
            font-size: clamp(30px, 10vw, 40px);
          }

          .premium-now-grid {
            grid-template-columns: 1fr;
          }

          .premium-full-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .premium-pill {
            font-size: 12px;
            padding: 6px 10px;
          }
        }
      `}</style>

      <div className="premium-live-shell">
        <div className="premium-live-topbar">
          <Link className="premium-icon-button" href="/dashboard" aria-label="Till startsidan">
            ←
          </Link>
          <div className="premium-pill"><span className="premium-live-dot" /> {statusText}</div>
          <Link className="premium-icon-button" href={`/rounds/${round.id}/live`} aria-label="Uppdatera live">
            ↻
          </Link>
        </div>

        <section className="premium-hero" aria-labelledby="live-title">
          <div className="premium-hero-kicker">
            <div className="premium-pill" style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }}>
              {getScoringLabel(round.scoring_mode)} · {getModeLabel(round, startHole)}
            </div>
            <LiveAutoRefresh intervalMs={15000} />
          </div>

          <h1 id="live-title">{round.title}</h1>
          <p className="premium-hero-subtitle">
            {course.name} · Följ {ownerName}s runda live · uppdaterad {getNowLabel()}
          </p>

          <div className="premium-hero-grid">
            <div className="premium-glass-card">
              <div className="premium-hero-label">Ledare just nu</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                {leader ? (
                  <>
                    <UserAvatar
                      name={leader.name}
                      avatarUrl={
                        playerById.get(leader.playerId)?.user_id
                          ? playerProfileByUserId.get(playerById.get(leader.playerId)?.user_id ?? '')?.avatar_url ?? null
                          : null
                      }
                      size={54}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: 24, letterSpacing: '-0.05em' }}>
                        🏆 {leader.name}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 800 }}>
                        {getScoreDelta(leader)}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              {leader ? (
                <div className="premium-hero-score">
                  <strong>{round.scoring_mode === 'stableford' ? leader.totalPoints : leader.totalStrokes}</strong>
                  <span>{scoreUnit}</span>
                </div>
              ) : null}
            </div>

            <div className="premium-glass-card">
              <div className="premium-hero-label">Aktuellt läge</div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 950, letterSpacing: '-0.06em' }}>
                Hål {currentHole}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.74)', fontWeight: 850 }}>
                {currentHoleInfo ? `Par ${currentHoleInfo.par} · HCP ${currentHoleInfo.hcp_index}` : 'Aktivt hål'}
              </div>
              <div className="premium-progress-track" aria-label={`Rundan är ${progressPercent}% klar`}>
                <div className="premium-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <div style={{ marginTop: 8, color: 'rgba(255,255,255,0.74)', fontSize: 13, fontWeight: 800 }}>
                {playedHoles.length}/{totalRoundHoles} hål synliga {nextHoleInfo ? `· nästa hål ${nextHoleInfo.hole_number}` : ''}
              </div>
            </div>
          </div>
        </section>

        {flashMessage ? (
          <div
            className="premium-flash"
            style={{
              border: `1px solid ${resolvedSearchParams.type === 'success' ? '#86efac' : '#fecaca'}`,
              background: resolvedSearchParams.type === 'success' ? '#f0fdf4' : '#fef2f2',
              color: resolvedSearchParams.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {flashMessage}
          </div>
        ) : null}

        <section className="premium-section" aria-labelledby="leaderboard-title">
          <div className="premium-section-header">
            <div>
              <h2 id="leaderboard-title">Leaderboard</h2>
              <div className="premium-muted" style={{ marginTop: 6 }}>
                Snabb överblick utan att behöva scrolla.
              </div>
            </div>
            <div className="premium-pill">{players.length} spelare</div>
          </div>

          <div className="premium-leaderboard">
            {leaderboard.map((entry) => (
              <div
                key={`rank:${entry.playerId}`}
                className={`premium-rank-row ${entry.position === 1 ? 'is-leader' : ''}`}
              >
                <div className="premium-rank-number">{entry.position}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="premium-rank-name">{entry.position === 1 ? '🏆 ' : ''}{entry.name}</div>
                  <div className="premium-muted" style={{ fontSize: 13 }}>
                    {getScoreDelta(entry)}
                  </div>
                </div>
                <div className="premium-rank-score">{getPrimaryScore(entry)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="premium-section" aria-labelledby="now-title">
          <div className="premium-section-header">
            <div>
              <h2 id="now-title">Just nu</h2>
              <div className="premium-muted" style={{ marginTop: 6 }}>
                Fokuserar på hålet som spelas – resten ligger i detaljer.
              </div>
            </div>
            <div className="premium-pill">Hål {currentHole}</div>
          </div>

          <div className="premium-now-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 950, letterSpacing: '-0.055em' }}>
                  {currentHoleInfo ? `Par ${currentHoleInfo.par}` : 'Aktivt hål'}
                </div>
                <div className="premium-muted">
                  {currentHoleInfo ? `Index ${currentHoleInfo.hcp_index}` : 'Liveuppdatering pågår'}
                </div>
              </div>
              {secondPlace && leader ? (
                <div className="premium-pill">
                  Avstånd: {round.scoring_mode === 'stableford'
                    ? `${Math.abs(leader.totalPoints - secondPlace.totalPoints)} p`
                    : `${Math.abs(leader.totalStrokes - secondPlace.totalStrokes)} slag`}
                </div>
              ) : null}
            </div>

            <div className="premium-now-grid">
              {leaderboard.slice(0, 3).map((entry) => {
                const currentScore = scoreByPlayerHole.get(`${entry.playerId}:${currentHole}`)
                const strokes = typeof currentScore?.strokes === 'number' ? currentScore.strokes : null
                const player = playerById.get(entry.playerId)
                const activeHoleIndexes = holes
                  .filter((h) => {
                    if (!player) return false
                    const from = Math.max(player.active_from_hole ?? startHole, startHole)
                    const to = Math.min(player.active_to_hole ?? endHole, endHole)
                    return h.hole_number >= from && h.hole_number <= to
                  })
                  .map((h) => h.hcp_index)
                const points =
                  strokes !== null && currentHoleInfo
                    ? stablefordPoints(
                        strokes,
                        currentHoleInfo.par,
                        getReceivedStrokesForSelectedHole(
                          player?.playing_handicap ?? 0,
                          activeHoleIndexes,
                          currentHoleInfo.hcp_index
                        )
                      )
                    : null

                return (
                  <div key={`now:${entry.playerId}`} className="premium-stat-tile">
                    <span>{entry.name}</span>
                    <strong>{strokes ?? '–'}</strong>
                    <div className="premium-muted" style={{ fontSize: 12, marginTop: 5 }}>
                      {points !== null ? `${points} p på hålet` : 'Väntar på score'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="premium-section" aria-labelledby="players-title">
          <div className="premium-section-header">
            <div>
              <h2 id="players-title">Spelare</h2>
              <div className="premium-muted" style={{ marginTop: 6 }}>
                Senaste hålen först. Fullt scorekort ligger bakom ett tryck.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {leaderboard.map((entry) => {
              const player = playerById.get(entry.playerId)
              const avatarUrl = player?.user_id
                ? playerProfileByUserId.get(player.user_id)?.avatar_url ?? null
                : null
              const previewHoles = playedHoles.slice(-6)
              const activeHoleIndexes = holes
                .filter((h) => {
                  if (!player) return false
                  const from = Math.max(player.active_from_hole ?? startHole, startHole)
                  const to = Math.min(player.active_to_hole ?? endHole, endHole)
                  return h.hole_number >= from && h.hole_number <= to
                })
                .map((h) => h.hcp_index)

              return (
                <article
                  key={`player:${entry.playerId}`}
                  className={`premium-player-card ${entry.position === 1 ? 'is-leader' : ''}`}
                >
                  <div className="premium-player-head">
                    <UserAvatar name={entry.name} avatarUrl={avatarUrl} size={48} />
                    <div style={{ minWidth: 0 }}>
                      <div className="premium-player-name">#{entry.position} {entry.name}</div>
                      <div className="premium-muted" style={{ fontSize: 13 }}>
                        {getScoreDelta(entry)}
                      </div>
                    </div>
                    <div className="premium-player-score">{getPrimaryScore(entry)}</div>
                  </div>

                  <div className="premium-player-body">
                    <div className="premium-score-strip" aria-label={`Senaste hål för ${entry.name}`}>
                      {previewHoles.map((hole) => {
                        const score = scoreByPlayerHole.get(`${entry.playerId}:${hole.hole_number}`)
                        const strokes = typeof score?.strokes === 'number' ? score.strokes : null
                        const points =
                          strokes !== null
                            ? stablefordPoints(
                                strokes,
                                hole.par,
                                getReceivedStrokesForSelectedHole(
                                  player?.playing_handicap ?? 0,
                                  activeHoleIndexes,
                                  hole.hcp_index
                                )
                              )
                            : null

                        return (
                          <div
                            key={`preview:${entry.playerId}:${hole.hole_number}`}
                            className={`premium-hole-chip ${hole.hole_number === currentHole ? 'is-current' : ''}`}
                          >
                            <span>Hål {hole.hole_number}</span>
                            <strong>{strokes ?? '–'}</strong>
                            <span>{points !== null ? `${points} p` : 'Ingen score'}</span>
                          </div>
                        )
                      })}
                    </div>

                    <details className="premium-details">
                      <summary>Visa alla hål för {entry.name}</summary>
                      <div className="premium-full-grid">
                        {playedHoles.map((hole) => {
                          const score = scoreByPlayerHole.get(`${entry.playerId}:${hole.hole_number}`)
                          const strokes = typeof score?.strokes === 'number' ? score.strokes : null
                          const points =
                            strokes !== null
                              ? stablefordPoints(
                                  strokes,
                                  hole.par,
                                  getReceivedStrokesForSelectedHole(
                                    player?.playing_handicap ?? 0,
                                    activeHoleIndexes,
                                    hole.hcp_index
                                  )
                                )
                              : null

                          return (
                            <div
                              key={`full:${entry.playerId}:${hole.hole_number}`}
                              className={`premium-hole-chip ${hole.hole_number === currentHole ? 'is-current' : ''}`}
                            >
                              <span>Hål {hole.hole_number} · Par {hole.par}</span>
                              <strong>{strokes ?? '–'}</strong>
                              <span>{points !== null ? `${points} p` : 'Ingen score'}</span>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="premium-section" aria-labelledby="cheer-title">
          <div className="premium-section-header">
            <div>
              <h2 id="cheer-title">Heja på</h2>
              <div className="premium-muted" style={{ marginTop: 6 }}>
                Skicka ett snabbt pepp – spelarna får en notis.
              </div>
            </div>
          </div>

          <LiveCheerForm
            roundId={round.id}
            sendAction={sendRoundCheer}
            quickCheers={[
              { label: 'Snyggt!', emoji: '👏', message: 'Snyggt kämpat! 🔥' },
              { label: 'Kämpa!', emoji: '💪', message: 'Kämpa på! 💪' },
              { label: 'Birdie!', emoji: '🐦', message: 'Nu kommer birdien! 🐦' },
              { label: 'Stabilt!', emoji: '⛳️', message: 'Stabilt spel ⛳️' },
              { label: 'Kom igen!', emoji: '🙌', message: 'Kom igen! 🙌' },
            ]}
          />
        </section>

        <section className="premium-section" aria-labelledby="chat-title">
          <div className="premium-section-header">
            <div>
              <h2 id="chat-title">Publikchat</h2>
              <div className="premium-muted" style={{ marginTop: 6 }}>
                Senaste peppen från vänner.
              </div>
            </div>
          </div>

          {cheerEntries.length === 0 ? (
            <div className="premium-now-card">
              <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: '-0.04em' }}>
                Inga hejarop ännu
              </div>
              <div className="premium-muted">Bli först med att skicka lite energi till rundan.</div>
            </div>
          ) : (
            <div className="premium-chat-list">
              {cheerEntries.map((entry) => (
                <div key={entry.token} className="premium-chat-item">
                  <UserAvatar
                    name={cheerActorById.get(entry.actorUserId)?.name ?? 'En vän'}
                    avatarUrl={cheerActorById.get(entry.actorUserId)?.avatarUrl ?? null}
                    size={40}
                  />
                  <div>
                    <div style={{ fontWeight: 950, color: '#102016' }}>
                      {cheerActorById.get(entry.actorUserId)?.name ?? 'En vän'}
                    </div>
                    <div style={{ marginTop: 3 }}>{entry.message}</div>
                    <div className="premium-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {formatCheerTime(entry.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="premium-bottom-bar" aria-label="Snabbval">
        <Link className="premium-button secondary" href={`/rounds/${round.id}/summary?hole=${currentHole}&from=live`}>
          Scorekort
        </Link>
        <Link className="premium-button" href={`/rounds/${round.id}/live`}>
          Uppdatera
        </Link>
      </div>
    </main>
  )
}
