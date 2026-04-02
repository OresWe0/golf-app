'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Course } from '@/lib/types'

type PlayerInput = {
  kind: 'registered' | 'guest'
  name: string
  email: string
  handicapIndex: string
  teeKey: 'yellow' | 'red'
}

export function NewRoundForm({
  courses,
  currentUser,
}: {
  courses: Course[]
  currentUser: {
    email: string
    displayName: string
    handicapIndex: number | null
    defaultTee: string
  }
}) {
  const router = useRouter()

  const [title, setTitle] = useState('Lördagsrundan')
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [scoringMode, setScoringMode] = useState<'strokeplay' | 'stableford'>('stableford')

  const [holesMode, setHolesMode] = useState<9 | 18>(18)
  const [nineHoleSide, setNineHoleSide] = useState<'front' | 'back'>('front')

  const [players, setPlayers] = useState<PlayerInput[]>([
    {
      kind: 'registered',
      name: currentUser.displayName,
      email: currentUser.email,
      handicapIndex: currentUser.handicapIndex == null ? '' : String(currentUser.handicapIndex),
      teeKey: currentUser.defaultTee === 'red' ? 'red' : 'yellow',
    },
    { kind: 'registered', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
  ])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updatePlayer = (index: number, key: keyof PlayerInput, value: string) => {
    setPlayers((prev) =>
      prev.map((player, i) => (i === index ? { ...player, [key]: value } : player))
    )
  }

  const addRegisteredPlayer = () => {
    setPlayers((prev) => [
      ...prev,
      { kind: 'registered', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
    ])
  }

  const addGuestPlayer = () => {
    setPlayers((prev) => [
      ...prev,
      { kind: 'guest', name: '', email: '', handicapIndex: '', teeKey: 'yellow' },
    ])
  }

  const removePlayer = (index: number) => {
    if (index === 0) return
    setPlayers((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async () => {
    setLoading(true)
    setError(null)

    const normalizedPlayers = players
      .map((player, index) => ({
        ...player,
        sortOrder: index + 1,
        name: player.name.trim(),
        email: player.email.trim().toLowerCase(),
        handicapIndex: player.handicapIndex ? Number(player.handicapIndex) : null,
      }))
      .filter((player) => player.name)

    const response = await fetch('/api/rounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        courseId,
        scoringMode,
        holesMode,
        nineHoleSide,
        players: normalizedPlayers,
      }),
    })

    const result = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(result.error || 'Kunde inte skapa rundan.')
      return
    }

    const firstHole =
      holesMode === 18 ? 1 : nineHoleSide === 'front' ? 1 : 10

    router.push(`/rounds/${result.roundId}?hole=${firstHole}`)
  }

  return (
    <div className="stack">
      <div>
        <label htmlFor="title">Rundnamn</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="grid grid-2">
        <div>
          <label htmlFor="course">Bana</label>
          <select
            id="course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="mode">Scoring mode</label>
          <select
            id="mode"
            value={scoringMode}
            onChange={(e) =>
              setScoringMode(e.target.value as 'strokeplay' | 'stableford')
            }
          >
            <option value="stableford">Stableford</option>
            <option value="strokeplay">Slagspel</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ background: '#f8fbf7', marginBottom: 0 }}>
        <div className="header-line" style={{ marginBottom: 12 }}>
          <div>
            <h3>Rundinställningar</h3>
            <p className="muted">
              Välj om ni spelar 18 hål eller 9 hål. Vid 9 hål kan du välja främre
              eller bakre 9.
            </p>
          </div>
        </div>

        <div className="stack">
          <div>
            <label>Antal hål</label>
            <div className="row" style={{ gap: 16, marginTop: 8 }}>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="radio"
                  name="holesMode"
                  value="18"
                  checked={holesMode === 18}
                  onChange={() => setHolesMode(18)}
                />
                18 hål
              </label>

              <label className="row" style={{ gap: 8 }}>
                <input
                  type="radio"
                  name="holesMode"
                  value="9"
                  checked={holesMode === 9}
                  onChange={() => setHolesMode(9)}
                />
                9 hål
              </label>
            </div>
          </div>

          {holesMode === 9 ? (
            <div>
              <label>Vilka 9 hål?</label>
              <div className="row" style={{ gap: 16, marginTop: 8 }}>
                <label className="row" style={{ gap: 8 }}>
                  <input
                    type="radio"
                    name="nineHoleSide"
                    value="front"
                    checked={nineHoleSide === 'front'}
                    onChange={() => setNineHoleSide('front')}
                  />
                  Främre 9
                </label>

                <label className="row" style={{ gap: 8 }}>
                  <input
                    type="radio"
                    name="nineHoleSide"
                    value="back"
                    checked={nineHoleSide === 'back'}
                    onChange={() => setNineHoleSide('back')}
                  />
                  Bakre 9
                </label>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card" style={{ background: '#f8fbf7', marginBottom: 0 }}>
        <div className="header-line">
          <div>
            <h3>Spelare i bollen</h3>
            <p className="muted">
              För registrerade vänner räcker e-post. HCP och tee kan ändras om det
              behövs innan rundan startar.
            </p>
          </div>

          <div className="row">
            <button
              type="button"
              className="secondary"
              onClick={addRegisteredPlayer}
            >
              + Registrerad vän
            </button>
            <button type="button" className="secondary" onClick={addGuestPlayer}>
              + Gäst
            </button>
          </div>
        </div>

        <div className="stack">
          {players.map((player, index) => (
            <div
              className="card"
              style={{ marginBottom: 0, background: '#fff' }}
              key={index}
            >
              <div className="header-line" style={{ marginBottom: 12 }}>
                <strong>
                  {index === 0
                    ? 'Du'
                    : player.kind === 'registered'
                    ? 'Registrerad spelare'
                    : 'Gästspelare'}
                </strong>

                {index > 0 ? (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => removePlayer(index)}
                  >
                    Ta bort
                  </button>
                ) : null}
              </div>

              <div className="grid grid-4">
                <div>
                  <label>Namn</label>
                  <input
                    placeholder="Namn"
                    value={player.name}
                    onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                  />
                </div>

                <div>
                  <label>
                    E-post {player.kind === 'registered' ? '(krävs)' : '(valfritt)'}
                  </label>
                  <input
                    placeholder={
                      player.kind === 'registered' ? 'vän@epost.se' : 'tomt = gäst'
                    }
                    type="email"
                    value={player.email}
                    onChange={(e) => updatePlayer(index, 'email', e.target.value)}
                    disabled={index === 0}
                  />
                </div>

                <div>
                  <label>Exakt HCP</label>
                  <input
                    placeholder="t.ex. 24.1"
                    type="number"
                    step="0.1"
                    value={player.handicapIndex}
                    onChange={(e) =>
                      updatePlayer(index, 'handicapIndex', e.target.value)
                    }
                  />
                </div>

                <div>
                  <label>Tee</label>
                  <select
                    value={player.teeKey}
                    onChange={(e) => updatePlayer(index, 'teeKey', e.target.value)}
                  >
                    <option value="yellow">Gul tee</option>
                    <option value="red">Röd tee</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error ? <div className="notice">{error}</div> : null}

      <button type="button" onClick={submit} disabled={loading}>
        {loading ? 'Skapar...' : 'Starta runda'}
      </button>
    </div>
  )
}