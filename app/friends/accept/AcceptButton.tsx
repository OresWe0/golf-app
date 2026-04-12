'use client'

import { useState } from 'react'

type AcceptButtonProps = {
  token: string
}

export default function AcceptButton({ token }: AcceptButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      })

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; redirectTo?: string }
        | null

      if (!response.ok || !data?.ok || !data.redirectTo) {
        setError(data?.error || 'Kunde inte acceptera vänförfrågan')
        setLoading(false)
        return
      }

      window.location.href = data.redirectTo
    } catch (error) {
      console.error('Accept button failed:', error)
      setError('Kunde inte acceptera vänförfrågan')
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <button
        type="button"
        className="button"
        onClick={handleAccept}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Accepterar...' : 'Acceptera'}
      </button>

      {error ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#fef2f2',
            border: '1px solid #fecaca',
          }}
        >
          <strong>Något gick fel</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {error}
          </div>
        </div>
      ) : null}
    </div>
  )
}