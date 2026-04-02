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
    minWidth: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    fontWeight: 700,
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
      borderRadius: 6,
      background: '#fff7ed',
    }
  }

  if (marker === 'double-square') {
    return {
      ...base,
      border: '2px solid #991b1b',
      borderRadius: 6,
      boxShadow: '0 0 0 4px #fee2e2',
      background: '#fff5f5',
    }
  }

  return base
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { id } = await params

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

  const visibleHoles = holes.filter(
    (hole) => hole.hole_number >= startHole && hole.hole_number <= endHole
  )

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

  const roundTypeLabel =
    round.scoring_mode === 'stableford' ? 'Stableford' : 'Slagspel'

  const holesLabel =
    round.holes_mode === 18
      ? '18 hål'
      : startHole === 1
      ? '9 hål · Främre 9'
      : '9 hål · Bakre 9'

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
              href={`/rounds/${id}?hole=${startHole}`}
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
            <div
              style={{
                display: 'grid',
                gap: 12,
              }}
            >
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

        <div className="card">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>Scorekort</h2>
          <p className="muted" style={{ marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
            Birdie = cirkel · Eagle eller bättre = dubbel cirkel · Bogey = fyrkant ·
            Double bogey+ = dubbel fyrkant
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Spelare</th>
                  {visibleHoles.map((hole) => (
                    <th key={hole.hole_number}>H{hole.hole_number}</th>
                  ))}
                  <th>Tot</th>
                  <th>+/-</th>
                  <th>P</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((player) => (
                  <tr key={player.id}>
                    <td>
                      <strong>{player.name}</strong>
                    </td>

                    {player.holeScores.map((score) => (
                      <td key={`${player.id}-${score.holeNumber}`}>
                        {score.strokes == null ? (
                          '-'
                        ) : (
                          <span style={getMarkerStyle(score.marker)}>
                            {score.strokes}
                          </span>
                        )}
                      </td>
                    ))}

                    <td>{player.strokes}</td>
                    <td>{player.vsPar > 0 ? `+${player.vsPar}` : player.vsPar}</td>
                    <td>{player.points}</td>
                  </tr>
                ))}

                <tr style={{ background: '#fafafa' }}>
                  <td>
                    <strong>Par</strong>
                  </td>
                  {visibleHoles.map((hole) => (
                    <td key={`par-${hole.hole_number}`}>
                      <strong>{hole.par}</strong>
                    </td>
                  ))}
                  <td>
                    <strong>
                      {visibleHoles.reduce((sum, hole) => sum + hole.par, 0)}
                    </strong>
                  </td>
                  <td>-</td>
                  <td>-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  )
}