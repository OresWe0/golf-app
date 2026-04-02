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
    fontWeight: 600,
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

  return (
    <main>
      <div className="container">
        <div className="nav">
          <div>
            <span className="badge">📊 Summary</span>
            <h1>{round.title}</h1>
            <p className="muted">
              {course.name} ·{' '}
              {round.scoring_mode === 'stableford' ? 'Stableford' : 'Slagspel'} ·{' '}
              {round.holes_mode === 18
                ? '18 hål'
                : startHole === 1
                ? '9 hål · Främre 9'
                : '9 hål · Bakre 9'}
            </p>
          </div>

          <div className="row">
            <Link className="button secondary" href={`/rounds/${id}?hole=${startHole}`}>
              Till rundan
            </Link>
            <Link className="button secondary" href="/dashboard">
              Till dashboard
            </Link>
          </div>
        </div>

        {winner ? (
          <div
            className="card"
            style={{
              background: '#f8fbf7',
              border: '2px solid #dbeedc',
            }}
          >
            <h2 style={{ marginBottom: 8 }}>🏆 Vinnare</h2>
            <p style={{ margin: 0 }}>
              <strong>{winner.name}</strong>{' '}
              {round.scoring_mode === 'stableford'
                ? `vinner på ${winner.points} poäng`
                : `vinner på ${winner.strokes} slag`}
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Mot par: {winner.vsPar > 0 ? `+${winner.vsPar}` : winner.vsPar}
            </p>
          </div>
        ) : null}

        <div className="card">
          <h3>Slutställning</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Placering</th>
                <th>Spelare</th>
                <th>Tee</th>
                <th>Exakt HCP</th>
                <th>Spel-HCP</th>
                <th>Slag</th>
                <th>Mot par</th>
                <th>Poäng</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((player, index) => (
                <tr
                  key={player.id}
                  style={
                    index === 0
                      ? { background: '#f8fbf7', fontWeight: 600 }
                      : undefined
                  }
                >
                  <td>{index === 0 ? '👑 1' : index + 1}</td>
                  <td>{player.name}</td>
                  <td>{player.teeKey === 'red' ? 'Röd' : 'Gul'}</td>
                  <td>{player.exactHandicap ?? '-'}</td>
                  <td>{player.playingHandicap ?? 0}</td>
                  <td>{player.strokes}</td>
                  <td>{player.vsPar > 0 ? `+${player.vsPar}` : player.vsPar}</td>
                  <td>{player.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Scorekort</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Birdie = cirkel · Eagle eller bättre = dubbel cirkel · Bogey = fyrkant · Double bogey+ = dubbel fyrkant
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