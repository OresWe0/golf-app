import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
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
  name: string
  strokes: number
  vsPar: number
  points: number
  exactHandicap: number | null
  playingHandicap: number
  teeKey: string
  holeScores: HoleScoreView[]
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
    width: 28,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 14,
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
  roundHoleIndexes,
  selectedPlayer,
  scoringMode,
  totalLabel,
}: {
  title: string
  holes: HoleLike[]
  scores: HoleScoreView[]
  roundHoleIndexes: number[]
  selectedPlayer: Pick<SummaryPlayer, 'playingHandicap'>
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
        roundHoleIndexes,
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
              minWidth: 620,
              borderCollapse: 'collapse',
              fontSize: 15,
            }}
          >
            <tbody>
              <tr style={{ background: '#f8fbf7' }}>
                <th
                  style={{
                    ...stickyBase,
                    textAlign: 'left',
                    padding: '12px 14px',
                    fontSize: 16,
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
                      padding: '12px 8px',
                      fontSize: 16,
                      fontWeight: 800,
                      minWidth: 38,
                      color: '#1f3327',
                    }}
                  >
                    {score.holeNumber}
                  </th>
                ))}
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 10px',
                    fontSize: 15,
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
                    padding: '11px 14px',
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
                      padding: '11px 8px',
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
                    padding: '11px 10px',
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
                    padding: '11px 14px',
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
                      padding: '11px 8px',
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
                    padding: '11px 10px',
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
                    padding: '12px 14px',
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
                      padding: '12px 8px',
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
                    padding: '12px 10px',
                    textAlign: 'center',
                    fontWeight: 900,
                    fontSize: 20,
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
                      padding: '12px 14px',
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
                        padding: '12px 8px',
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
                      padding: '12px 10px',
                      textAlign: 'center',
                      fontWeight: 900,
                      fontSize: 20,
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

  const [{ data: round }, { data: players }, { data: scoreRows }] = await Promise.all([
    supabase
      .from('rounds')
      .select(
        'id, owner_id, course_id, title, scoring_mode, status, holes_mode, start_hole, end_hole'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('round_players')
      .select('id, display_name, exact_handicap, playing_handicap, tee_key')
      .eq('round_id', id)
      .order('sort_order'),
    supabase
      .from('hole_scores')
      .select('round_player_id, hole_number, strokes')
      .eq('round_id', id)
      .order('hole_number'),
  ])

  if (!round || !players || !scoreRows) notFound()

  if (round.owner_id !== user.id) {
    const { data: membership } = await supabase
      .from('round_members')
      .select('id')
      .eq('round_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      notFound()
    }
  }

  const [{ data: course }, { data: holes }] = await Promise.all([
    supabase.from('courses').select('id, name').eq('id', round.course_id).single(),
    supabase
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
      const rows = scoreRows.filter(
        (row: any) =>
          row.round_player_id === player.id &&
          row.hole_number >= startHole &&
          row.hole_number <= endHole
      )

      const strokes = rows.reduce((sum: number, row: any) => sum + (row.strokes ?? 0), 0)

      const vsPar = rows.reduce((sum: number, row: any) => {
        const hole = visibleHoles.find((item: HoleLike) => item.hole_number === row.hole_number)
        return sum + (hole ? (scoreVsPar(row.strokes, hole.par) ?? 0) : 0)
      }, 0)

      const points = rows.reduce((sum: number, row: any) => {
        const hole = visibleHoles.find((item: HoleLike) => item.hole_number === row.hole_number)
        if (!hole || row.strokes == null) return sum

        return (
          sum +
          stablefordPoints(
            row.strokes,
            hole.par,
            getReceivedStrokesForSelectedHole(
              player.playing_handicap ?? 0,
              visibleHoleIndexes,
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
        name: player.display_name,
        strokes,
        vsPar,
        points,
        exactHandicap: player.exact_handicap ?? null,
        playingHandicap: player.playing_handicap ?? 0,
        teeKey: player.tee_key ?? 'yellow',
        holeScores,
      }
    })
    .sort((a, b) =>
      round.scoring_mode === 'stableford' ? b.points - a.points : a.strokes - b.strokes
    )

  const winner = summary[0]
  const exportRows = summary.map((player) => ({
    name: player.name,
    scoreText:
      round.scoring_mode === 'stableford'
        ? `${player.points} p`
        : `${player.strokes} slag`,
  }))

  const selectedPlayer =
    summary.find((player) => player.id === resolvedSearchParams.player) ?? summary[0]

  const selectedIndex = summary.findIndex((player) => player.id === selectedPlayer?.id)

  const roundTypeLabel = round.scoring_mode === 'stableford' ? 'Poängbogey' : 'Slagspel'

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

  return (
    <main>
      <div className="container">
        <div
          style={{
            display: 'grid',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
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
              {course.name}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <Link
              className="button secondary"
              href={`/rounds/${id}?hole=${returnHole}`}
              style={{
                width: '100%',
                minHeight: 50,
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
                minHeight: 50,
                ...TYPE.buttonText,
              }}
            >
              Till startsidan 🏠
            </Link>
          </div>

          <SummaryExportButton
            roundTitle={round.title}
            courseName={course.name}
            modeLabel={holesLabel}
            winnerName={winner?.name ?? 'Okand spelare'}
            winnerScore={
              winner
                ? round.scoring_mode === 'stableford'
                  ? `${winner.points} p`
                  : `${winner.strokes} slag`
                : '-'
            }
            rows={exportRows}
          />

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
                gap: 12,
                alignItems: 'flex-start',
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
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid #d1fae5',
                  background: '#fff',
                  color: '#166534',
                  flexWrap: 'wrap',
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
              }}
            >
              {winner.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Exakt HCP{' '}
              {winner.exactHandicap ?? '-'} · Spel-HCP {winner.playingHandicap ?? 0}
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

        <div className="card" style={{ marginBottom: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <h2
              style={{
                margin: 0,
                ...TYPE.sectionTitle,
              }}
            >
              Leaderboard
            </h2>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid #bbf7d0',
                background: '#f0fdf4',
                color: '#166534',
                flexWrap: 'wrap',
                ...TYPE.labelStrong,
              }}
            >
              <span>{roundTypeLabel}</span>
              <span style={{ opacity: 0.5 }}>•</span>
              <span>{scorecardModeLabel}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
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
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
        </div>

        {selectedPlayer ? (
          <div className="card">
            <div style={{ marginBottom: 12 }}>
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: 8,
                  ...TYPE.sectionTitle,
                }}
              >
                Scorekort
              </h2>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  paddingBottom: 4,
                }}
              >
                {summary.map((player) => {
                  const isActive = player.id === selectedPlayer.id

                  return (
                   <Link
  key={player.id}
  href={`/rounds/${id}/summary?player=${player.id}&hole=${returnHole}`}
  scroll={false}
  style={{
    flex: '0 0 auto',
    padding: '10px 14px',
    borderRadius: 999,
    border: isActive ? '1px solid #166534' : '1px solid #d1d5db',
    background: isActive ? '#166534' : '#fff',
    color: isActive ? '#fff' : '#0f172a',
    whiteSpace: 'nowrap',
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1,
  }}
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
                <div
                  style={{
                    marginBottom: 6,
                    wordBreak: 'break-word',
                    ...TYPE.cardTitleLg,
                  }}
                >
                  {selectedPlayer.name}
                </div>

                <div
                  style={{
                    marginBottom: 12,
                    ...TYPE.meta,
                  }}
                >
                  {selectedPlayer.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Spel-HCP{' '}
                  {selectedPlayer.playingHandicap ?? 0}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <div style={TYPE.label}>Tot</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>
                      {selectedPlayer.strokes}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <div style={TYPE.label}>Till par</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>
                      {formatVsPar(selectedPlayer.vsPar)}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <div style={TYPE.label}>P</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>
                      {selectedPlayer.points}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                      textAlign: 'center',
                    }}
                  >
                    <div style={TYPE.label}>Pos</div>
                    <div style={{ marginTop: 4, ...TYPE.statValueMd }}>
                      {selectedIndex + 1}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 14, display: 'grid', gap: 12 }}>
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
                  roundHoleIndexes={visibleHoleIndexes}
                  selectedPlayer={selectedPlayer}
                  scoringMode={round.scoring_mode}
                  totalLabel={isNineHoleRound ? 'Summa' : 'Ut'}
                />

                {!isNineHoleRound && secondHalf.length > 0 ? (
                  <ScoreTable
                    title="Bakre 9"
                    holes={secondHalf}
                    scores={selectedBackScores}
                    roundHoleIndexes={visibleHoleIndexes}
                    selectedPlayer={selectedPlayer}
                    scoringMode={round.scoring_mode}
                    totalLabel="In"
                  />
                ) : null}

                <h3
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
                    gridTemplateColumns: isNineHoleRound ? '1fr 1fr' : '1fr 1fr 1fr',
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
