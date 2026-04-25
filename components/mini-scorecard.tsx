type Hole = {
  holeNumber: number
  par: number
}

type Score = {
  holeNumber: number
  strokes: number
}

export function MiniScorecard({
  holes,
  scores
}: {
  holes: Hole[]
  scores: Score[]
}) {
  function getScoreType(strokes: number, par: number) {
    const diff = strokes - par

    if (strokes === 1) return 'hio'
    if (diff <= -3) return 'albatross'
    if (diff === -2) return 'eagle'
    if (diff === -1) return 'birdie'
    if (diff === 0) return 'par'
    if (diff === 1) return 'bogey'
    return 'double'
  }

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {holes.map((hole) => {
        const score = scores.find(s => s.holeNumber === hole.holeNumber)
        const strokes = score?.strokes

        if (!strokes) {
          return (
            <div key={hole.holeNumber} className="hole empty">
              -
            </div>
          )
        }

        const type = getScoreType(strokes, hole.par)

        return (
          <div key={hole.holeNumber} className={`hole ${type}`}>
            {strokes}
          </div>
        )
      })}
    </div>
  )
}