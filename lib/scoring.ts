export type TeeKey = 'yellow' | 'red'

export function isValidTeeKey(value: unknown): value is TeeKey {
  return value === 'yellow' || value === 'red'
}

export function normalizeTeeKey(value: unknown): TeeKey {
  return isValidTeeKey(value) ? value : 'yellow'
}

export function getTeeDisplayLabel(teeKey: TeeKey) {
  return teeKey === 'red' ? 'Röd tee (47)' : 'Gul tee (56)'
}

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
  if (handicapIndex == null || slopeRating == null || courseRating == null) {
    return 0
  }

  const courseHandicap =
    (handicapIndex * slopeRating) / 113 + (courseRating - par)

  return (courseHandicap * allowancePercent) / 100
}

export function getRoundedCourseHandicap(courseHandicap: number | null | undefined) {
  if (courseHandicap == null || !Number.isFinite(courseHandicap)) return 0
  return Math.round(courseHandicap)
}

export function getHandicapStrokesForHole(
  courseHandicap: number | null | undefined,
  holeIndex: number | null | undefined
) {
  const roundedCourseHandicap = getRoundedCourseHandicap(courseHandicap)

  if (roundedCourseHandicap <= 0 || holeIndex == null || holeIndex <= 0) {
    return 0
  }

  const baseStrokes = Math.floor(roundedCourseHandicap / 18)
  const extraStrokes = roundedCourseHandicap % 18

  return baseStrokes + (holeIndex <= extraStrokes ? 1 : 0)
}

export function getPlayingHandicapForSelectedHoles(
  courseHandicap: number | null | undefined,
  selectedHoleIndexes: Array<number | null | undefined>
) {
  return selectedHoleIndexes.reduce<number>((sum, holeIndex) => {
    return sum + getHandicapStrokesForHole(courseHandicap, holeIndex)
  }, 0)
}

export function receivedStrokesOnHole(
  playingHandicap: number,
  holeIndex: number,
  holesCount: number
) {
  if (!playingHandicap || playingHandicap <= 0) return 0
  if (!holeIndex || holeIndex <= 0) return 0

  const base = Math.floor(playingHandicap / holesCount)
  const remainder = playingHandicap % holesCount

  return base + (holeIndex <= remainder ? 1 : 0)
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