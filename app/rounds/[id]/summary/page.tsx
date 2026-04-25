import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import SummaryExportButton from '@/components/summary-export-button'
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

type HoleScoreView = {
  holeNumber: number
  par: number
  hcpIndex: number
  strokes: number | null
  marker: string | null
}

type SummaryPlayer = {
  id: string
  userId: string | null
  name: string
  strokes: number
  vsPar: number
  points: number
  exactHandicap: number | null
  playingHandicap: number
  teeKey: string
  activeFromHole: number
  activeToHole: number
  activeHoleIndexes: number[]
  holeScores: HoleScoreView[]
}


type OwnerProfileRow = {
  email: string | null
  display_name: string | null
}
function getPlayedRangeLabel(player: Pick<SummaryPlayer, 'activeFromHole' | 'activeToHole'>) {
  return `Spelat hål ${player.activeFromHole}–${player.activeToHole}`
}

function getScoreMarker(strokes: number | null, par: number) {
  if (strokes == null) return null

  const diff = strokes - par

  if (diff <= -2) return 'double-circle'
  if (diff === -1) return 'circle'
  if (diff === 1) return 'square'
  if (diff >= 2) return 'double-square'

  return null
}

function markerStyle(marker: string | null): CSSProperties {
  const base: CSSProperties = {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 13,
    background: '#fff',
    margin: '0 auto',
    flexShrink: 0,
  }

  if (marker === 'circle') {
    return {
      ...base,
      border: '2px solid #166534',
      borderRadius: '999px',
    }
  }

  if (marker === 'double-circle') {
    return {
      ...base,
      border: '2px solid #166534',
      borderRadius: '999px',
      boxShadow: '0 0 0 3px #d1fae5',
    }
  }

  if (marker === 'square') {
    return {
      ...base,
      border: '2px solid #b45309',
      borderRadius: 6,
      background: '#fff7ed',
    }
  }

  if (marker === 'double-square') {
    return {
      ...base,
      border: '2px solid #991b1b',
      borderRadius: 6,
      boxShadow: '0 0 0 3px #fee2e2',
      background: '#fff5f5',
    }
  }

  return base
}

function formatVsPar(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function formatRoundDate(value?: string | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function sumPar(holes: Array<{ par: number }>) {
  return holes.reduce((sum, hole) => sum + hole.par, 0)
}

function getMedal(index: number) {
  if (index === 0) return '🥇'
  if (index === 1) return '🥈'
  if (index === 2) return '🥉'
  return `${index + 1}.`
}

const TYPE = {
  pageTitle: {
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: -0.3,
    color: '#1f3327',
  } satisfies CSSProperties,
  sectionTitle: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: -0.2,
    color: '#1f3327',
  } satisfies CSSProperties,
  cardTitleLg: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: -0.2,
    color: '#1f3327',
  } satisfies CSSProperties,
  cardTitleMd: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.1,
    letterSpacing: -0.15,
    color: '#1f3327',
  } satisfies CSSProperties,
  meta: {
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.4,
    color: '#617166',
  } satisfies CSSProperties,
  label: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.3,
    color: '#6b786f',
  } satisfies CSSProperties,
  labelStrong: {
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.2,
  } satisfies CSSProperties,
  statValueLg: {
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.1,
    color: '#1f3327',
  } satisfies CSSProperties,
  statValueMd: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.1,
    color: '#1f3327',
  } satisfies CSSProperties,
  buttonText: {
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1,
  } satisfies CSSProperties,
} as const

