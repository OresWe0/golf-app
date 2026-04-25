'use client'

import React from 'react'
import { getReceivedStrokesForSelectedHole, stablefordPoints } from '@/lib/scoring'

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

function getScoreMeta(strokes: number | null, par: number) {
  if (strokes == null) {
    return {
      label: 'Ej spelat',
      shortLabel: '-',
      className: 'score-empty',
      symbol: '-',
    }
  }

  if (strokes === 1) {
    return {
      label: 'Hole in one',
      shortLabel: 'HIO',
      className: 'score-hio',
      symbol: '★',
    }
  }

  const diff = strokes - par

  if (diff <= -3) {
    return {
      label: 'Albatross',
      shortLabel: 'ALB',
      className: 'score-albatross',
      symbol: '◆',
    }
  }

  if (diff === -2) {
    return {
      label: 'Eagle',
      shortLabel: 'EAG',
      className: 'score-eagle',
      symbol: '◎',
    }
  }

  if (diff === -1) {
    return {
      label: 'Birdie',
      shortLabel: 'BIR',
      className: 'score-birdie',
      symbol: '○',
    }
  }

  if (diff === 0) {
    return {
      label: 'Par',
      shortLabel: 'PAR',
      className: 'score-par',
      symbol: '',
    }
  }

  if (diff === 1) {
    return {
      label: 'Bogey',
      shortLabel: 'BOG',
      className: 'score-bogey',
      symbol: '□',
    }
  }

  return {
    label: 'Dubbelbogey+',
    shortLabel: 'DBL+',
    className: 'score-double',
    symbol: '▣',
  }
}

function formatToPar(value: number) {
  if (value === 0) return 'E'
  if (value > 0) return `+${value}`
  return `${value}`
}

