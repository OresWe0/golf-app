import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  getReceivedStrokesForSelectedHole,
  scoreVsPar,
  stablefordPoints,
} from '@/lib/scoring'

type HoleLike = {
  hole_number: number
  par: number
  hcp_index: number
}

type RoundPlayer = {
  id: string
  display_name?: string
  exact_handicap?: number | null
  playing_handicap?: number | null
  tee_key?: string
  active_from_hole?: number | null
  active_to_hole?: number | null
}

type HoleScoreRow = {
  round_player_id: string
  hole_number: number
  strokes: number | null
}

type RoundLike = {
  id: string
  title: string
  course_id: string
  owner_id: string
  current_hole: number | null
  start_hole: number | null
  end_hole: number | null
  holes_mode: number
  scoring_mode: 'stableford' | 'strokeplay'
}

type CourseLike = {
  id: string
  name: string
}

type OwnerProfileLike = {
  email: string | null
}

type LeaderboardEntry = {
  playerId: string
  playerName: string
  position: number
  scoreText: string
  totalPoints: number
  totalToPar: number
  totalStrokes: number
  isLeader: boolean
}

type PlayerTotals = {
  totalPar: number
  totalStrokes: number
  totalToPar: number
  totalNet: number
  netToPar: number
  playedHoles: number
}

function parseHoleNumber(value?: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.floor(parsed)
}

function getRoundModeLabel(round: RoundLike, startHole: number) {
  if (round.holes_mode === 18) return '18 hål'
  return startHole === 1 ? '9 hål · Främre 9' : '9 hål · Bakre 9'
}

function getVisibleHoles(holes: HoleLike[], startHole: number, endHole: number) {
  return holes.filter(
    (item) => item.hole_number >= startHole && item.hole_number <= endHole
  )
}

function isPlayerActiveOnHole(
  player: RoundPlayer,
  holeNumber: number,
  startHole: number,
  endHole: number
) {
  const activeFrom = player.active_from_hole ?? startHole
  const activeTo = player.active_to_hole ?? endHole
  return holeNumber >= activeFrom && holeNumber <= activeTo
}

function formatToPar(value?: number | null) {
  if (value == null || value === 0) return 'E'
  return value > 0 ? `+${value}` : `${value}`
}

function getMedal(position: number) {
  if (position === 1) return '🥇'
  if (position === 2) return '🥈'
  if (position === 3) return '🥉'
  return `${position}.`
}

function getScoreLabel(strokes: number | null, par: number) {
  if (strokes == null) return '-'
  const diff = strokes - par
  if (diff <= -2) return 'EAGLE+'
  if (diff === -1) return 'BIRDIE'
  if (diff === 0) return 'PAR'
  if (diff === 1) return 'BOGEY'
  return 'DOUBLE+'
}

function getScoreColor(strokes: number | null, par: number) {
  if (strokes == null) return undefined
  const diff = strokes - par
  if (diff <= -2) return '#155da8'
  if (diff === -1) return '#3f8ee8'
  if (diff === 1) return '#f04b56'
  if (diff >= 2) return '#0f4f8f'
  return undefined
}

function buildRowsByHole(scoreRows: HoleScoreRow[], playerId: string) {
  return new Map(
    scoreRows
      .filter((row) => row.round_player_id === playerId)
      .map((row) => [row.hole_number, row])
  )
}

function calculatePlayerTotals(params: {
  player: RoundPlayer
  holes: HoleLike[]
  scoreRows: HoleScoreRow[]
}) {
  const { player, holes, scoreRows } = params
  const rowsByHole = buildRowsByHole(scoreRows, player.id)
  const hcpIndexes = holes.map((hole) => hole.hcp_index)

  return holes.reduce<PlayerTotals>(
    (totals, hole) => {
      const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
      const receivedStrokes = getReceivedStrokesForSelectedHole(
        player.playing_handicap ?? 0,
        hcpIndexes,
        hole.hcp_index
      )
      const netStrokes = strokes == null ? null : Math.max(1, strokes - receivedStrokes)

      return {
        totalPar: totals.totalPar + hole.par,
        totalStrokes: totals.totalStrokes + (strokes ?? 0),
        totalToPar: totals.totalToPar + (scoreVsPar(strokes, hole.par) ?? 0),
        totalNet: totals.totalNet + (netStrokes ?? 0),
        netToPar: totals.netToPar + (scoreVsPar(netStrokes, hole.par) ?? 0),
        playedHoles: totals.playedHoles + (strokes == null ? 0 : 1),
      }
    },
    { totalPar: 0, totalStrokes: 0, totalToPar: 0, totalNet: 0, netToPar: 0, playedHoles: 0 }
  )
}

