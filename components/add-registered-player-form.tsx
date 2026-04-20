'use client'

import { useEffect, useMemo, useState } from 'react'

type TeeKey = 'yellow' | 'red'

type FriendSuggestion = {
  email: string
  label: string
  handicapIndex: number | null
}

type Props = {
  action: (formData: FormData) => void | Promise<void>
  friendSuggestions: FriendSuggestion[]
  defaultTeeKey: TeeKey
}

const RECENT_STORAGE_KEY = 'golf.recent_friend_emails'

export default function AddRegisteredPlayerForm({
  action,
  friendSuggestions,
  defaultTeeKey,
}: Props) {
  const [selectedEmail, setSelectedEmail] = useState('')
  const [exactHandicap, setExactHandicap] = useState('')
  const [recentEmails, setRecentEmails] = useState<string[]>([])
  const [teeKey, setTeeKey] = useState<TeeKey>(defaultTeeKey)

  const byEmail = useMemo(() => {
    return new Map(friendSuggestions.map((friend) => [friend.email, friend]))
  }, [friendSuggestions])

  const selectedFriend = selectedEmail ? byEmail.get(selectedEmail) ?? null : null

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
      {recentEmails.length > 0 ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
            Senast valda vänner
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
        name="email"
        required
        value={selectedEmail}
        onChange={(event) => handleSelectEmail(event.target.value)}
        style={{ borderRadius: 10, border: '1px solid #d1d5db', padding: 10 }}
      >
        <option value="">Välj från vänlista</option>
        {friendSuggestions.map((friend) => (
          <option key={friend.email} value={friend.email}>
            {friend.label} · {friend.email} · HCP {friend.handicapIndex ?? '-'}
          </option>
        ))}
      </select>

      <div className="muted" style={{ fontSize: 13 }}>
        {selectedFriend
          ? `Förifyllt HCP från ${selectedFriend.label}: ${selectedFriend.handicapIndex ?? '-'}`
          : 'Saknas vän i listan? Lägg till vännen i Profil först.'}
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
        Lägg till registrerad spelare
      </button>
    </form>
  )
}