export default function HoleSummaryStrip({
  title,
  holes,
  scores,
  selectedPlayer,
  visibleHoleCount,
  scoringMode,
}: Props) {
  const parTotal = holes.reduce((sum, hole) => sum + hole.par, 0)

  const strokesTotal = scores.reduce((sum, score) => {
    if (score.strokes == null) return sum
    return sum + score.strokes
  }, 0)

  const playedScores = scores.filter((score) => score.strokes != null)
  const playedParTotal = playedScores.reduce((sum, score) => sum + score.par, 0)
  const toPar = strokesTotal - playedParTotal

  const selectedHoleIndexes = scores.map((s) => s.hcpIndex)

  const pointsPerHole: Array<number | null> = scores.map((score) => {
    if (score.strokes == null) return null

    return stablefordPoints(
      score.strokes,
      score.par,
      getReceivedStrokesForSelectedHole(
        selectedPlayer.playingHandicap,
        selectedHoleIndexes,
        score.hcpIndex
      )
    )
  })

  const pointsTotal = pointsPerHole.reduce((sum: number, p: number | null) => {
    return sum + (p ?? 0)
  }, 0)

  const showPoints = scoringMode === 'stableford'
  const scoringLabel =
    scoringMode === 'stableford'
      ? 'Poängbogey'
      : scoringMode === 'strokeplay'
        ? 'Slagspel'
        : scoringMode

  const birdiesOrBetter = scores.filter((score) => {
    if (score.strokes == null) return false
    return score.strokes - score.par < 0 || score.strokes === 1
  }).length

  return (
    <section className="pga-summary-card" aria-label={title}>
      <style>{`
        .pga-summary-card {
          position: relative;
          overflow: hidden;
          border-radius: 28px;
          background:
            radial-gradient(circle at top left, rgba(34,197,94,0.16), transparent 34%),
            linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.92) 100%);
          border: 1px solid rgba(203,213,225,0.86);
          box-shadow: 0 18px 44px rgba(15,23,42,0.08);
          padding: 16px;
        }

        .pga-summary-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 14px;
          align-items: start;
          margin-bottom: 14px;
        }

        .pga-eyebrow {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(22,101,52,0.08);
          border: 1px solid rgba(22,101,52,0.14);
          color: #166534;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.7px;
          text-transform: uppercase;
        }

        .pga-title {
          margin: 9px 0 0;
          color: #102318;
          font-size: 22px;
          line-height: 1.08;
          font-weight: 950;
          letter-spacing: -0.035em;
        }

        .pga-subtitle {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
          font-weight: 700;
        }

        .pga-total-box {
          min-width: 150px;
          border-radius: 22px;
          padding: 12px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          color: #fff;
          box-shadow: 0 14px 28px rgba(15,23,42,0.16);
        }

        .pga-total-label {
          color: rgba(255,255,255,0.56);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.8px;
          text-transform: uppercase;
        }

        .pga-total-main {
          margin-top: 5px;
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
        }

        .pga-total-main strong {
          font-size: 26px;
          line-height: 1;
          font-weight: 950;
          letter-spacing: -0.04em;
        }

        .pga-total-main span {
          color: #bbf7d0;
          font-size: 13px;
          font-weight: 950;
        }

        .pga-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 22px;
          border: 1px solid rgba(226,232,240,0.95);
          background: #fff;
        }

        .pga-score-table {
          width: 100%;
          min-width: ${Math.max(720, visibleHoleCount * 54 + 150)}px;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          font-size: 13px;
        }

        .pga-score-table th,
        .pga-score-table td {
          padding: 8px 6px;
          text-align: center;
          border-bottom: 1px solid #edf2f7;
          vertical-align: middle;
        }

        .pga-score-table tr:last-child td {
          border-bottom: none;
        }

        .pga-row-label {
          position: sticky;
          left: 0;
          z-index: 2;
          width: 74px;
          background: #f8fafc;
          color: #334155;
          text-align: left !important;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          box-shadow: 8px 0 12px rgba(15,23,42,0.035);
        }

        thead .pga-row-label {
          z-index: 3;
        }

        .pga-hole-head {
          background: #f8fafc;
          color: #0f172a;
          font-size: 12px;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }

        .pga-par-cell,
        .pga-points-cell {
          color: #475569;
          font-weight: 850;
          font-variant-numeric: tabular-nums;
        }

        .pga-total-cell {
          background: #f8fafc;
          color: #166534;
          font-weight: 950;
          font-variant-numeric: tabular-nums;
        }

        .pga-score-badge {
          position: relative;
          isolation: isolate;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 999px;
          font-weight: 950;
          font-size: 14px;
          font-variant-numeric: tabular-nums;
          color: #0f172a;
        }

        .pga-score-badge::after {
          content: attr(data-symbol);
          position: absolute;
          inset: -5px;
          display: grid;
          place-items: center;
          z-index: -1;
          font-size: 38px;
          line-height: 1;
          font-weight: 950;
        }

        .score-empty {
          color: #94a3b8;
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
        }

        .score-par {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }

        .score-birdie {
          background: #ecfdf5;
          border: 2px solid #16a34a;
          color: #166534;
        }

        .score-eagle {
          background: #dcfce7;
          border: 2px solid #15803d;
          color: #14532d;
          box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
        }

        .score-albatross,
        .score-hio {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 2px solid #b45309;
          color: #78350f;
          box-shadow: 0 0 0 4px rgba(245,158,11,0.16);
        }

        .score-bogey {
          border-radius: 10px;
          background: #fff7ed;
          border: 2px solid #f97316;
          color: #9a3412;
        }

        .score-double {
          border-radius: 10px;
          background: #fef2f2;
          border: 2px solid #dc2626;
          color: #991b1b;
          box-shadow: 0 0 0 4px rgba(239,68,68,0.10);
        }

        .pga-legend {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          color: #475569;
          font-size: 11px;
          font-weight: 850;
        }

        .pga-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.70);
          border: 1px solid rgba(226,232,240,0.95);
        }

        .pga-mini-mark {
          width: 14px;
          height: 14px;
          display: inline-block;
          border-radius: 999px;
        }

        .pga-mini-mark.square {
          border-radius: 4px;
        }

        .pga-mode-pill {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          border: 1px solid rgba(22,101,52,0.16);
          background: rgba(22,101,52,0.08);
          padding: 7px 10px;
          color: #166534;
          font-weight: 950;
        }

        @media (max-width: 720px) {
          .pga-summary-card {
            border-radius: 22px;
            padding: 12px;
          }

          .pga-summary-header {
            grid-template-columns: 1fr;
          }

          .pga-total-box {
            min-width: 0;
          }

          .pga-title {
            font-size: 20px;
          }

          .pga-table-wrap {
            margin-left: -2px;
            margin-right: -2px;
          }

          .pga-score-badge {
            width: 34px;
            height: 34px;
          }

          .pga-mode-pill {
            margin-left: 0;
          }
        }
      `}</style>

      <div className="pga-summary-header">
        <div>
          <div className="pga-eyebrow">⛳ Scorekort</div>
          <h3 className="pga-title">{title}</h3>
          <p className="pga-subtitle">
            PGA-inspirerad markering: cirklar för birdie/eagle och fyrkanter för bogey eller sämre.
          </p>
        </div>

        <div className="pga-total-box">
          <div className="pga-total-label">Totalt</div>
          <div className="pga-total-main">
            <strong>{showPoints ? pointsTotal : strokesTotal}</strong>
            <span>{showPoints ? 'poäng' : formatToPar(toPar)}</span>
          </div>
          <div className="pga-total-label" style={{ marginTop: 8 }}>
            {birdiesOrBetter} birdie+ · {playedScores.length}/{scores.length} spelade
          </div>
        </div>
      </div>

      <div className="pga-table-wrap">
        <table className="pga-score-table">
          <thead>
            <tr>
              <th className="pga-row-label">Hål</th>
              {scores.map((score) => (
                <th key={`hole-${score.holeNumber}`} className="pga-hole-head">
                  {score.holeNumber}
                </th>
              ))}
              <th className="pga-total-cell">Σ</th>
            </tr>

            <tr>
              <th className="pga-row-label">Par</th>
              {scores.map((score) => (
                <th key={`par-${score.holeNumber}`} className="pga-par-cell">
                  {score.par}
                </th>
              ))}
              <th className="pga-total-cell">{parTotal}</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td className="pga-row-label">Score</td>
              {scores.map((score) => {
                const meta = getScoreMeta(score.strokes, score.par)

                return (
                  <td key={`res-${score.holeNumber}`} title={meta.label}>
                    <span
                      className={`pga-score-badge ${meta.className}`}
                      data-symbol={meta.symbol}
                      aria-label={`${score.holeNumber}: ${meta.label}`}
                    >
                      {score.strokes ?? '-'}
                    </span>
                  </td>
                )
              })}
              <td className="pga-total-cell">{strokesTotal || '-'}</td>
            </tr>

            {showPoints ? (
              <tr>
                <td className="pga-row-label">Poäng</td>
                {pointsPerHole.map((points, index) => (
                  <td
                    key={`points-${scores[index].holeNumber}`}
                    className="pga-points-cell"
                  >
                    {points == null ? '-' : points}
                  </td>
                ))}
                <td className="pga-total-cell">{pointsTotal}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="pga-legend">
        <span className="pga-legend-item">
          <span className="pga-mini-mark" style={{ border: '2px solid #16a34a' }} />
          Birdie
        </span>
        <span className="pga-legend-item">
          <span className="pga-mini-mark" style={{ border: '2px solid #15803d', boxShadow: '0 0 0 3px rgba(34,197,94,0.14)' }} />
          Eagle+
        </span>
        <span className="pga-legend-item">
          <span className="pga-mini-mark square" style={{ border: '2px solid #f97316' }} />
          Bogey
        </span>
        <span className="pga-legend-item">
          <span className="pga-mini-mark square" style={{ border: '2px solid #dc2626', boxShadow: '0 0 0 3px rgba(239,68,68,0.10)' }} />
          Dubbel+
        </span>
        <span className="pga-mode-pill">{scoringLabel}</span>
      </div>
    </section>
  )
}
