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
    width: 34,
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 16,
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
      boxShadow: '0 0 0 4px #d1fae5',
    }
  }

  if (marker === 'square') {
    return {
      ...base,
      border: '2px solid #b45309',
      borderRadius: 8,
      background: '#fff7ed',
    }
  }

  if (marker === 'double-square') {
    return {
      ...base,
      border: '2px solid #991b1b',
      borderRadius: 8,
      boxShadow: '0 0 0 4px #fee2e2',
      background: '#fff5f5',
    }
  }

  return base
}

function sumPar(holes: Array<{ par: number }>) {
  return holes.reduce((sum, hole) => sum + hole.par, 0)
}

function formatVsPar(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

function getMedal(index: number) {
  if (index === 0) return '🥇'
  if (index === 1) return '🥈'
  if (index === 2) return '🥉'
  return null
}

function SummaryTableSection({
  title,
  holes,
  scores,
  selectedPlayer,
  visibleHoleCount,
  scoringMode,
  totalLabel,
}: {
  title: string
  holes: Array<{ par: number }>
  scores: HoleScoreView[]
  selectedPlayer: Pick<SummaryPlayer, 'playingHandicap'>
  visibleHoleCount: number
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
      receivedStrokesOnHole(
        selectedPlayer.playingHandicap,
        score.hcpIndex,
        visibleHoleCount
      )
    )
  })

  const pointsTotal = pointsPerHole.reduce((sum: number, points: number | null) => {
    return sum + (points ?? 0)
  }, 0)

  const showPoints = scoringMode === 'stableford'

  return (
    <div>
      <div
        style={{
          marginBottom: 10,
          fontSize: 18,
          fontWeight: 900,
          color: '#166534',
        }}
      >
        {title}
      </div>

      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #dbe4dd',
          borderRadius: 20,
          background: '#fff',
        }}
      >
        <table
          style={{
            width: '100%',
            minWidth: 720,
            borderCollapse: 'separate',
            borderSpacing: 0,
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ background: '#f8fbf7' }}>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  background: '#f8fbf7',
                  textAlign: 'left',
                  padding: '12px 14px',
                  fontWeight: 800,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                Hål
              </th>

              {scores.map((score) => (
                <th
                  key={`hole-${score.holeNumber}`}
                  style={{
                    padding: '12px 10px',
                    textAlign: 'center',
                    fontWeight: 800,
                    borderBottom: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {score.holeNumber}
                </th>
              ))}

              <th
                style={{
                  padding: '12px 14px',
                  textAlign: 'center',
                  fontWeight: 900,
                  color: '#166534',
                  borderBottom: '1px solid #e5e7eb',
                  whiteSpace: 'nowrap',
                }}
              >
                {totalLabel}
              </th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  background: '#fff',
                  padding: '12px 14px',
                  fontWeight: 700,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                Par
              </td>

              {scores.map((score) => (
                <td
                  key={`par-${score.holeNumber}`}
                  style={{
                    padding: '12px 10px',
                    textAlign: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    color: '#334155',
                  }}
                >
                  {score.par}
                </td>
              ))}

              <td
                style={{
                  padding: '12px 14px',
                  textAlign: 'center',
                  fontWeight: 900,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                {parTotal}
              </td>
            </tr>

            <tr>
              <td
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  background: '#fff',
                  padding: '12px 14px',
                  fontWeight: 700,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                Resultat
              </td>

              {scores.map((score) => (
                <td
                  key={`res-${score.holeNumber}`}
                  style={{
                    padding: '12px 10px',
                    textAlign: 'center',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  {score.strokes == null ? (
                    <span
                      style={{
                        color: '#94a3b8',
                        fontWeight: 700,
                      }}
                    >
                      -
                    </span>
                  ) : (
                    <span style={markerStyle(score.marker)}>{score.strokes}</span>
                  )}
                </td>
              ))}

              <td
                style={{
                  padding: '12px 14px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: 18,
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                {strokesTotal}
              </td>
            </tr>

            {showPoints ? (
              <tr>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    background: '#fff',
                    padding: '12px 14px',
                    fontWeight: 700,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  Poäng
                </td>

                {pointsPerHole.map((points, index) => (
                  <td
                    key={`points-${scores[index].holeNumber}`}
                    style={{
                      padding: '12px 10px',
                      textAlign: 'center',
                      borderBottom: '1px solid #f1f5f9',
                      fontWeight: 700,
                    }}
                  >
                    {points == null ? (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    ) : (
                      points
                    )}
                  </td>
                ))}

                <td
                  style={{
                    padding: '12px 14px',
                    textAlign: 'center',
                    fontWeight: 900,
                    fontSize: 18,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  {pointsTotal}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
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

  const firstHalf = visibleHoles.slice(0, Math.ceil(visibleHoles.length / 2))
  const secondHalf = visibleHoles.slice(Math.ceil(visibleHoles.length / 2))

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
        if (!hole) return sum

        return (
          sum +
          stablefordPoints(
            row.strokes,
            hole.par,
            receivedStrokesOnHole(
              player.playing_handicap,
              hole.hcp_index,
              visibleHoles.length
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
    round.scoring_mode === 'stableford' ? 'Stableford' : 'Slagspel'

  const holesLabel =
    round.holes_mode === 18
      ? '18 hål'
      : startHole === 1
      ? '9 hål · Främre 9'
      : '9 hål · Bakre 9'

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
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <h1 style={{ marginBottom: 10 }}>{round.title}</h1>
            <p className="muted" style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>
              {course.name} · {roundTypeLabel} · {holesLabel}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            <Link
              className="button"
              href={`/rounds/${id}?hole=${returnHole}`}
              style={{
                width: '100%',
                minHeight: 56,
                fontSize: 18,
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
                minHeight: 56,
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              Till dashboard
            </Link>
          </div>
        </div>

        {winner ? (
          <div
            className="card"
            style={{
              background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)',
              border: '2px solid #bbf7d0',
              marginBottom: 16,
              boxShadow: '0 10px 30px rgba(22, 101, 52, 0.08)',
            }}
          >
            <div style={{ display: 'grid', gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#dcfce7',
                    color: '#166534',
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  🏆 Vinnare
                </div>

                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: '#ffffff',
                    border: '1px solid #d1fae5',
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#166534',
                  }}
                >
                  {roundTypeLabel}
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: 38,
                    fontWeight: 900,
                    lineHeight: 1.05,
                    color: '#0f172a',
                    wordBreak: 'break-word',
                    marginBottom: 6,
                  }}
                >
                  {winner.name}
                </div>

                <div className="muted" style={{ lineHeight: 1.5 }}>
                  {winner.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Exakt HCP{' '}
                  {winner.exactHandicap ?? '-'} · Spel-HCP {winner.playingHandicap ?? 0}
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                    }}
                  >
                    Resultat
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>
                    {round.scoring_mode === 'stableford'
                      ? `${winner.points} p`
                      : `${winner.strokes} slag`}
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                    }}
                  >
                    Mot par
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>
                    {formatVsPar(winner.vsPar)}
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748b',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 6,
                    }}
                  >
                    Position
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>1</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0 }}>Leaderboard</h2>

            <div
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {roundTypeLabel}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {summary.map((player, index) => {
              const medal = getMedal(index)
              const scoreValue =
                round.scoring_mode === 'stableford'
                  ? `${player.points} p`
                  : `${player.strokes} slag`

              return (
                <div
                  key={player.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: index === 0 ? '16px' : '14px',
                    borderRadius: 18,
                    border: index === 0 ? '2px solid #86efac' : '1px solid #e5e7eb',
                    background:
                      index === 0
                        ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)'
                        : '#ffffff',
                    boxShadow:
                      index === 0 ? '0 8px 24px rgba(22, 101, 52, 0.08)' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        index === 0 ? '#166534' : index < 3 ? '#f3f4f6' : '#f8fafc',
                      color: index === 0 ? '#ffffff' : '#0f172a',
                      fontWeight: 900,
                      fontSize: 18,
                      flexShrink: 0,
                    }}
                  >
                    {medal ?? index + 1}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontSize: index === 0 ? 24 : 20,
                          fontWeight: 900,
                          lineHeight: 1.1,
                          color: '#0f172a',
                          wordBreak: 'break-word',
                        }}
                      >
                        {player.name}
                      </div>

                      {index === 0 ? (
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: '#dcfce7',
                            color: '#166534',
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          Leder
                        </span>
                      ) : null}
                    </div>

                    <div
                      className="muted"
                      style={{
                        fontSize: 14,
                        lineHeight: 1.4,
                      }}
                    >
                      {player.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Exakt HCP{' '}
                      {player.exactHandicap ?? '-'} · Spel-HCP {player.playingHandicap ?? 0}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e5e7eb',
                          minWidth: 78,
                        }}
                      >
                        <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                          Slag
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>
                          {player.strokes}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e5e7eb',
                          minWidth: 78,
                        }}
                      >
                        <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                          Mot par
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>
                          {formatVsPar(player.vsPar)}
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 12,
                          background:
                            round.scoring_mode === 'stableford' ? '#eff6ff' : '#f8fafc',
                          border: '1px solid #e5e7eb',
                          minWidth: 78,
                        }}
                      >
                        <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>
                          Poäng
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>
                          {player.points}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      minWidth: 82,
                      alignSelf: 'center',
                    }}
                  >
                    <div
                      className="muted"
                      style={{
                        fontSize: 12,
                        marginBottom: 4,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}
                    >
                      Resultat
                    </div>
                    <div
                      style={{
                        fontSize: index === 0 ? 24 : 20,
                        fontWeight: 900,
                        color: '#166534',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {scoreValue}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedPlayer ? (
          <div className="card">
            <div
              style={{
                display: 'grid',
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <h2 style={{ marginTop: 0, marginBottom: 8 }}>Scorekort</h2>
                <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
                  Välj spelare och få en kompakt överblick över hela rundan.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-x',
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
                        border: isActive
                          ? '1px solid #166534'
                          : '1px solid #d1d5db',
                        background: isActive ? '#166534' : '#ffffff',
                        color: isActive ? '#ffffff' : '#0f172a',
                        fontWeight: 800,
                        fontSize: 14,
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
                border: '1px solid #e5e7eb',
                borderRadius: 20,
                overflow: 'hidden',
                background: '#fff',
              }}
            >
              <div
                style={{
                  padding: 16,
                  background: '#f8fbf7',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        lineHeight: 1.05,
                        wordBreak: 'break-word',
                      }}
                    >
                      {selectedPlayer.name}
                    </div>

                    <div className="muted" style={{ marginTop: 4 }}>
                      {selectedPlayer.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Spel-HCP{' '}
                      {selectedPlayer.playingHandicap ?? 0}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, auto)',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: '10px 14px',
                        textAlign: 'center',
                        minWidth: 76,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        Tot
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {selectedPlayer.strokes}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: '10px 14px',
                        textAlign: 'center',
                        minWidth: 76,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        +/-
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {formatVsPar(selectedPlayer.vsPar)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: '10px 14px',
                        textAlign: 'center',
                        minWidth: 76,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        P
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {selectedPlayer.points}
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: 14,
                        padding: '10px 14px',
                        textAlign: 'center',
                        minWidth: 76,
                      }}
                    >
                      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                        Pos
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 900 }}>
                        {selectedIndex + 1}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, display: 'grid', gap: 18 }}>
                <SummaryTableSection
                  title="Främre 9"
                  holes={firstHalf}
                  scores={selectedFrontScores}
                  selectedPlayer={selectedPlayer}
                  visibleHoleCount={visibleHoles.length}
                  scoringMode={round.scoring_mode}
                  totalLabel="Summa främre"
                />

                {secondHalf.length > 0 ? (
                  <SummaryTableSection
                    title="Bakre 9"
                    holes={secondHalf}
                    scores={selectedBackScores}
                    selectedPlayer={selectedPlayer}
                    visibleHoleCount={visibleHoles.length}
                    scoringMode={round.scoring_mode}
                    totalLabel="Summa bakre"
                  />
                ) : null}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
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
                      Total par
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
                      Resultat
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>
                      {selectedPlayer.strokes}
                    </div>
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
                      Mot par
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>
                      {formatVsPar(selectedPlayer.vsPar)}
                    </div>
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
                      Position
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>
                      {selectedIndex + 1}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  )
}