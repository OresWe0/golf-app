'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FriendSuggestion, TeeKey } from '@/components/add-registered-player-form'

type ActivePlayerOption = {
  id: string
  name: string
}

type Props = {
  action: (formData: FormData) => void | Promise<void>
  friendSuggestions: FriendSuggestion[]
  activePlayers: ActivePlayerOption[]
  preselectedOutgoingId: string
  preselectedOutgoingPlayerName: string | null
  defaultTeeKey: TeeKey
}

const RECENT_STORAGE_KEY = 'golf.recent_replace_friend_emails'

export default function ReplaceRegisteredPlayerForm({
  action,
  friendSuggestions,
  activePlayers,
  preselectedOutgoingId,
  preselectedOutgoingPlayerName,
  defaultTeeKey,
}: Props) {
  const [selectedOutgoingId, setSelectedOutgoingId] = useState(preselectedOutgoingId)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [exactHandicap, setExactHandicap] = useState('')
  const [recentEmails, setRecentEmails] = useState<string[]>([])
  const [teeKey, setTeeKey] = useState<TeeKey>(defaultTeeKey)

  const hasPreselectedOutgoing = preselectedOutgoingId.length > 0

  const byEmail = useMemo(() => {
    return new Map(friendSuggestions.map((friend) => [friend.email, friend]))
  }, [friendSuggestions])

  const selectedFriend = selectedEmail ? byEmail.get(selectedEmail) ?? null : null

  useEffect(() => {
    setSelectedOutgoingId(preselectedOutgoingId)
  }, [preselectedOutgoingId])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const valid = parsed
        .map((item) => String(item ?? '').trim().toLowerCase())
        .filter((email) => email && byEmail.has(email))
      setRecentEmails(valid.slice(0, 3))
    } catch {
      // Ignore localStorage errors in restricted environments.
    }
  }, [byEmail])

  function rememberEmail(email: string) {
    if (!email) return
    const next = [email, ...recentEmails.filter((item) => item !== email)].slice(0, 3)
    setRecentEmails(next)
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore localStorage errors in restricted environments.
    }
  }

  function handleSelectEmail(email: string) {
    setSelectedEmail(email)
    const friend = byEmail.get(email)
    if (friend?.handicapIndex == null) {
      setExactHandicap('')
    } else {
      setExactHandicap(String(friend.handicapIndex))
    }
    rememberEmail(email)
  }

  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      {hasPreselectedOutgoing ? (
        <>
          <div
            style={{
              borderRadius: 10,
              border: '1px solid #d1d5db',
              padding: 10,
              background: '#f8fafc',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            {`Ers\u00e4tter: ${preselectedOutgoingPlayerName ?? ''}`}
          </div>
          <input type="hidden" name="outgoing_round_player_id" value={preselectedOutgoingId} />
        </>
      ) : (
        <select
          name="outgoing_round_player_id"
          required
          value={selectedOutgoingId}
          onChange={(event) => setSelectedOutgoingId(event.target.value)}
          style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
        >
          <option value="">{'V\u00e4lj spelare som g\u00e5r av'}</option>
          {activePlayers.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      )}

      <input
        type="hidden"
        name="preselected_outgoing_round_player_id"
        value={preselectedOutgoingId}
      />

      {recentEmails.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
            {'Senast valda v\u00e4nner'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {recentEmails.map((email) => {
              const friend = byEmail.get(email)
              if (!friend) return null
              return (
                <button
                  key={email}
                  type="button"
                  className="button secondary"
                  onClick={() => handleSelectEmail(email)}
                  style={{ minHeight: 38, padding: '8px 12px' }}
                >
                  {friend.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <select
        name="incoming_email"
        required
        value={selectedEmail}
        onChange={(event) => handleSelectEmail(event.target.value)}
        autoFocus={hasPreselectedOutgoing}
        style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
      >
        <option value="">{'V\u00e4lj ny spelare fr\u00e5n v\u00e4nlista'}</option>
        {friendSuggestions.map((friend) => (
          <option key={`replace-${friend.email}`} value={`${friend.email}|${friend.handicapIndex ?? ''}`}>
            {`${friend.label} \u00b7 ${friend.email} \u00b7 HCP ${friend.handicapIndex ?? '-'}`}
          </option>
        ))}
      </select>

      <div className="muted" style={{ fontSize: 13 }}>
        {selectedFriend
          ? `F\u00f6rifyllt HCP fr\u00e5n ${selectedFriend.label}: ${selectedFriend.handicapIndex ?? '-'}`
          : 'V\u00e4lj ny spelare fr\u00e5n v\u00e4nlista.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <select
          name="tee_key"
          value={teeKey}
          onChange={(event) => setTeeKey(event.target.value as TeeKey)}
          style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
        >
          <option value="yellow">Yellow tee</option>
          <option value="red">Red tee</option>
        </select>

        <input
          name="exact_handicap"
          type="text"
          value={exactHandicap}
          onChange={(event) => setExactHandicap(event.target.value)}
          placeholder="HCP (valfritt)"
          style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
        />
      </div>

      <button type="submit" className="button">
        {'Ers\u00e4tt med registrerad spelare'}
      </button>
    </form>
  )
}

