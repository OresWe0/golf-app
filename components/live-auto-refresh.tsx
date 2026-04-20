'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  intervalMs?: number
}

export default function LiveAutoRefresh({ intervalMs = 15000 }: Props) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!enabled) return

    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      router.refresh()
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [enabled, intervalMs, router])

  return (
    <button
      type="button"
      className="button secondary"
      onClick={() => setEnabled((prev) => !prev)}
      style={{ minWidth: 180 }}
    >
      {enabled ? 'Auto-uppdatering: På' : 'Auto-uppdatering: Pausad'}
    </button>
  )
}