function ScoreTable({
  title,
  holes,
  scores,
  selectedPlayer,
  scoringMode,
  totalLabel,
}: {
  title: string
  holes: HoleLike[]
  scores: HoleScoreView[]
  selectedPlayer: Pick<SummaryPlayer, 'playingHandicap' | 'activeHoleIndexes'>
  scoringMode: string
  totalLabel: string
}) {
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)

  const strokesTotal = scores.reduce((sum, score) => {
    if (score.strokes == null) return sum
    return sum + score.strokes
  }, 0)

  const pointsPerHole: Array<number | null> = scores.map((score) => {
    if (score.strokes == null) return null

    return stablefordPoints(
      score.strokes,
      score.par,
      getReceivedStrokesForSelectedHole(
        selectedPlayer.playingHandicap ?? 0,
        selectedPlayer.activeHoleIndexes,
        score.hcpIndex
      )
    )
  })

  const pointsTotal = pointsPerHole.reduce((sum: number, points: number | null) => {
    return sum + (points ?? 0)
  }, 0)

  const showPoints = scoringMode === 'stableford'

  const stickyBase: CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    boxShadow: '10px 0 14px -14px rgba(15, 23, 42, 0.18)',
  }

  return (
    <div
      style={{
        border: '1px solid #d9e7db',
        borderRadius: 18,
        overflow: 'hidden',
        background: '#fff',
        boxShadow: '0 8px 22px rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        style={{
          background: '#14803c',
          color: '#fff',
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            opacity: 0.95,
            whiteSpace: 'nowrap',
          }}
        >
          ← Dra i sidled →
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          background: '#fff',
        }}
      >
        <div
          style={{
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: 560,
              borderCollapse: 'collapse',
              fontSize: 14,
            }}
          >
            <tbody>
              <tr style={{ background: '#f8fbf7' }}>
                <th
                  style={{
                    ...stickyBase,
                    textAlign: 'left',
                     padding: '10px 12px',
                     fontSize: 15,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    background: '#f8fbf7',
                    color: '#1f3327',
                  }}
                >
                  Hål
                </th>
                {scores.map((score) => (
                  <th
                    key={`hole-${score.holeNumber}`}
                    style={{
                      textAlign: 'center',
                      padding: '10px 6px',
                      fontSize: 15,
                      fontWeight: 800,
                      minWidth: 34,
                      color: '#1f3327',
                    }}
                  >
                    {score.holeNumber}
                  </th>
                ))}
                <th
                  style={{
                    textAlign: 'center',
                     padding: '10px 8px',
                     fontSize: 14,
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    color: '#166534',
                    background: '#ecfdf3',
                  }}
                >
                  {totalLabel}
                </th>
              </tr>

              <tr>
                <td
                  style={{
                    ...stickyBase,
                     padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    borderTop: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#6b786f',
                  }}
                >
                  Hcp
                </td>
                {scores.map((score) => (
                  <td
                    key={`hcp-${score.holeNumber}`}
                    style={{
                      padding: '10px 6px',
                      textAlign: 'center',
                      color: '#64748b',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {score.hcpIndex}
                  </td>
                ))}
                <td
                  style={{
                     padding: '10px 8px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    borderTop: '1px solid #e5e7eb',
                    fontWeight: 700,
                    background: '#fafafa',
                  }}
                >
                  —
                </td>
              </tr>

              <tr style={{ background: '#fcfcfc' }}>
                <td
                  style={{
                    ...stickyBase,
                     padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    borderTop: '1px solid #e5e7eb',
                    background: '#fcfcfc',
                    color: '#6b786f',
                  }}
                >
                  Par
                </td>
                {scores.map((score) => (
                  <td
                    key={`par-${score.holeNumber}`}
                    style={{
                      padding: '10px 6px',
                      textAlign: 'center',
                      color: '#334155',
                      borderTop: '1px solid #e5e7eb',
                    }}
                  >
                    {score.par}
                  </td>
                ))}
                <td
                  style={{
                     padding: '10px 8px',
                    textAlign: 'center',
                    fontWeight: 800,
                    borderTop: '1px solid #e5e7eb',
                    background: '#f8fbf7',
                    color: '#166534',
                  }}
                >
                  {parTotal}
                </td>
              </tr>

              <tr style={{ background: '#ffffff' }}>
                <td
                  style={{
                    ...stickyBase,
                     padding: '10px 12px',
                    fontWeight: 800,
                    whiteSpace: 'nowrap',
                    borderTop: '2px solid #d1fae5',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: 15,
                  }}
                >
                  Resultat
                </td>
                {scores.map((score) => (
                  <td
                    key={`res-${score.holeNumber}`}
                    style={{
                      padding: '10px 6px',
                      textAlign: 'center',
                      borderTop: '2px solid #d1fae5',
                      fontWeight: 800,
                    }}
                  >
                    {score.strokes == null ? (
                      <span style={{ color: '#94a3b8', fontWeight: 700 }}>-</span>
                    ) : (
                      <span style={markerStyle(score.marker)}>{score.strokes}</span>
                    )}
                  </td>
                ))}
                <td
                  style={{
                     padding: '10px 8px',
                     textAlign: 'center',
                     fontWeight: 900,
                     fontSize: 18,
                    borderTop: '2px solid #d1fae5',
                    background: '#f0fdf4',
                    color: '#166534',
                  }}
                >
                  {strokesTotal}
                </td>
              </tr>

              {showPoints ? (
                <tr style={{ background: '#f7fbff' }}>
                  <td
                    style={{
                      ...stickyBase,
                       padding: '10px 12px',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      borderTop: '1px solid #dbeafe',
                      background: '#f7fbff',
                      color: '#0f172a',
                      fontSize: 15,
                    }}
                  >
                    Poäng
                  </td>
                  {pointsPerHole.map((points, index) => (
                    <td
                      key={`points-${scores[index].holeNumber}`}
                      style={{
                        padding: '10px 6px',
                        textAlign: 'center',
                        borderTop: '1px solid #dbeafe',
                        color: '#0f172a',
                        fontWeight: 700,
                      }}
                    >
                      {points == null ? (
                        <span style={{ color: '#94a3b8', fontWeight: 700 }}>-</span>
                      ) : (
                        points
                      )}
                    </td>
                  ))}
                  <td
                    style={{
                       padding: '10px 8px',
                        textAlign: 'center',
                        fontWeight: 900,
                        fontSize: 18,
                      borderTop: '1px solid #dbeafe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                    }}
                  >
                    {pointsTotal}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 18,
            pointerEvents: 'none',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.96) 100%)',
          }}
        />
      </div>
    </div>
  )
}

