export function scoreVsPar(strokes: number | null, par: number) {
  if (strokes == null) return null
  return strokes - par
}

export function stablefordPoints(
  strokes: number | null,
  par: number,
  receivedStrokes = 0
) {
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

  const courseHandicap =
    handicapIndex * (slopeRating / 113) + (courseRating - par)

  return Math.round(courseHandicap)
}

export function receivedStrokesOnHole(
  playingHandicap: number | null,
  holeIndex: number,
  holesCount: number
) {
  if (playingHandicap == null || playingHandicap <= 0) return 0

  let normalizedHoleIndex = holeIndex

  // För 9 hål måste hålens HCP-index normaliseras inom de spelade nio hålen.
  // Exempel främre 9 med index 12, 8, 18, 10, 2, 14, 4, 16, 6
  // blir inom rundan:             6, 4,  9,  5, 1,  7, 2,  8, 3
  if (holesCount === 9) {
    normalizedHoleIndex = Math.ceil(holeIndex / 2)
  }

  let strokes = Math.floor(playingHandicap / holesCount)
  const remainder = playingHandicap % holesCount

  if (remainder > 0 && normalizedHoleIndex <= remainder) {
    strokes += 1
  }

  return strokes
}