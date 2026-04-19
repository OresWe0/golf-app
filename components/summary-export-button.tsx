'use client'

import { useState } from 'react'

type ExportRow = {
  name: string
  scoreText: string
}

export default function SummaryExportButton({
  roundTitle,
  courseName,
  modeLabel,
  winnerName,
  winnerScore,
  rows,
}: {
  roundTitle: string
  courseName: string
  modeLabel: string
  winnerName: string
  winnerScore: string
  rows: ExportRow[]
}) {
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    try {
      setBusy(true)

      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 630
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('Kunde inte skapa canvas')
      }

      const grad = ctx.createLinearGradient(0, 0, 1200, 630)
      grad.addColorStop(0, '#0f3b2f')
      grad.addColorStop(1, '#178a4a')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 1200, 630)

      ctx.fillStyle = 'rgba(255,255,255,0.12)'
      ctx.fillRect(30, 30, 1140, 570)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 56px Arial'
      ctx.fillText(roundTitle || 'Runda', 60, 110)

      ctx.font = '28px Arial'
      ctx.fillStyle = '#dcfce7'
      ctx.fillText(`${courseName} - ${modeLabel}`, 60, 156)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 38px Arial'
      ctx.fillText('Vinnare', 60, 230)
      ctx.font = 'bold 44px Arial'
      ctx.fillText(winnerName, 60, 282)
      ctx.font = '32px Arial'
      ctx.fillStyle = '#dcfce7'
      ctx.fillText(winnerScore, 60, 324)

      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.fillRect(560, 70, 580, 500)
      ctx.fillStyle = '#133126'
      ctx.font = 'bold 32px Arial'
      ctx.fillText('Leaderboard', 590, 120)

      ctx.font = '24px Arial'
      rows.slice(0, 5).forEach((row, index) => {
        const y = 170 + index * 74
        ctx.fillStyle = '#166534'
        ctx.fillText(`${index + 1}.`, 590, y)
        ctx.fillStyle = '#133126'
        ctx.fillText(row.name, 640, y)
        ctx.fillStyle = '#0f766e'
        ctx.fillText(row.scoreText, 1030, y)
      })

      const dataUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `runda-${new Date().toISOString().slice(0, 10)}.png`
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
