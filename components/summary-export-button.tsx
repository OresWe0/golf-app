'use client'

import { useState } from 'react'

type ExportScorecard = {
  title: string
  holes: number[]
  pars: number[]
  results: Array<number | null>
  points?: Array<number | null>
}

type ExportPlayer = {
  id: string
  name: string
  scoreText: string
  playedRangeText?: string
  scorecards: ExportScorecard[]
}

function drawScorecard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  card: ExportScorecard
) {
  const headerHeight = 42
  const rowHeight = 34
  const rowsCount = card.points ? 4 : 3
  const tableHeight = headerHeight + rowsCount * rowHeight + 10
  const labelWidth = 74
  const totalWidth = 62
  const holesCount = Math.max(1, card.holes.length)
  const holeWidth = (width - labelWidth - totalWidth) / holesCount

  ctx.fillStyle = 'rgba(255,255,255,0.97)'
  ctx.fillRect(x, y, width, tableHeight)
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, tableHeight)

  ctx.fillStyle = '#15803d'
  ctx.fillRect(x, y, width, headerHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 18px Arial'
  ctx.fillText(card.title, x + 12, y + 27)

  const gridTop = y + headerHeight
  const rowLabels = card.points ? ['Hal', 'Par', 'Res', 'P'] : ['Hal', 'Par', 'Res']
  const rowData: Array<Array<number | null>> = [
    card.holes.map((value) => value),
    card.pars.map((value) => value),
    card.results,
  ]

  if (card.points) rowData.push(card.points)

  for (let row = 0; row < rowLabels.length; row++) {
    const rowY = gridTop + row * rowHeight
    ctx.fillStyle = row % 2 === 0 ? '#f8fafc' : '#ffffff'
    ctx.fillRect(x, rowY, width, rowHeight)

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 14px Arial'
    ctx.fillText(rowLabels[row], x + 12, rowY + 22)

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
      ctx.font = row === 2 ? 'bold 16px Arial' : '13px Arial'
      const tw = ctx.measureText(display).width
      ctx.fillText(display, colX + (holeWidth - tw) / 2, rowY + 22)
    }

    const totalX = x + width - totalWidth
    const totalText = row === 0 ? 'Sum' : String(total)
    ctx.fillStyle = '#065f46'
    ctx.font = 'bold 14px Arial'
    const ttw = ctx.measureText(totalText).width
    ctx.fillText(totalText, totalX + (totalWidth - ttw) / 2, rowY + 22)
  }
}

function drawPlayerBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  player: ExportPlayer
) {
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(x, y, width, 84)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 30px Arial'
  ctx.fillText(player.name, x + 14, y + 36)
  ctx.font = '22px Arial'
  ctx.fillStyle = '#bbf7d0'
  ctx.fillText(player.scoreText, x + width - 220, y + 36)

  if (player.playedRangeText) {
    ctx.font = '16px Arial'
    ctx.fillStyle = '#dcfce7'
    ctx.fillText(player.playedRangeText, x + 14, y + 64)
  }

  let sectionY = y + 96
  const cardWidth = width
  for (const scorecard of player.scorecards) {
    drawScorecard(ctx, x, sectionY, cardWidth, scorecard)
    sectionY += scorecard.points ? 198 : 162
    sectionY += 12
  }

  return sectionY
}

function downloadCanvas(canvas: HTMLCanvasElement, prefix: string) {
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.png`
  a.click()
}

export default function SummaryExportButton({
  roundTitle,
  courseName,
  modeLabel,
  players,
  myPlayerId,
}: {
  roundTitle: string
  courseName: string
  modeLabel: string
  players: ExportPlayer[]
  myPlayerId: string | null
}) {
  const [busyMode, setBusyMode] = useState<'mine' | 'all' | null>(null)

  function drawHeader(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    subtitle: string
  ) {
    const grad = ctx.createLinearGradient(0, 0, width, height)
    grad.addColorStop(0, '#0f3b2f')
    grad.addColorStop(1, '#178a4a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(30, 24, width - 60, 120)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 50px Arial'
    ctx.fillText(roundTitle || 'Runda', 56, 88)
    ctx.font = '26px Arial'
    ctx.fillStyle = '#dcfce7'
    ctx.fillText(`${courseName} - ${modeLabel}`, 56, 122)
    ctx.font = 'bold 22px Arial'
    ctx.fillStyle = '#bbf7d0'
    ctx.fillText(subtitle, width - 360, 122)
  }

  async function handleExportMine() {
    try {
      setBusyMode('mine')

      const me =
        players.find((player) => player.id === myPlayerId) ??
        players[0]

      if (!me) return

      const canvas = document.createElement('canvas')
      canvas.width = 1600
      canvas.height = 900
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      drawHeader(ctx, canvas.width, canvas.height, 'Min score')
      drawPlayerBlock(ctx, 56, 170, 1488, me)

      downloadCanvas(canvas, 'min-score')
    } finally {
      setBusyMode(null)
    }
  }

  async function handleExportAll() {
    try {
      setBusyMode('all')

      const width = 1600
      const headerHeight = 160
      const playerHeightEstimate = 500
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.max(900, headerHeight + players.length * playerHeightEstimate)
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      drawHeader(ctx, canvas.width, canvas.height, 'Alla spelare')

      let y = 170
      for (const player of players) {
        y = drawPlayerBlock(ctx, 56, y, 1488, player) + 14
      }

      downloadCanvas(canvas, 'alla-scorekort')
    } finally {
      setBusyMode(null)
    }
  }

  const disabled = players.length === 0 || busyMode !== null

  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
      <div className="muted" style={{ fontSize: 13 }}>
        Exportera som bild för delning i chatten.
      </div>
      <button
        type="button"
        className="button secondary"
        onClick={handleExportMine}
        disabled={disabled}
        style={{ width: '100%', minHeight: 50, fontWeight: 800 }}
      >
        {busyMode === 'mine' ? 'Skapar min bild...' : 'Min score (PNG)'}
      </button>

      <button
        type="button"
        className="button secondary"
        onClick={handleExportAll}
        disabled={disabled}
        style={{ width: '100%', minHeight: 50, fontWeight: 800 }}
      >
        {busyMode === 'all' ? 'Skapar alla...' : 'Alla scorekort (PNG)'}
      </button>
    </div>
  )
}