function buildLeaderboard(params: {
  players: RoundPlayer[]
  scoreRows: HoleScoreRow[]
  visibleHoles: HoleLike[]
  selectedHoleIndexes: number[]
  scoringMode: RoundLike['scoring_mode']
  startHole: number
  endHole: number
}): LeaderboardEntry[] {
  const {
    players,
    scoreRows,
    visibleHoles,
    selectedHoleIndexes,
    scoringMode,
    startHole,
    endHole,
  } = params

  const playerById = new Map(players.map((player) => [String(player.id), player]))

  const leaderboardBase = players.map((player) => {
    const rows = scoreRows.filter(
      (row) =>
        row.round_player_id === player.id &&
        row.hole_number >= startHole &&
        row.hole_number <= endHole
    )

    const totalStrokes = rows.reduce((sum, row) => sum + (row.strokes ?? 0), 0)

    const totalToPar = rows.reduce((sum, row) => {
      const hole = visibleHoles.find((item) => item.hole_number === row.hole_number)
      return sum + (hole ? (scoreVsPar(row.strokes, hole.par) ?? 0) : 0)
    }, 0)

    const totalPoints = rows.reduce((sum, row) => {
      const hole = visibleHoles.find((item) => item.hole_number === row.hole_number)
      if (!hole || row.strokes == null) return sum

      return (
        sum +
        stablefordPoints(
          row.strokes,
          hole.par,
          getReceivedStrokesForSelectedHole(
            player.playing_handicap ?? 0,
            selectedHoleIndexes,
            hole.hcp_index
          )
        )
      )
    }, 0)

    return {
      playerId: String(player.id),
      totalStrokes,
      totalToPar,
      totalPoints,
    }
  })

  const sortedLeaderboard = [...leaderboardBase].sort((a, b) => {
    if (scoringMode === 'stableford') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
      return a.playerId.localeCompare(b.playerId)
    }

    if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes
    if (a.totalToPar !== b.totalToPar) return a.totalToPar - b.totalToPar
    return a.playerId.localeCompare(b.playerId)
  })

  const leaderboard: LeaderboardEntry[] = []
  let lastPosition = 0

  for (let index = 0; index < sortedLeaderboard.length; index++) {
    const entry = sortedLeaderboard[index]
    const previous = sortedLeaderboard[index - 1]

    const sameAsPrevious =
      previous &&
      (scoringMode === 'stableford'
        ? previous.totalPoints === entry.totalPoints &&
          previous.totalStrokes === entry.totalStrokes
        : previous.totalStrokes === entry.totalStrokes &&
          previous.totalToPar === entry.totalToPar)

    const position = sameAsPrevious ? lastPosition : index + 1
    lastPosition = position

    const player = playerById.get(entry.playerId)
    const scoreText =
      scoringMode === 'stableford'
        ? `${entry.totalPoints} p`
        : `${entry.totalStrokes} slag`

    leaderboard.push({
      playerId: entry.playerId,
      playerName: player?.display_name ?? 'Spelare',
      position,
      scoreText,
      totalPoints: entry.totalPoints,
      totalToPar: entry.totalToPar,
      totalStrokes: entry.totalStrokes,
      isLeader: position === 1,
    })
  }

  return leaderboard
}

