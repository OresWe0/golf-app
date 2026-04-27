'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  roundId: string
  currentHole: number
  totalHoles: number
}

export default function FinishRoundQuickAction({ roundId, currentHole, totalHoles }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (currentHole >= totalHoles) return null

  const onFinish = async () => {
    if (loading) return

    const ok = window.confirm(
      `Avsluta rundan efter hål ${currentHole}? Du kan fortfarande se leaderboard och scorekort.`
    )
    if (!ok) return

    setLoading(true)
    try {
      const response = await fetch(`/api/rounds/${roundId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedThroughHole: currentHole }),
      })

      if (!response.ok) {
        alert('Kunde inte avsluta rundan.')
        return
      }

      router.push(`/rounds/${roundId}/summary`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      className="button secondary"
      onClick={onFinish}
      disabled={loading}
      style={{
        borderRadius: 999,
        minHeight: 38,
        paddingInline: 14,
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? 'Avslutar...' : 'Avsluta rundan nu'}
    </button>
  )
}
