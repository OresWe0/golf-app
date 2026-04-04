'use client'

import React from 'react'
import { receivedStrokesOnHole, stablefordPoints } from '@/lib/scoring'

// Typer för hålpoäng och spelare
type HoleScore = {
  holeNumber: number
  par: number
  hcpIndex: number
  strokes: number | null
  marker: string | null
}

type SelectedPlayer = {
  id: string
  playingHandicap: number
}

interface Props {
  title: string
  holes: { par: number }[]
  scores: HoleScore[]
  selectedPlayer: SelectedPlayer
  visibleHoleCount: number
  scoringMode: string
  totalLabel?: string
}

export default function HoleSummaryStrip({
  title,
  holes,
  scores,
  selectedPlayer,
  visibleHoleCount,
  scoringMode,
}: Props) {
  // Summera par och slag
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)
  const strokesTotal = scores.reduce((sum, score) => {
    if (score.strokes == null) return sum
    return sum + score.strokes
  }, 0)

  // Beräkna Stableford-poäng per hål
  const pointsPerHole = scores.map((score) => {
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
  const pointsTotal = pointsPerHole.reduce((sum, p) => sum + (p ?? 0), 0)

  const showPoints = scoringMode === 'stableford'
  const scoringLabel =
    scoringMode === 'stableford'
      ? 'Poängbogey'
      : scoringMode === 'strokeplay'
      ? 'Slagspel'
      : scoringMode

  // Funktionen för färgkodade celler baserat på markör
  const getResultClass = (marker: string | null) => {
    switch (marker) {
      case 'circle':
        return 'border-2 border-green-700 rounded-full'
      case 'double-circle':
        return 'border-2 border-green-700 rounded-full shadow-[0_0_0_4px_#d1fae5]'
      case 'square':
        return 'border-2 border-yellow-700 rounded-lg bg-yellow-50'
      case 'double-square':
        return 'border-2 border-red-700 rounded-lg bg-red-50 shadow-[0_0_0_4px_#fee2e2]'
      default:
        return ''
    }
  }

  return (
    <div>
      {/* Titel på sektionen */}
      <h3 className="mb-2 text-base font-bold text-green-700">{title}</h3>

      {/* Scrollbar runt tabellen för små skärmar */}
      <div className="overflow-x-auto border border-gray-300 rounded-2xl bg-white">
        <table className="min-w-full text-sm">
          <thead>
            {/* Hålrader med sticky cell till vänster och total till höger */}
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 px-2 py-1 text-left font-semibold bg-gray-50">
                Hål
              </th>
              {scores.map((score) => (
                <th
                  key={`hole-${score.holeNumber}`}
                  className="px-2 py-1 text-center font-semibold"
                >
                  {score.holeNumber}
                </th>
              ))}
              <th className="px-2 py-1 text-center font-semibold text-green-700">
                Σ
              </th>
            </tr>
            <tr className="bg-gray-100">
              <th className="sticky left-0 z-10 px-2 py-1 text-left font-semibold bg-gray-100">
                Par
              </th>
              {scores.map((score) => (
                <th
                  key={`par-${score.holeNumber}`}
                  className="px-2 py-1 text-center"
                >
                  {score.par}
                </th>
              ))}
              <th className="px-2 py-1 text-center">{parTotal}</th>
            </tr>
          </thead>
          <tbody>
            {/* Resultatrad med färgkodade celler */}
            <tr>
              <td className="sticky left-0 z-10 px-2 py-1 font-medium bg-white">
                Res
              </td>
              {scores.map((score) => (
                <td key={`res-${score.holeNumber}`} className="px-2 py-1 text-center">
                  {score.strokes == null ? (
                    <span className="text-gray-400">-</span>
                  ) : (
                    <span
                      className={`inline-flex w-9 h-9 items-center justify-center font-bold ${getResultClass(
                        score.marker
                      )}`}
                    >
                      {score.strokes}
                    </span>
                  )}
                </td>
              ))}
              <td className="px-2 py-1 text-center font-semibold">{strokesTotal}</td>
            </tr>

            {/* Poängrad visas endast i Poängbogey-läge */}
            {showPoints && (
              <tr>
                <td className="sticky left-0 z-10 px-2 py-1 font-medium bg-white">P</td>
                {pointsPerHole.map((points, index) => (
                  <td
                    key={`points-${scores[index].holeNumber}`}
                    className="px-2 py-1 text-center"
                  >
                    {points == null ? (
                      <span className="text-gray-400">-</span>
                    ) : (
                      points
                    )}
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-semibold">{pointsTotal}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend och scoreringsmetod längst ner */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-green-700" />
          bättre hål
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-lg border-2 border-red-700 bg-red-50" />
          svagare hål
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-green-700 shadow-[0_0_0_3px_#d1fae5]" />
          dubblat bättre hål
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-lg border-2 border-yellow-700 bg-yellow-50" />
          dubblat svagare hål
        </span>
        <span className="ml-auto inline-flex items-center font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
          {scoringLabel}
        </span>
      </div>
    </div>
  )
}
