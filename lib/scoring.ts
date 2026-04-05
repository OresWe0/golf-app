export function calculatePlayingHandicap({
  handicapIndex,
  slopeRating,
  courseRating,
  par,
  allowancePercent = 100,
}: {
  handicapIndex: number | null
  slopeRating: number | null
  courseRating: number | null
  par: number
  allowancePercent?: number
}) {
  if (
    handicapIndex == null ||
    slopeRating == null ||
    courseRating == null
  ) {
    return 0
  }

  const courseHandicap =
    (handicapIndex * slopeRating) / 113 + (courseRating - par)

  // ❗ Ingen rounding här
  return (courseHandicap * allowancePercent) / 100
}

export function receivedStrokesOnHole(
  playingHandicap: number,
  holeIndex: number,
  holesCount: number
) {
  if (!playingHandicap || playingHandicap <= 0) return 0

  let normalizedHoleIndex = holeIndex

  // ✅ 9 hål → mappa 1–18 till 1–9
  if (holesCount === 9) {
    normalizedHoleIndex = Math.ceil(holeIndex / 2)
  }

  const base = Math.floor(playingHandicap / holesCount)
  const remainder = playingHandicap % holesCount

  return base + (normalizedHoleIndex <= remainder ? 1 : 0)
}

export function stablefordPoints(
  strokes: number | null,
  par: number,
  receivedStrokes: number
) {
  if (strokes == null) return 0

  const netScore = strokes - receivedStrokes
  const diff = netScore - par

  if (diff <= -3) return 5
  if (diff === -2) return 4
  if (diff === -1) return 3
  if (diff === 0) return 2
  if (diff === 1) return 1

  return 0
}

export function scoreVsPar(strokes: number | null, par: number) {
  if (strokes == null) return null
  return strokes - par
}