export function scoreVsPar(strokes: number | null, par: number) {
  if (strokes == null) return null
  return strokes - par
}

export function stablefordPoints(strokes: number | null, par: number, receivedStrokes = 0) {
  if (strokes == null) return 0
  const net = strokes - receivedStrokes
  const diff = net - par
  if (diff <= -3) return 5
  if (diff === -2) return 4
  if (diff === -1) return 3
  if (diff === 0) return 2
  if (diff === 1) return 1
  return 0
}

export function calculatePlayingHandicap({
  handicapIndex,
  slopeRating,
  courseRating,
  par,
}: {
  handicapIndex: number | null
  slopeRating: number | null
  courseRating: number | null
  par: number
}) {
  if (handicapIndex == null || slopeRating == null || courseRating == null) {
    return handicapIndex == null ? 0 : Math.round(handicapIndex)
  }

  const courseHandicap = handicapIndex * (slopeRating / 113) + (courseRating - par)
  return Math.round(courseHandicap)
}

export function receivedStrokesOnHole(playingHandicap: number | null, holeIndex: number, holesCount: number) {
  if (playingHandicap == null || playingHandicap <= 0) return 0
  let strokes = Math.floor(playingHandicap / holesCount)
  const remainder = playingHandicap % holesCount
  if (remainder > 0 && holeIndex <= remainder) strokes += 1
  return strokes
}
