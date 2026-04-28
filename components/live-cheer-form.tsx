'use client'

import { useState } from 'react'

type CheerAction = (formData: FormData) => void | Promise<void>

type QuickCheer = {
  label: string
  emoji: string
  message: string
}

export default function LiveCheerForm({
  roundId,
  sendAction,
  quickCheers,
}: {
  roundId: string
  sendAction: CheerAction
  quickCheers: QuickCheer[]
}) {
  const [pending, setPending] = useState(false)
  const [statusText, setStatusText] = useState('')

  return (
    <form
      action={sendAction}
      className="premium-cheer-form"
      onSubmit={() => {
        setPending(true)
        if (!statusText) setStatusText('Skickar hejarop...')
      }}
    >
      <input type="hidden" name="round_id" value={roundId} />
      <div className="premium-quick-cheers" aria-label="Snabba hejarop">
        {quickCheers.map((item) => (
          <button
            key={item.message}
            type="submit"
            name="message"
            value={item.message}
            disabled={pending}
            onClick={() => {
              setStatusText(`Skickar: ${item.label}`)
            }}
          >
            <span className="premium-cheer-emoji" aria-hidden="true">{item.emoji}</span>
            <span className="premium-cheer-label">{item.label}</span>
          </button>
        ))}
      </div>
      <input
        className="premium-input"
        name="message"
        type="text"
        maxLength={140}
        placeholder="Skriv eget hejarop..."
        disabled={pending}
        onFocus={() => setStatusText('Skriv ett eget hejarop och skicka')}
      />
      <button type="submit" className="premium-button" disabled={pending}>
        {pending ? 'Skickar...' : 'Skicka hejarop'}
      </button>
      {statusText ? (
        <div className="premium-muted" style={{ fontSize: 13, marginTop: 2 }}>
          {statusText}
        </div>
      ) : null}
    </form>
  )
}