function SummaryHero({
  roundTitle,
  courseName,
  modeLabel,
  currentHoleNumber,
  totalHoles,
  roundId,
}: {
  roundTitle: string
  courseName: string
  modeLabel: string
  currentHoleNumber: number
  totalHoles: number
  roundId: string
}) {
  return (
    <section className="summary-hero" style={{ textAlign: 'center', padding: '18px 8px 10px' }}>
      <div
        className="summary-hero-grid"
        style={{ display: 'grid', gridTemplateColumns: '56px 1fr 56px', alignItems: 'center', gap: 10 }}
      >
        <Link
          href={`/rounds/${roundId}?hole=${currentHoleNumber}`}
          aria-label="Tillbaka till rundan"
          className="summary-back-button"
          style={{
            width: 52,
            height: 52,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 999,
            background: '#f3f3f7',
            color: '#263238',
            textDecoration: 'none',
            fontSize: 34,
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ‹
        </Link>

        <div style={{ minWidth: 0 }} className="summary-hero-title-wrap">
          <h1
            className="summary-title"
            style={{ margin: 0, fontSize: 'clamp(28px, 7vw, 42px)', lineHeight: 1.05, fontWeight: 950 }}
          >
            {roundTitle}
          </h1>
          <p className="summary-course" style={{ margin: '3px 0 0', color: '#56645b', fontSize: 20, fontWeight: 800 }}>
            {courseName}
          </p>
        </div>

        <div className="summary-brand" style={{ color: '#166534', fontSize: 22, fontWeight: 950, lineHeight: 0.92, textAlign: 'right' }}>
          GOLF<br />RUNDAN
        </div>
      </div>

      <div className="summary-pills" style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <span className="summary-pill" style={pillStyle}>🏆 Leaderboard</span>
        <span className="summary-pill" style={pillStyle}>{modeLabel}</span>
        <span className="summary-pill" style={pillStyle}>Hål {currentHoleNumber}/{totalHoles}</span>
      </div>
    </section>
  )
}

function GameTabs({ scoringMode }: { scoringMode: RoundLike['scoring_mode'] }) {
  const activeLabel = scoringMode === 'stableford' ? 'Poängbogey NET' : 'Slagspel NET'
  const inactiveLabel = scoringMode === 'stableford' ? 'Slagspel NET' : 'Poängbogey NET'

  return (
    <div className="game-tabs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: 8, boxShadow: '0 8px 22px rgba(0,0,0,0.12)', borderRadius: '18px 18px 0 0', overflow: 'hidden' }}>
      <div className="game-tab game-tab-active" style={{ padding: '17px 10px', textAlign: 'center', background: '#13ad6b', color: '#fff', fontSize: 22, fontWeight: 950 }}>
        {activeLabel}
      </div>
      <div className="game-tab game-tab-inactive" style={{ padding: '17px 10px', textAlign: 'center', background: '#d9d9d9', color: '#3e4640', fontSize: 22, fontWeight: 950 }}>
        {inactiveLabel}
      </div>
    </div>
  )
}

function CompactLeaderboard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  return (
    <section
      className="compact-leaderboard premium-leaderboard"
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid rgba(22, 101, 52, 0.15)',
        background: '#ffffff',
        boxShadow: '0 12px 26px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div
        className="premium-leaderboard-head"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          background: 'linear-gradient(180deg, #f6faf7 0%, #eef5ef 100%)',
          borderBottom: '1px solid #e4ece6',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 950, color: '#1f3b2c' }}>Leaderboard</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#5e6f64' }}>Live • NET</div>
      </div>

      <div className="premium-leaderboard-list" style={{ display: 'grid', gap: 8, padding: 10 }}>
        {leaderboard.map((entry) => (
          <div
            key={entry.playerId}
            className="premium-leaderboard-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '46px minmax(0, 1fr) auto',
              gap: 10,
              alignItems: 'center',
              minHeight: 66,
              borderRadius: 12,
              padding: '10px 12px',
              background: entry.isLeader ? '#f2faf4' : '#f8fbf9',
              border: entry.isLeader ? '1px solid #b8e2c5' : '1px solid #e2ece6',
            }}
          >
            <div
              className="premium-leaderboard-pos"
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                background: entry.isLeader ? '#daf5e2' : '#eef3ef',
                color: '#1f3b2c',
                fontWeight: 950,
                fontSize: 16,
              }}
            >
              {entry.position}.
            </div>

            <div className="premium-leaderboard-player" style={{ minWidth: 0 }}>
              <div
                className="premium-leaderboard-name"
                style={{
                  fontSize: 23,
                  lineHeight: 1.05,
                  color: '#25363b',
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {entry.playerName}
              </div>
              <div className="premium-leaderboard-meta" style={{ color: '#6b7d72', fontWeight: 800, fontSize: 12 }}>Till par {formatToPar(entry.totalToPar)}</div>
            </div>

            <div className="premium-leaderboard-score-wrap" style={{ textAlign: 'right', minWidth: 72 }}>
              <div className="premium-leaderboard-score" style={{ fontSize: 24, fontWeight: 950, color: '#1f2937', lineHeight: 1 }}>
                {entry.totalStrokes ?? '-'}
              </div>
              <div className="premium-leaderboard-score-label" style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: '#6b7280' }}>
                slag
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ScorecardTable({
  player,
  holes,
  scoreRows,
  label,
}: {
  player: RoundPlayer
  holes: HoleLike[]
  scoreRows: HoleScoreRow[]
  label: 'Ut' | 'In' | 'Totalt'
}) {
  const rowsByHole = buildRowsByHole(scoreRows, player.id)
  const hcpIndexes = holes.map((hole) => hole.hcp_index)
  const totalPar = holes.reduce((sum, hole) => sum + hole.par, 0)
  const totalStrokes = holes.reduce((sum, hole) => sum + (rowsByHole.get(hole.hole_number)?.strokes ?? 0), 0)
  const totalNet = holes.reduce((sum, hole) => {
    const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
    if (strokes == null) return sum
    const receivedStrokes = getReceivedStrokesForSelectedHole(
      player.playing_handicap ?? 0,
      hcpIndexes,
      hole.hcp_index
    )
    return sum + Math.max(1, strokes - receivedStrokes)
  }, 0)

  return (
    <div className="scorecard-table-wrap" style={{ overflowX: 'auto' }}>
      <table className="scorecard-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640, tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={greenHeadCell}>Hål</th>
            {holes.map((hole) => <th key={hole.hole_number} style={greenHeadCell}>{hole.hole_number}</th>)}
            <th style={greenHeadCell}>{label}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={labelCell}>HCP</td>
            {holes.map((hole) => <td key={hole.hole_number} style={plainCell}>{hole.hcp_index}</td>)}
            <td style={plainCell}></td>
          </tr>
          <tr>
            <td style={labelCell}>Par</td>
            {holes.map((hole) => <td key={hole.hole_number} style={plainCell}>{hole.par}</td>)}
            <td style={plainCell}>{totalPar}</td>
          </tr>
          <tr>
            <td style={labelCellBold}>Res</td>
            {holes.map((hole) => {
              const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
              const bg = getScoreColor(strokes, hole.par)
              return (
                <td key={hole.hole_number} style={plainCell}>
                  <span style={{
                    display: 'inline-grid',
                    placeItems: 'center',
                    minWidth: 40,
                    height: 40,
                    borderRadius: bg === '#f04b56' ? 999 : 0,
                    background: bg,
                    color: bg ? '#fff' : '#30383d',
                    fontWeight: 950,
                  }}>
                    {strokes ?? '-'}
                  </span>
                </td>
              )
            })}
            <td style={plainCellBold}>{totalStrokes || '-'}</td>
          </tr>
          <tr>
            <td style={labelCell}>Net</td>
            {holes.map((hole) => {
              const strokes = rowsByHole.get(hole.hole_number)?.strokes ?? null
              const receivedStrokes = getReceivedStrokesForSelectedHole(
                player.playing_handicap ?? 0,
                hcpIndexes,
                hole.hcp_index
              )
              const net = strokes == null ? null : Math.max(1, strokes - receivedStrokes)
              return <td key={hole.hole_number} style={plainCell}>{net ?? '-'}</td>
            })}
            <td style={plainCell}>{totalNet || '-'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function PlayerScorecard({
  player,
  holes,
  scoreRows,
  position,
}: {
  player: RoundPlayer
  holes: HoleLike[]
  scoreRows: HoleScoreRow[]
  position: number
}) {
  const frontNine = holes.filter((hole) => hole.hole_number <= 9)
  const backNine = holes.filter((hole) => hole.hole_number >= 10)
  const totals = calculatePlayerTotals({ player, holes, scoreRows })

  return (
    <article className="player-scorecard" style={{ borderRadius: 22, background: '#fff', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 16px 34px rgba(0,0,0,0.10)' }}>
      <div className="player-scorecard-head" style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div>
          <h2 className="player-scorecard-name" style={{ margin: 0, fontSize: 26, color: '#273238' }}>{player.display_name ?? 'Spelare'}</h2>
          <p className="player-scorecard-meta" style={{ margin: '4px 0 0', color: '#65756b', fontWeight: 850 }}>
            HCP {player.exact_handicap ?? '-'} · Spelade hål {totals.playedHoles}
          </p>
        </div>
        <span className="player-tee-pill" style={{ ...pillStyle, fontSize: 14 }}>{player.tee_key ?? 'Tee'}</span>
      </div>

      {frontNine.length > 0 && <ScorecardTable player={player} holes={frontNine} scoreRows={scoreRows} label="Ut" />}
      {backNine.length > 0 && <ScorecardTable player={player} holes={backNine} scoreRows={scoreRows} label="In" />}

      <div className="player-scorecard-summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: 8, padding: '18px 16px', borderTop: '1px solid #e5e7eb', alignItems: 'center' }}>
        <div style={summaryStatStyle}>Par <strong>{totals.totalPar}</strong></div>
        <div style={summaryStatStyle}>Res <strong>{totals.totalStrokes || '-'}/{totals.totalNet || '-'}</strong></div>
        <div style={{ ...summaryStatStyle, textAlign: 'right' }}>Position <strong>{position}.</strong></div>
      </div>
    </article>
  )
}

function GamebookScorecards({
  players,
  holes,
  scoreRows,
  leaderboard,
}: {
  players: RoundPlayer[]
  holes: HoleLike[]
  scoreRows: HoleScoreRow[]
  leaderboard: LeaderboardEntry[]
}) {
  const positionByPlayerId = new Map(leaderboard.map((entry) => [entry.playerId, entry.position]))

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      {players.map((player) => (
        <PlayerScorecard
          key={player.id}
          player={player}
          holes={holes}
          scoreRows={scoreRows}
          position={positionByPlayerId.get(player.id) ?? 1}
        />
      ))}
    </section>
  )
}

const pillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '9px 15px',
  borderRadius: 999,
  background: '#edf7ee',
  color: '#20452c',
  border: '1px solid rgba(28, 120, 58, 0.16)',
  fontSize: 16,
  fontWeight: 950,
}

const leaderHeaderCell: React.CSSProperties = {
  padding: '10px 8px',
  whiteSpace: 'nowrap',
}

const greenHeadCell: React.CSSProperties = {
  padding: '10px 6px',
  background: '#149654',
  color: '#fff',
  fontSize: 'clamp(15px, 3.8vw, 19px)',
  fontWeight: 950,
  borderRight: '1px solid rgba(255,255,255,0.14)',
  whiteSpace: 'nowrap',
}

const labelCell: React.CSSProperties = {
  padding: '10px 10px',
  textAlign: 'left',
  fontSize: 'clamp(14px, 3.5vw, 18px)',
  color: '#3a4244',
  border: '1px solid #eef0f2',
  background: '#fff',
  minWidth: 86,
  width: 86,
  whiteSpace: 'nowrap',
  fontWeight: 800,
  letterSpacing: '-0.01em',
}

const labelCellBold: React.CSSProperties = {
  ...labelCell,
  fontWeight: 950,
}

const plainCell: React.CSSProperties = {
  padding: '10px 6px',
  textAlign: 'center',
  fontSize: 'clamp(15px, 3.4vw, 19px)',
  color: '#30383d',
  border: '1px solid #eef0f2',
  background: '#fff',
  fontWeight: 650,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const plainCellBold: React.CSSProperties = {
  ...plainCell,
  fontWeight: 950,
}

const summaryStatStyle: React.CSSProperties = {
  color: '#30383d',
  fontSize: 'clamp(18px, 5vw, 27px)',
  fontWeight: 500,
}

export default async function SummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ hole?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const resolvedSearchParams = await searchParams

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

  const { data: roundFromUserClient } = await supabase
    .from('rounds')
    .select('id, title, owner_id, course_id, current_hole, start_hole, end_hole, holes_mode, scoring_mode')
    .eq('id', id)
    .maybeSingle()

  let roundData = roundFromUserClient

  if (!roundData && supabaseAdmin) {
    const { data: roundFromAdminClient } = await supabaseAdmin
      .from('rounds')
      .select('id, title, owner_id, course_id, current_hole, start_hole, end_hole, holes_mode, scoring_mode')
      .eq('id', id)
      .maybeSingle()

    roundData = roundFromAdminClient
  }

  if (!roundData) notFound()

  const round = roundData as RoundLike

  const viewerEmail = String(user.email ?? '').trim().toLowerCase()
  const viewerIsOwner = round.owner_id === user.id

  const [{ data: membership }, { data: ownerProfileRaw }] = await Promise.all([
    supabase
      .from('round_members')
      .select('id')
      .eq('round_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabaseAdmin
      ? supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', round.owner_id)
          .maybeSingle()
      : supabase
          .from('profiles')
          .select('email')
          .eq('id', round.owner_id)
          .maybeSingle(),
  ])

  const ownerProfile = (ownerProfileRaw as OwnerProfileLike | null) ?? null
  const ownerEmail = String(ownerProfile?.email ?? '').trim().toLowerCase()

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

  const requestedHoleNumber = resolvedSearchParams.hole
    ? parseHoleNumber(resolvedSearchParams.hole)
    : round.current_hole ?? round.start_hole ?? 1

  const [
    { data: playersData },
    { data: courseData },
    { data: holesData },
    { data: allScoreRowsData },
  ] = await Promise.all([
    dataReadClient
      .from('round_players')
      .select('id, display_name, exact_handicap, playing_handicap, tee_key, active_from_hole, active_to_hole')
      .eq('round_id', id)
      .order('sort_order'),
    dataReadClient.from('courses').select('id, name').eq('id', round.course_id).single(),
    dataReadClient
      .from('course_holes')
      .select('hole_number, par, hcp_index')
      .eq('course_id', round.course_id)
      .order('hole_number'),
    dataReadClient
      .from('hole_scores')
      .select('round_player_id, hole_number, strokes')
      .eq('round_id', id)
      .order('hole_number'),
  ])

  if (!courseData || !holesData || !playersData) notFound()

  const players = (playersData ?? []).map((player) => ({
    ...player,
    display_name: player.display_name ?? undefined,
    tee_key: player.tee_key ?? undefined,
  })) as RoundPlayer[]

  const course = courseData as CourseLike
  const holes = holesData as HoleLike[]
  const scoreRows = (allScoreRowsData ?? []) as HoleScoreRow[]

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length
  const visibleHoles = getVisibleHoles(holes, startHole, endHole)

  if (!visibleHoles.length) notFound()

  const currentHole =
    visibleHoles.find((item) => item.hole_number === requestedHoleNumber) ??
    visibleHoles.find((item) => item.hole_number === round.current_hole) ??
    visibleHoles[0]

  const playersForSummary = players.filter((player) =>
    isPlayerActiveOnHole(player, currentHole.hole_number, startHole, endHole)
  )
  const activePlayers = playersForSummary.length > 0 ? playersForSummary : players

  const leaderboard = buildLeaderboard({
    players: activePlayers,
    scoreRows,
    visibleHoles,
    selectedHoleIndexes: visibleHoles.map((item) => item.hcp_index),
    scoringMode: round.scoring_mode,
    startHole,
    endHole,
  })

  return (
    <main className="summary-page" style={{ background: '#f3fbf5', minHeight: '100vh' }}>
      <div className="container summary-shell" style={{ display: 'grid', gap: 0, maxWidth: 980 }}>
        <SummaryHero
          roundTitle={round.title}
          courseName={course.name}
          modeLabel={getRoundModeLabel(round, startHole)}
          currentHoleNumber={currentHole.hole_number}
          totalHoles={visibleHoles.length}
          roundId={id}
        />

        <GameTabs scoringMode={round.scoring_mode} />
        <CompactLeaderboard leaderboard={leaderboard} />

        <div className="summary-scorecards-wrap" style={{ padding: '14px 0 40px' }}>
          <GamebookScorecards
            players={activePlayers}
            holes={visibleHoles}
            scoreRows={scoreRows}
            leaderboard={leaderboard}
          />
        </div>
      </div>
    </main>
  )
}