export default async function SummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ player?: string; hole?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
    .select(
      'id, owner_id, course_id, title, scoring_mode, status, holes_mode, start_hole, end_hole, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  let round = roundFromUserClient

  if (!round && supabaseAdmin) {
    const { data: roundFromAdminClient } = await supabaseAdmin
      .from('rounds')
      .select(
        'id, owner_id, course_id, title, scoring_mode, status, holes_mode, start_hole, end_hole, created_at'
      )
      .eq('id', id)
      .maybeSingle()

    round = roundFromAdminClient
  }

  if (!round) notFound()

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
          .select('email, display_name')
          .eq('id', round.owner_id)
          .maybeSingle()
      : supabase
          .from('profiles')
          .select('email, display_name')
          .eq('id', round.owner_id)
          .maybeSingle(),
  ])

  let isFriendOfOwner = false

  if (!viewerIsOwner && !membership && viewerEmail) {
    const friendReadClient = supabaseAdmin ?? supabase
    const ownerEmail = String((ownerProfileRaw as OwnerProfileRow | null)?.email ?? '')
      .trim()
      .toLowerCase()

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

  const [{ data: players }, { data: scoreRows }] = await Promise.all([
    dataReadClient
      .from('round_players')
      .select(
        'id, user_id, display_name, exact_handicap, playing_handicap, tee_key, active_from_hole, active_to_hole'
      )
      .eq('round_id', id)
      .order('sort_order'),
    dataReadClient
      .from('hole_scores')
      .select('round_player_id, hole_number, strokes')
      .eq('round_id', id)
      .order('hole_number'),
  ])

  if (!players || !scoreRows) notFound()

  const [{ data: course }, { data: holes }] = await Promise.all([
    dataReadClient.from('courses').select('id, name').eq('id', round.course_id).single(),
    dataReadClient
      .from('course_holes')
      .select('hole_number, par, hcp_index')
      .eq('course_id', round.course_id)
      .order('hole_number'),
  ])

  if (!course || !holes) notFound()

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length
  const parsedReturnHole = Number(resolvedSearchParams.hole)
  const returnHole =
    Number.isFinite(parsedReturnHole) && parsedReturnHole >= startHole && parsedReturnHole <= endHole
      ? Math.floor(parsedReturnHole)
      : startHole

  const visibleHoles = holes.filter(
    (hole: HoleLike) => hole.hole_number >= startHole && hole.hole_number <= endHole
  )

  const visibleHoleIndexes = visibleHoles.map((hole: HoleLike) => hole.hcp_index)

  const isNineHoleRound = round.holes_mode === 9
  const isRoundFinished = round.status === 'finished' || round.status === 'completed'

  const firstHalf = isNineHoleRound ? visibleHoles : visibleHoles.slice(0, 9)
  const secondHalf = isNineHoleRound ? [] : visibleHoles.slice(9)

  const summary: SummaryPlayer[] = players
    .map((player: any) => {
      const activeFromHole = Number(player.active_from_hole ?? startHole)
      const activeToHole = Number(player.active_to_hole ?? endHole)
      const activeHoles = visibleHoles.filter(
        (hole: HoleLike) =>
          hole.hole_number >= activeFromHole && hole.hole_number <= activeToHole
      )
      const activeHoleIndexes = activeHoles.map((hole: HoleLike) => hole.hcp_index)

      const rows = scoreRows.filter(
        (row: any) =>
          row.round_player_id === player.id &&
          row.hole_number >= activeFromHole &&
          row.hole_number <= activeToHole &&
          row.hole_number >= startHole &&
          row.hole_number <= endHole
      )

      const strokes = rows.reduce((sum: number, row: any) => sum + (row.strokes ?? 0), 0)

      const vsPar = rows.reduce((sum: number, row: any) => {
        const hole = activeHoles.find((item: HoleLike) => item.hole_number === row.hole_number)
        return sum + (hole ? (scoreVsPar(row.strokes, hole.par) ?? 0) : 0)
      }, 0)

      const points = rows.reduce((sum: number, row: any) => {
        const hole = activeHoles.find((item: HoleLike) => item.hole_number === row.hole_number)
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

      const holeScores: HoleScoreView[] = visibleHoles.map((hole: HoleLike) => {
        const row = rows.find((item: any) => item.hole_number === hole.hole_number)
        const strokesOnHole = row?.strokes ?? null

        return {
          holeNumber: hole.hole_number,
          par: hole.par,
          hcpIndex: hole.hcp_index,
          strokes: strokesOnHole,
          marker: getScoreMarker(strokesOnHole, hole.par),
        }
      })

      return {
        id: player.id,
        userId: player.user_id ?? null,
        name: player.display_name,
        strokes,
        vsPar,
        points,
        exactHandicap: player.exact_handicap ?? null,
        playingHandicap: player.playing_handicap ?? 0,
        teeKey: player.tee_key ?? 'yellow',
        activeFromHole,
        activeToHole,
        activeHoleIndexes,
        holeScores,
      }
    })
    .sort((a, b) =>
      round.scoring_mode === 'stableford' ? b.points - a.points : a.strokes - b.strokes
    )

  const winner = summary[0]
  const selectedPlayer =
    summary.find((player) => player.id === resolvedSearchParams.player) ?? summary[0]

  const selectedIndex = summary.findIndex((player) => player.id === selectedPlayer?.id)

  const roundTypeLabel = round.scoring_mode === 'stableford' ? 'Poängbogey' : 'Slagspel'
  const scoringMode = round.scoring_mode

  const holesLabel =
    round.holes_mode === 18
      ? '18 hål'
      : startHole === 1
        ? '9 hål · Främre 9'
        : '9 hål · Bakre 9'

  const scorecardModeLabel =
    round.holes_mode === 18
      ? '18 hål'
      : startHole === 1
        ? '9 hål · Främre'
        : '9 hål · Bakre'

  const totalPar = sumPar(visibleHoles)

  const selectedFrontScores = selectedPlayer
    ? selectedPlayer.holeScores.filter((score) =>
        firstHalf.some((hole: HoleLike) => hole.hole_number === score.holeNumber)
      )
    : []

  const selectedBackScores = selectedPlayer
    ? selectedPlayer.holeScores.filter((score) =>
        secondHalf.some((hole: HoleLike) => hole.hole_number === score.holeNumber)
      )
    : []

  function getPointsForScores(player: SummaryPlayer, scores: HoleScoreView[]) {
    if (scoringMode !== 'stableford') return undefined

    return scores.map((score) =>
      score.strokes == null
        ? null
        : stablefordPoints(
            score.strokes,
            score.par,
            getReceivedStrokesForSelectedHole(
              player.playingHandicap ?? 0,
              player.activeHoleIndexes,
              score.hcpIndex
            )
          )
    )
  }

  function getExportScorecards(player: SummaryPlayer) {
    const frontScores = player.holeScores.filter((score) =>
      firstHalf.some((hole: HoleLike) => hole.hole_number === score.holeNumber)
    )
    const backScores = player.holeScores.filter((score) =>
      secondHalf.some((hole: HoleLike) => hole.hole_number === score.holeNumber)
    )

    return [
      {
        title:
          isNineHoleRound
            ? startHole === 1
              ? 'Framre 9'
              : 'Bakre 9'
            : 'Framre 9',
        holes: frontScores.map((score) => score.holeNumber),
        pars: frontScores.map((score) => score.par),
        results: frontScores.map((score) => score.strokes),
        points: getPointsForScores(player, frontScores),
      },
      ...(!isNineHoleRound && backScores.length > 0
        ? [
            {
              title: 'Bakre 9',
              holes: backScores.map((score) => score.holeNumber),
              pars: backScores.map((score) => score.par),
              results: backScores.map((score) => score.strokes),
              points: getPointsForScores(player, backScores),
            },
          ]
        : []),
    ]
  }

  const exportPlayers = summary.map((player) => ({
    id: player.id,
    name: player.name ?? 'Spelare',
    playedRangeText: getPlayedRangeLabel(player),
    scoreText:
      scoringMode === 'stableford'
        ? `${player.points} p`
        : `${player.strokes} slag`,
    scorecards: getExportScorecards(player),
  }))

  const mySummaryPlayer =
    summary.find((player) => player.userId === user.id) ??
    selectedPlayer ??
    summary[0] ??
    null

  const mySummaryPlayerId = mySummaryPlayer?.id ?? null
  const ownerProfile = (ownerProfileRaw as OwnerProfileRow | null) ?? null
  const ownerName =
    ownerProfile?.display_name?.trim() || ownerProfile?.email?.trim() || 'Rundans värd'
  const roundDateLabel = formatRoundDate((round as { created_at?: string | null }).created_at)
  const selectedPosition = selectedIndex >= 0 ? selectedIndex + 1 : 1
  const selectedPrimaryStat =
    scoringMode === 'stableford'
      ? `${selectedPlayer?.points ?? 0} p`
      : `${selectedPlayer?.strokes ?? 0}`
  const winnerPrimaryStat =
    scoringMode === 'stableford'
      ? `${winner?.points ?? 0} p`
      : `${winner?.strokes ?? 0}`

  return (
    <main>
      <style>{`
        .summary-shell {
          display: grid;
          gap: 14px;
        }

        .summary-top-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.95fr);
          gap: 14px;
          align-items: start;
        }

        .summary-overview-card {
          border: 1px solid #dbe7dd;
          background:
            radial-gradient(circle at top right, rgba(187,247,208,0.34), transparent 30%),
            linear-gradient(180deg, #f7fcf8 0%, #ffffff 100%);
        }

        .summary-badge-row,
        .summary-meta-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .summary-tools-card,
        .summary-overview-card {
          margin-bottom: 0 !important;
        }

        .summary-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .summary-kpi-card {
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          background: rgba(255,255,255,0.92);
          padding: 14px;
        }

        .summary-kpi-value {
          margin-top: 6px;
          font-size: clamp(1.5rem, 5vw, 2.15rem);
          font-weight: 900;
          line-height: 1;
          color: #163322;
        }

        .summary-score-header {
          display: grid;
          gap: 12px;
        }

        .summary-score-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .summary-player-switcher {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px;
        }

        .summary-score-highlights {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .summary-score-highlight {
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          background: #fff;
          padding: 10px;
          text-align: center;
        }

        .summary-anchor-nav {
          position: sticky;
          top: 8px;
          z-index: 20;
          padding: 8px;
          border-radius: 12px;
          background: rgba(255,255,255,0.95);
          border: 1px solid #dbe7dd;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(4px);
        }

        @media (max-width: 960px) {
          .summary-top-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .summary-kpi-grid,
          .summary-score-highlights {
            grid-template-columns: 1fr 1fr;
          }

          .summary-player-switcher {
            grid-auto-flow: column;
            grid-auto-columns: minmax(220px, 82%);
            overflow-x: auto;
            padding-bottom: 4px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }

          .summary-player-switcher > * {
            scroll-snap-align: start;
          }
        }

        @media (max-width: 520px) {
          .summary-kpi-grid,
          .summary-score-highlights {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <div className="container summary-shell">
        <div
          style={{
            display: 'grid',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div className="summary-top-grid">
            <div className="card summary-overview-card">
              <div style={{ display: 'grid', gap: 14 }}>
              <div className="summary-badge-row">
                <span className="badge">{roundTypeLabel}</span>
                <span className="badge">{holesLabel}</span>
                <span className="badge">{isRoundFinished ? 'Avslutad' : 'Pågår'}</span>
              </div>

              <div>
                {roundDateLabel ? (
                  <div style={{ marginBottom: 6, ...TYPE.meta }}>{roundDateLabel}</div>
                ) : null}
                <h1
                  style={{
                    marginBottom: 6,
                    ...TYPE.pageTitle,
                  }}
                >
                  {round.title}
                </h1>
                <p
                  style={{
                    margin: 0,
                    ...TYPE.meta,
                  }}
                >
                  {course.name} · Värd {ownerName}
                </p>
              </div>

              <div className="summary-kpi-grid">
                <div className="summary-kpi-card">
                  <div style={TYPE.label}>Vald spelare</div>
                  <div className="summary-kpi-value">{selectedPlayer?.name ?? 'Spelare'}</div>
                  <div style={{ marginTop: 8, ...TYPE.meta }}>
                    {selectedPlayer
                      ? `${selectedPlayer.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Spel-HCP ${selectedPlayer.playingHandicap ?? 0}`
                      : 'Ingen spelare vald'}
                  </div>
                </div>

                <div className="summary-kpi-card">
                  <div style={TYPE.label}>Resultat</div>
                  <div className="summary-kpi-value">{selectedPrimaryStat}</div>
                  <div style={{ marginTop: 8, ...TYPE.meta }}>
                    {selectedPlayer ? `${formatVsPar(selectedPlayer.vsPar)} mot par` : ''}
                  </div>
                </div>

                <div className="summary-kpi-card">
                  <div style={TYPE.label}>Placering</div>
                  <div className="summary-kpi-value">
                    {selectedPosition}/{summary.length}
                  </div>
                  <div style={{ marginTop: 8, ...TYPE.meta }}>
                    {winner ? `Ledare: ${winner.name} · ${winnerPrimaryStat}` : `${totalPar} par`}
                  </div>
                </div>
              </div>

              {winner && selectedPlayer && winner.id !== selectedPlayer.id ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: '1px solid #dbe7dd',
                    background: 'rgba(255,255,255,0.92)',
                  }}
                >
                  <div style={{ marginBottom: 4, ...TYPE.labelStrong, color: '#166534' }}>
                    Vinnare
                  </div>
                  <div style={TYPE.cardTitleMd}>{winner.name}</div>
                  <div style={{ marginTop: 6, ...TYPE.meta }}>
                    {winnerPrimaryStat} · {formatVsPar(winner.vsPar)} · {getPlayedRangeLabel(winner)}
                  </div>
                </div>
              ) : null}
              </div>
            </div>

            <div className="card summary-tools-card" style={{ padding: 14 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ marginBottom: 4, ...TYPE.cardTitleMd }}>Snabbval</div>
                  <div style={TYPE.meta}>
                    Tillbaka till rundan, startsidan eller exportera resultatet.
                  </div>
                </div>
                <Link
                  className="button secondary"
                  href={`/rounds/${id}?hole=${returnHole}`}
                  style={{
                    width: '100%',
                    minHeight: 54,
                    ...TYPE.buttonText,
                  }}
                >
                  Till rundan
                </Link>

                <Link
                  className="button secondary"
                  href="/dashboard"
                  style={{
                    width: '100%',
                    minHeight: 54,
                    ...TYPE.buttonText,
                  }}
                >
                  Till startsidan
                </Link>
                <SummaryExportButton
                  roundTitle={round.title}
                  courseName={course.name}
                  modeLabel={holesLabel}
                  players={exportPlayers}
                  myPlayerId={mySummaryPlayerId}
                />
              </div>
            </div>
          </div>

          {isRoundFinished && (
            <div
              className="card"
              style={{
                marginTop: 12,
                marginBottom: 14,
                border: '2px solid #bbf7d0',
                background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
                padding: 14,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: '#dcfce7',
                  color: '#166534',
                  marginBottom: 12,
                  ...TYPE.labelStrong,
                }}
              >
                ✅ Rundan är avslutad
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#dcfce7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  ⛳
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      marginBottom: 4,
                      ...TYPE.cardTitleMd,
                      color: '#166534',
                    }}
                  >
                    Registrera rundan i Min Golf
                  </div>

                  <p
                    style={{
                      margin: 0,
                      ...TYPE.meta,
                      color: '#475569',
                    }}
                  >
                    Din runda är klar i appen. Nästa steg är att registrera den i Min Golf.
                  </p>
                </div>
              </div>

              <a
                href="https://mingolf.golf.se"
                target="_blank"
                rel="noopener noreferrer"
                className="button"
                style={{
                  width: '100%',
                  minHeight: 52,
                  textAlign: 'center',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...TYPE.buttonText,
                }}
              >
                Till Min Golf – registrera runda ↗
              </a>
            </div>
          )}
        </div>

        {winner ? (
          <div
            className="card"
            style={{
              marginBottom: 14,
              border: '2px solid #bbf7d0',
              background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                alignItems: 'stretch',
                flexWrap: 'wrap',
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: '#dcfce7',
                  color: '#166534',
                  ...TYPE.labelStrong,
                }}
              >
                🏆 Vinnare
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid #d1fae5',
                  background: '#fff',
                  color: '#166534',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  maxWidth: '100%',
                  textAlign: 'center',
                  ...TYPE.labelStrong,
                }}
              >
                <span>{roundTypeLabel}</span>
                <span style={{ opacity: 0.5 }}>•</span>
                <span>{scorecardModeLabel}</span>
              </div>
            </div>

            <div
              style={{
                marginBottom: 8,
                wordBreak: 'break-word',
                ...TYPE.cardTitleLg,
              }}
            >
              {winner.name}
            </div>

            <div
              style={{
                marginBottom: 12,
                ...TYPE.meta,
                wordBreak: 'break-word',
              }}
            >
              {winner.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Exakt HCP{' '}
              {winner.exactHandicap ?? '-'} · Spel-HCP {winner.playingHandicap ?? 0}
            </div>
            <div style={{ marginBottom: 12, ...TYPE.meta }}>{getPlayedRangeLabel(winner)}</div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
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
                <div style={TYPE.label}>Resultat</div>
                <div style={{ marginTop: 6, ...TYPE.statValueLg }}>
                  {round.scoring_mode === 'stableford'
                    ? `${winner.points} p`
                    : `${winner.strokes}`}
                </div>
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={TYPE.label}>Till par</div>
                <div style={{ marginTop: 6, ...TYPE.statValueLg }}>
                  {formatVsPar(winner.vsPar)}
                </div>
              </div>

              <div
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <div style={TYPE.label}>Position</div>
                <div style={{ marginTop: 6, ...TYPE.statValueLg }}>1</div>
              </div>
            </div>
          </div>
        ) : null}

        <details className="card" style={{ marginBottom: 14 }}>
          <summary
            style={{
              cursor: 'pointer',
              listStyle: 'none',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  ...TYPE.sectionTitle,
                }}
              >
                Leaderboard
              </h2>
              <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
                Tryck för att visa eller dölja full ranking.
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid #bbf7d0',
                background: '#f0fdf4',
                color: '#166534',
                flexWrap: 'wrap',
                justifyContent: 'center',
                maxWidth: '100%',
                textAlign: 'center',
                ...TYPE.labelStrong,
              }}
            >
              <span>{summary.length} spelare</span>
              <span style={{ opacity: 0.5 }}>•</span>
              <span>{scorecardModeLabel}</span>
            </div>
          </summary>

          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            {summary.map((player, index) => (
              <div
                key={player.id}
                style={{
                  borderRadius: 16,
                  border: index === 0 ? '2px solid #86efac' : '1px solid #e5e7eb',
                  background: '#fff',
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 1fr auto',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      textAlign: 'center',
                      color: '#166534',
                    }}
                  >
                    {getMedal(index)}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        wordBreak: 'break-word',
                        ...TYPE.cardTitleMd,
                      }}
                    >
                      {player.name}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        ...TYPE.meta,
                      }}
                    >
                      HCP {player.exactHandicap ?? '-'} · Spel-HCP {player.playingHandicap}
                    </div>
                    <div style={{ marginTop: 2, ...TYPE.meta }}>{getPlayedRangeLabel(player)}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={TYPE.label}>Resultat</div>
                    <div
                      style={{
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        ...TYPE.statValueLg,
                        color: '#166534',
                      }}
                    >
                      {round.scoring_mode === 'stableford'
                        ? `${player.points} p`
                        : `${player.strokes}`}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <div style={TYPE.label}>Slag</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>{player.strokes}</div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <div style={TYPE.label}>Till par</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>
                      {formatVsPar(player.vsPar)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: round.scoring_mode === 'stableford' ? '#eff6ff' : '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <div style={TYPE.label}>Poäng</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>{player.points}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
        {selectedPlayer ? (
          <div className="card">
            <div className="summary-score-header" style={{ marginBottom: 12 }}>
              <div className="summary-score-top">
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      marginTop: 0,
                      marginBottom: 8,
                      ...TYPE.sectionTitle,
                    }}
                  >
                    Rundsammanfattning
                  </h2>
                  <div style={TYPE.meta}>
                    Välj spelare och se helheten innan du dyker ner i hela scorekortet.
                  </div>
                </div>

                <div className="summary-meta-row">
                  <span className="badge">{scorecardModeLabel}</span>
                  <span className="badge">{summary.length} spelare</span>
                </div>
              </div>

              <div
                className="summary-player-switcher"
              >
                {summary.map((player) => {
                  const isActive = player.id === selectedPlayer.id

                  return (
                    <Link
                      key={player.id}
                      href={`/rounds/${id}/summary?player=${player.id}&hole=${returnHole}`}
                      scroll={false}
                      style={{
                        minHeight: 48,
                        padding: '12px 14px',
                        borderRadius: 14,
                        border: isActive ? '2px solid #166534' : '1px solid #d1d5db',
                        background: isActive ? '#166534' : '#fff',
                        color: isActive ? '#fff' : '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: 16,
                        fontWeight: 800,
                        lineHeight: 1.1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {player.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            <div
              style={{
                border: '1px solid #d9e7db',
                borderRadius: 20,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <div
                style={{
                  padding: 14,
                  background: '#f8fbf7',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div className="summary-score-top" style={{ marginBottom: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="summary-meta-row" style={{ marginBottom: 8 }}>
                      <span className="badge">Vald spelare</span>
                      {selectedPosition === 1 ? <span className="badge">Leder</span> : null}
                    </div>

                    <div
                      style={{
                        marginBottom: 6,
                        wordBreak: 'break-word',
                        ...TYPE.cardTitleLg,
                      }}
                    >
                      {selectedPlayer.name}
                    </div>

                    <div style={TYPE.meta}>
                      {selectedPlayer.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Spel-HCP{' '}
                      {selectedPlayer.playingHandicap ?? 0} · {getPlayedRangeLabel(selectedPlayer)}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={TYPE.label}>Resultat</div>
                    <div
                      style={{
                        marginTop: 4,
                        whiteSpace: 'nowrap',
                        ...TYPE.statValueLg,
                        color: '#166534',
                      }}
                    >
                      {round.scoring_mode === 'stableford'
                        ? `${selectedPlayer.points} p`
                        : `${selectedPlayer.strokes}`}
                    </div>
                    <div style={{ marginTop: 4, ...TYPE.meta }}>
                      {formatVsPar(selectedPlayer.vsPar)} mot par
                    </div>
                  </div>
                </div>

                <div className="summary-score-highlights">
                  <div className="summary-score-highlight">
                    <div style={TYPE.label}>Slag</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>{selectedPlayer.strokes}</div>
                  </div>

                  <div className="summary-score-highlight">
                    <div style={TYPE.label}>Poäng</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>{selectedPlayer.points}</div>
                  </div>

                  <div className="summary-score-highlight">
                    <div style={TYPE.label}>Till par</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>
                      {formatVsPar(selectedPlayer.vsPar)}
                    </div>
                  </div>

                  <div className="summary-score-highlight">
                    <div style={TYPE.label}>Placering</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>{selectedPosition}</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 14, display: 'grid', gap: 12 }}>
                <div
                  className="summary-anchor-nav"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isNineHoleRound
                      ? '1fr 1fr'
                      : 'repeat(3, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  <a href="#score-front" className="button secondary" style={{ minHeight: 42 }}>
                    {startHole === 1 ? 'Främre 9' : 'Bakre 9'}
                  </a>

                  {!isNineHoleRound ? (
                    <a href="#score-back" className="button secondary" style={{ minHeight: 42 }}>
                      Bakre 9
                    </a>
                  ) : null}

                  <a href="#score-total" className="button secondary" style={{ minHeight: 42 }}>
                    Summa
                  </a>
                </div>

                <div id="score-front" style={{ scrollMarginTop: 92 }}>
                  <ScoreTable
                    title={
                      isNineHoleRound
                        ? startHole === 1
                          ? 'Främre 9'
                          : 'Bakre 9'
                        : 'Främre 9'
                    }
                    holes={firstHalf}
                    scores={selectedFrontScores}
                    selectedPlayer={selectedPlayer}
                    scoringMode={round.scoring_mode}
                    totalLabel={isNineHoleRound ? 'Summa' : 'Ut'}
                  />
                </div>

                {!isNineHoleRound && secondHalf.length > 0 ? (
                  <div id="score-back" style={{ scrollMarginTop: 92 }}>
                    <ScoreTable
                      title="Bakre 9"
                      holes={secondHalf}
                      scores={selectedBackScores}
                      selectedPlayer={selectedPlayer}
                      scoringMode={round.scoring_mode}
                      totalLabel="In"
                    />
                  </div>
                ) : null}

                <h3 id="score-total"
                  style={{
                    margin: '4px 0 2px 0',
                    fontSize: 16,
                    fontWeight: 800,
                    lineHeight: 1.2,
                    color: '#1f3327',
                  }}
                >
                  {isNineHoleRound ? 'Summa 9 hål' : 'Total'}
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div style={TYPE.label}>{isNineHoleRound ? 'Par (9 hål)' : 'Total par'}</div>
                    <div style={{ marginTop: 6, ...TYPE.statValueLg }}>{totalPar}</div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div style={TYPE.label}>
                      {isNineHoleRound ? 'Resultat (9 hål)' : 'Resultat'}
                    </div>
                    <div style={{ marginTop: 6, ...TYPE.statValueLg }}>
                      {selectedPlayer.strokes}
                    </div>
                  </div>

                  {!isNineHoleRound && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      <div style={TYPE.label}>Position</div>
                      <div style={{ marginTop: 6, ...TYPE.statValueLg }}>
                        {selectedIndex + 1}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}
