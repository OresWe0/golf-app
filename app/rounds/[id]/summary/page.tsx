import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { receivedStrokesOnHole, scoreVsPar, stablefordPoints } from '@/lib/scoring'

function getScoreMarker(strokes: number | null, par: number) {
  if (strokes == null) return null

  const diff = strokes - par

  if (diff <= -2) return 'double-circle'
  if (diff === -1) return 'circle'
  if (diff === 1) return 'square'
  if (diff >= 2) return 'double-square'

  return null
}

function getMarkerStyle(marker: string | null): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 44,
    height: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 18,
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

function sumPar(holes: { par: number }[]) {
  return holes.reduce((sum, hole) => sum + hole.par, 0)
}

function HoleSummaryGrid({
  title,
  holes,
  scores,
  selectedPlayer,
  visibleHoleCount,
  scoringMode,
  totalLabel,
}: {
  title: string
  holes: any[]
  scores: any[]
  selectedPlayer: any
  visibleHoleCount: number
  scoringMode: string
  totalLabel: string
}) {
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)
  const strokesTotal = scores.reduce((sum, score) => sum + (score.strokes ?? 0), 0)
  const pointsTotal = scores.reduce((sum, score) => {
    if (score.strokes == null) return sum

    return (
      sum +
      stablefordPoints(
        score.strokes,
        score.par,
        receivedStrokesOnHole(
          selectedPlayer.playingHandicap,
          score.hcpIndex,
          visibleHoleCount
        )
      )
    )
  }, 0)

  return (
    <div>
      <div
        style={{
          marginBottom: 10,
          fontSize: 16,
          fontWeight: 800,
          color: '#166534',
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10,
        }}
      >
        {scores.map((score) => {
          const points =
            score.strokes == null
              ? null
              : stablefordPoints(
                  score.strokes,
                  score.par,
                  receivedStrokesOnHole(
                    selectedPlayer.playingHandicap,
                    score.hcpIndex,
                    visibleHoleCount
                  )
                )

          return (
            <div
              key={`${selectedPlayer.id}-${score.holeNumber}`}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 18,
                background: '#fff',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  background: '#1f9d55',
                  color: '#fff',
                  textAlign: 'center',
                  padding: '10px 8px',
                  fontWeight: 800,
                  fontSize: 15,
                }}
              >
                Hål {score.holeNumber}
              </div>

              <div
                style={{
                  padding: 12,
                  display: 'grid',
                  gap: 10,
                  textAlign: 'center',
                }}
              >
                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                    Par
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{score.par}</div>
                </div>

                <div>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Resultat
                  </div>
                  {score.strokes == null ? (
                    <div style={{ fontSize: 24, fontWeight: 900 }}>-</div>
                  ) : (
                    <span style={getMarkerStyle(score.marker)}>{score.strokes}</span>
                  )}
                </div>

                {scoringMode === 'stableford' ? (
                  <div>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                      Poäng
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {points == null ? '-' : points}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}

        <div
          style={{
            border: '1px solid #cfe7d4',
            borderRadius: 18,
            background: '#f8fbf7',
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <div
            style={{
              background: '#166534',
              color: '#fff',
              textAlign: 'center',
              padding: '10px 8px',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {totalLabel}
          </div>

          <div
            style={{
              padding: 12,
              display: 'grid',
              gap: 10,
              textAlign: 'center',
            }}
          >
            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Par
              </div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{parTotal}</div>
            </div>

            <div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                Resultat
              </div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{strokesTotal}</div>
            </div>

            {scoringMode === 'stableford' ? (
              <div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
                  Poäng
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{pointsTotal}</div>
              </div>
            ) : null}
          </div>
        </div>
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
    supabase.from('course_holes').select('*').eq('course_id', round.course_id).order('hole_number'),
  ])

  if (!course || !holes) notFound()

  const startHole = round.start_hole ?? 1
  const endHole = round.end_hole ?? holes.length
  const returnHole = Number(resolvedSearchParams.hole || startHole)

  const visibleHoles = holes.filter(
    (hole) => hole.hole_number >= startHole && hole.hole_number <= endHole
  )

  const firstHalf = visibleHoles.slice(0, Math.ceil(visibleHoles.length / 2))
  const secondHalf = visibleHoles.slice(Math.ceil(visibleHoles.length / 2))

  const summary = players
    .map((player) => {
      const rows = scoreRows.filter(
        (row) =>
          row.round_player_id === player.id &&
          row.hole_number >= startHole &&
          row.hole_number <= endHole
      )

      const strokes = rows.reduce((sum, row) => sum + (row.strokes ?? 0), 0)

      const vsPar = rows.reduce((sum, row) => {
        const hole = visibleHoles.find((item) => item.hole_number === row.hole_number)
        return sum + (hole ? (scoreVsPar(row.strokes, hole.par) ?? 0) : 0)
      }, 0)

      const points = rows.reduce((sum, row) => {
        const hole = visibleHoles.find((item) => item.hole_number === row.hole_number)
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

      const holeScores = visibleHoles.map((hole) => {
        const row = rows.find((item) => item.hole_number === hole.hole_number)
        const strokes = row?.strokes ?? null

        return {
          holeNumber: hole.hole_number,
          par: hole.par,
          hcpIndex: hole.hcp_index,
          strokes,
          marker: getScoreMarker(strokes, hole.par),
        }
      })

      return {
        id: player.id,
        name: player.display_name,
        strokes,
        vsPar,
        points,
        exactHandicap: player.exact_handicap,
        playingHandicap: player.playing_handicap,
        teeKey: player.tee_key,
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
    ? selectedPlayer.holeScores.filter((score: any) =>
        firstHalf.some((hole) => hole.hole_number === score.holeNumber)
      )
    : []

  const selectedBackScores = selectedPlayer
    ? selectedPlayer.holeScores.filter((score: any) =>
        secondHalf.some((hole) => hole.hole_number === score.holeNumber)
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
              background: 'linear-gradient(180deg, #f8fbf7 0%, #f2f9f3 100%)',
              border: '2px solid #dbeedc',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#166534',
                }}
              >
                🏆 Vinnare
              </div>

              <div
                style={{
                  fontSize: 36,
                  fontWeight: 900,
                  lineHeight: 1.05,
                  color: '#0f172a',
                  wordBreak: 'break-word',
                }}
              >
                {winner.name}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
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
                      fontSize: 13,
                      color: '#64748b',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
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
                      fontSize: 13,
                      color: '#64748b',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 6,
                    }}
                  >
                    Mot par
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>
                    {winner.vsPar > 0 ? `+${winner.vsPar}` : winner.vsPar}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0, marginBottom: 14 }}>Leaderboard</h2>

          <div style={{ display: 'grid', gap: 12 }}>
            {summary.map((player, index) => (
              <div
                key={player.id}
                style={{
                  border: index === 0 ? '2px solid #cce9d1' : '1px solid #e5e7eb',
                  background: index === 0 ? '#f8fbf7' : '#ffffff',
                  borderRadius: 18,
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
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        wordBreak: 'break-word',
                      }}
                    >
                      {index === 0 ? '👑 ' : ''}
                      {index + 1}. {player.name}
                    </div>

                    <div className="muted" style={{ marginTop: 6 }}>
                      {player.teeKey === 'red' ? 'Röd tee' : 'Gul tee'} · Exakt HCP{' '}
                      {player.exactHandicap ?? '-'} · Spel-HCP {player.playingHandicap ?? 0}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: index === 0 ? '#e8f5e9' : '#f3f4f6',
                      fontSize: 13,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    #{index + 1}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      Slag
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>{player.strokes}</div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      Mot par
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>
                      {player.vsPar > 0 ? `+${player.vsPar}` : player.vsPar}
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e5e7eb',
                      borderRadius: 14,
                      padding: 12,
                    }}
                  >
                    <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
                      Poäng
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 900 }}>{player.points}</div>
                  </div>
                </div>
              </div>
            ))}
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
                  Välj spelare. Alla hål visas direkt utan sidscroll.
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
                      gridTemplateColumns: 'repeat(3, auto)',
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
                        {selectedPlayer.vsPar > 0
                          ? `+${selectedPlayer.vsPar}`
                          : selectedPlayer.vsPar}
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
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, display: 'grid', gap: 16 }}>
                <HoleSummaryGrid
                  title="Främre 9"
                  holes={firstHalf}
                  scores={selectedFrontScores}
                  selectedPlayer={selectedPlayer}
                  visibleHoleCount={visibleHoles.length}
                  scoringMode={round.scoring_mode}
                  totalLabel="Summa främre"
                />

                {secondHalf.length > 0 ? (
                  <HoleSummaryGrid
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
                    gridTemplateColumns: '1fr 1fr 1fr',
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