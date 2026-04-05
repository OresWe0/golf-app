import type { CSSProperties } from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { receivedStrokesOnHole, scoreVsPar, stablefordPoints } from '@/lib/scoring'

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

function ScoreTable({
  title,
  holes,
  scores,
  selectedPlayer,
  scoringMode,
  totalLabel,
  handicapHoleCount,
}: {
  title: string
  holes: HoleLike[]
  scores: HoleScoreView[]
  selectedPlayer: Pick<SummaryPlayer, 'playingHandicap'>
  scoringMode: string
  totalLabel: string
  handicapHoleCount: number
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
      receivedStrokesOnHole(
        selectedPlayer.playingHandicap ?? 0,
        score.hcpIndex,
        handicapHoleCount
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
            fontWeight: 900,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
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
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    background: '#f8fbf7',
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
                      fontWeight: 900,
                      minWidth: 38,
                    }}
                  >
                    {score.holeNumber}
                  </th>
                ))}
                <th
                  style={{
                    textAlign: 'center',
                    padding: '12px 10px',
                    fontSize: 16,
                    fontWeight: 900,
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
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderTop: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#64748b',
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
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    borderTop: '1px solid #e5e7eb',
                    background: '#fcfcfc',
                    color: '#475569',
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
                    fontWeight: 900,
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
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    borderTop: '2px solid #d1fae5',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: 16,
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
                    fontSize: 22,
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
                      fontSize: 16,
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
                      fontSize: 22,
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
    supabase.from('rounds').select('*').eq('id', id).single(),
    supabase.from('round_players').select('*').eq('round_id', id).order('sort_order'),
    supabase.from('hole_scores').select('*').eq('round_id', id).order('hole_number'),
  ])

  if (!round || !players || !scoreRows) notFound()

  const [{ data: course }, { data: holes }] = await Promise.all([
    supabase.from('courses').select('*').eq('id', round.course_id).single(),
    supabase
      .from('course_holes')
      .select('*')
      .eq('course_id', round.course_id)
      .order('hole_number'),
  ])

  if (!course || !holes) notFound()

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length
  const returnHole = Number(resolvedSearchParams.hole || startHole)

  const visibleHoles = holes.filter(
    (hole: HoleLike) => hole.hole_number >= startHole && hole.hole_number <= endHole
  )

  const handicapHoleCount = visibleHoles.length
  const isNineHoleRound = round.holes_mode === 9

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
            receivedStrokesOnHole(
              player.playing_handicap ?? 0,
              hole.hcp_index,
              handicapHoleCount
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

  const selectedPlayer =
    summary.find((player) => player.id === resolvedSearchParams.player) ?? summary[0]

  const selectedIndex = summary.findIndex((player) => player.id === selectedPlayer?.id)

  const roundTypeLabel =
    round.scoring_mode === 'stableford' ? 'Poängbogey' : 'Slagspel'

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
            <h1 style={{ marginBottom: 6 }}>{round.title}</h1>
            <p className="muted" style={{ margin: 0, fontSize: 18, lineHeight: 1.35 }}>
              {course.name} · {roundTypeLabel} · {holesLabel}
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
              className="button"
              href={`/rounds/${id}?hole=${returnHole}`}
              style={{
                width: '100%',
                minHeight: 50,
                fontSize: 17,
                fontWeight: 800,
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
                fontSize: 17,
                fontWeight: 800,
              }}
            >
              Dashboard
            </Link>
          </div>
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
                  fontWeight: 900,
                  fontSize: 13,
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
                  fontWeight: 800,
                  fontSize: 13,
                  flexWrap: 'wrap',
                }}
              >
                <span>{roundTypeLabel}</span>
                <span style={{ opacity: 0.5 }}>•</span>
                <span>{scorecardModeLabel}</span>
              </div>
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                lineHeight: 1.05,
                marginBottom: 8,
                wordBreak: 'break-word',
              }}
            >
              {winner.name}
            </div>

            <div className="muted" style={{ marginBottom: 12 }}>
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
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Resultat
                </div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
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
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Till par
                </div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>
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
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Position
                </div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>1</div>
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
            <h2 style={{ margin: 0 }}>Leaderboard</h2>

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
                fontWeight: 800,
                fontSize: 13,
                flexWrap: 'wrap',
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
                        fontSize: 22,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        wordBreak: 'break-word',
                      }}
                    >
                      {player.name}
                    </div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
                      HCP {player.exactHandicap ?? '-'} · Spel-HCP {player.playingHandicap}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Resultat
                    </div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#166534',
                        whiteSpace: 'nowrap',
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
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      Slag
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{player.strokes}</div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      Till par
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
                      {formatVsPar(player.vsPar)}
                    </div>
                  </div>

                  <div
                    style={{
                      background:
                        round.scoring_mode === 'stableford' ? '#eff6ff' : '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 10,
                    }}
                  >
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      Poäng
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{player.points}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedPlayer ? (
          <div className="card">
            <div style={{ marginBottom: 12 }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>Scorekort</h2>

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
                      style={{
                        flex: '0 0 auto',
                        padding: '10px 14px',
                        borderRadius: 999,
                        border: isActive ? '1px solid #166534' : '1px solid #d1d5db',
                        background: isActive ? '#166534' : '#fff',
                        color: isActive ? '#fff' : '#0f172a',
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
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
                    fontSize: 28,
                    fontWeight: 900,
                    lineHeight: 1.05,
                    marginBottom: 6,
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedPlayer.name}
                </div>

                <div className="muted" style={{ marginBottom: 12 }}>
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
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      Tot
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
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
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      Till par
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
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
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      P
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
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
                    <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                      Pos
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>
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
                  selectedPlayer={selectedPlayer}
                  scoringMode={round.scoring_mode}
                  totalLabel={isNineHoleRound ? 'Summa' : 'Ut'}
                  handicapHoleCount={handicapHoleCount}
                />

                {!isNineHoleRound && secondHalf.length > 0 ? (
                  <ScoreTable
                    title="Bakre 9"
                    holes={secondHalf}
                    scores={selectedBackScores}
                    selectedPlayer={selectedPlayer}
                    scoringMode={round.scoring_mode}
                    totalLabel="In"
                    handicapHoleCount={handicapHoleCount}
                  />
                ) : null}

                <h3 style={{ margin: '4px 0 2px 0' }}>
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
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      {isNineHoleRound ? 'Par (9 hål)' : 'Total par'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>{totalPar}</div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 14,
                    }}
                  >
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      {isNineHoleRound ? 'Resultat (9 hål)' : 'Resultat'}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>
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
                      <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                        Position
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
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