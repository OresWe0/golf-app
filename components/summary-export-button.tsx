'use client'

import { useState } from 'react'

type ExportRow = {
  name: string
  scoreText: string
}

type ExportScorecard = {
  title: string
  holes: number[]
  pars: number[]
  results: Array<number | null>
  points?: Array<number | null>
}

function drawScorecard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  card: ExportScorecard
) {
  const headerHeight = 48
  const rowHeight = 42
  const rowsCount = card.points ? 4 : 3
  const tableHeight = headerHeight + rowsCount * rowHeight + 16
  const labelWidth = 86
  const totalWidth = 70
  const holesCount = Math.max(1, card.holes.length)
  const holeWidth = (width - labelWidth - totalWidth) / holesCount

  ctx.fillStyle = 'rgba(255,255,255,0.96)'
  ctx.fillRect(x, y, width, tableHeight)
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, tableHeight)

  ctx.fillStyle = '#15803d'
  ctx.fillRect(x, y, width, headerHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px Arial'
  ctx.fillText(card.title, x + 14, y + 31)

  const gridTop = y + headerHeight
  const rowLabels = card.points ? ['Hal', 'Par', 'Res', 'P'] : ['Hal', 'Par', 'Res']
  const rowData: Array<Array<number | null>> = [
    card.holes.map((value) => value),
    card.pars.map((value) => value),
    card.results,
  ]

  if (card.points) {
    rowData.push(card.points)
  }

  for (let row = 0; row < rowLabels.length; row++) {
    const rowY = gridTop + row * rowHeight

    ctx.fillStyle = row % 2 === 0 ? '#f8fafc' : '#ffffff'
    ctx.fillRect(x, rowY, width, rowHeight)

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 18px Arial'
    ctx.fillText(rowLabels[row], x + 14, rowY + 27)

    const data = rowData[row]
    const total = data.reduce<number>(
      (sum, value) => sum + (typeof value === 'number' ? value : 0),
      0
    )

    for (let col = 0; col < holesCount; col++) {
      const colX = x + labelWidth + col * holeWidth
      const value = data[col]
      const display = value == null ? '-' : String(value)

      ctx.fillStyle = '#1f2937'
      ctx.font = row === 2 ? 'bold 20px Arial' : '16px Arial'
      const textWidth = ctx.measureText(display).width
      ctx.fillText(display, colX + (holeWidth - textWidth) / 2, rowY + 27)
    }

    const totalX = x + width - totalWidth
    const totalText = row === 0 ? 'Ut' : String(total)
    ctx.fillStyle = '#065f46'
    ctx.font = 'bold 18px Arial'
    const totalTextWidth = ctx.measureText(totalText).width
    ctx.fillText(totalText, totalX + (totalWidth - totalTextWidth) / 2, rowY + 27)
  }

  ctx.strokeStyle = '#e5e7eb'
  for (let row = 1; row <= rowLabels.length; row++) {
    const lineY = gridTop + row * rowHeight
    ctx.beginPath()
    ctx.moveTo(x, lineY)
    ctx.lineTo(x + width, lineY)
    ctx.stroke()
  }
}

export default function SummaryExportButton({
  roundTitle,
  courseName,
  modeLabel,
  winnerName,
  winnerScore,
  rows,
  scorecards,
}: {
  roundTitle: string
  courseName: string
  modeLabel: string
  winnerName: string
  winnerScore: string
  rows: ExportRow[]
  scorecards: ExportScorecard[]
}) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    try {
      setBusy(true)

      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = 1200
      const ctx = canvas.getContext('2d')

      if (!ctx) throw new Error('Kunde inte skapa canvas')

      const grad = ctx.createLinearGradient(0, 0, 1600, 1200)
      grad.addColorStop(0, '#0f3b2f')
      grad.addColorStop(1, '#178a4a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1600, 1200)

      ctx.fillStyle = 'rgba(255,255,255,0.1)'
      ctx.fillRect(36, 36, 1528, 1128)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 58px Arial'
      ctx.fillText(roundTitle || 'Runda', 68, 120)
      ctx.font = '30px Arial'
      ctx.fillStyle = '#dcfce7'
      ctx.fillText(`${courseName} - ${modeLabel}`, 68, 166)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 34px Arial'
      ctx.fillText(`Vinnare: ${winnerName}`, 68, 226)
      ctx.font = '28px Arial'
      ctx.fillStyle = '#bbf7d0'
      ctx.fillText(`Resultat: ${winnerScore}`, 68, 264)

      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.fillRect(980, 72, 530, 262)
      ctx.fillStyle = '#133126'
      ctx.font = 'bold 30px Arial'
      ctx.fillText('Leaderboard', 1008, 112)
      ctx.font = '24px Arial'
      rows.slice(0, 5).forEach((row, index) => {
        const y = 156 + index * 34
        ctx.fillStyle = '#166534'
        ctx.fillText(`${index + 1}.`, 1010, y)
        ctx.fillStyle = '#133126'
        ctx.fillText(row.name, 1050, y)
        ctx.fillStyle = '#0f766e'
        ctx.fillText(row.scoreText, 1400, y)
      })

      if (scorecards.length > 0) {
        const cardWidth = 1464
        const startX = 68
        let y = 360

        for (const card of scorecards) {
          drawScorecard(ctx, startX, y, cardWidth, card)
          y += card.points ? 252 : 210
        }
      }

      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `resultat-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      className="button secondary"
      onClick={handleExport}
      disabled={busy}
      style={{ width: '100%', minHeight: 50, fontWeight: 800 }}
    >
      {busy ? 'Skapar bild...' : 'Exportera resultatbild (PNG)'}
    </button>
  )
}
