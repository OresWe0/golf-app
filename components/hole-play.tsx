'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HolePlayFocus } from './hole-play-focus'

type Player = {
  id: string
  display_name?: string
  exact_handicap?: number | null
  playing_handicap?: number | null
  tee_key?: 'yellow' | 'red' | string
}

type ScoreRow = {
  round_player_id: string
  strokes: number | null
}

type Hole = {
  hole_number: number
  par: number
  hcp_index: number
}

type LeaderboardEntry = {
  playerId: string
  position: number
  scoreText?: string
  totalPoints?: number
  totalToPar?: number
  totalStrokes?: number
  isLeader?: boolean
}

type Props = {
  roundId: string
  currentHole: number
  totalHoles: number
  startHole: number
  endHole: number
  hole: Hole
  players: Player[]
  scores: ScoreRow[]
  leaderboard?: LeaderboardEntry[]
  playerStreaks?: Record<string, number>
  selectedHoleIndexes: number[]
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 1
  return Math.max(1, Math.round(score))
}

export function HolePlay({
  roundId,
  currentHole,
  startHole,
  endHole,
  hole,
  players,
  scores,
}: Props) {
  const router = useRouter()

  const isSavingRef = useRef(false)
  const isNavigatingRef = useRef(false)

  const createValuesFromScores = () =>
    Object.fromEntries(
      players.map((player) => {
        const existing = scores.find((score) => score.round_player_id === player.id)
        return [String(player.id), existing?.strokes?.toString() ?? '']
      })
    )

  const [values, setValues] = useState<Record<string, string>>(createValuesFromScores())
  const [loading, setLoading] = useState(false)
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)

  const firstIncompleteIndex = useMemo(() => {
    const index = players.findIndex((player) => {
      const value = values[String(player.id)]
      return value === '' || value == null
    })

    return index === -1 ? 0 : index
  }, [players, values])

  useEffect(() => {
    const nextValues = createValuesFromScores()
    setValues(nextValues)

    const nextIncompleteIndex = players.findIndex((player) => {
      const value = nextValues[String(player.id)]
      return value === '' || value == null
    })

    setCurrentPlayerIndex(nextIncompleteIndex === -1 ? 0 : nextIncompleteIndex)

    isSavingRef.current = false
    isNavigatingRef.current = false
    setLoading(false)
  }, [hole.hole_number, scores, players])

  const allPlayersHaveScores = (candidateValues: Record<string, string>) => {
    if (!players.length) return false

    return players.every((player) => {
      const value = candidateValues[String(player.id)]
      return value !== '' && value !== undefined && value !== null
    })
  }

  const canInteract = !loading && !isSavingRef.current && !isNavigatingRef.current

  const navigateTo = (target: string) => {
    if (isNavigatingRef.current) return
    isNavigatingRef.current = true
    router.push(target)
  }

  const goPreviousHole = () => {
    if (!canInteract) return

    const target =
      currentHole > startHole ? `/rounds/${roundId}?hole=${currentHole - 1}` : '/dashboard'

    navigateTo(target)
  }

  const goNextHole = () => {
    if (!canInteract) return

    const target =
      currentHole === endHole
        ? `/rounds/${roundId}/summary`
        : `/rounds/${roundId}?hole=${currentHole + 1}`

    navigateTo(target)
  }

  const setScore = (playerId: string, score: number) => {
    if (!canInteract) return

    const safeScore = clampScore(score)

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }

    setValues((prev) => ({
      ...prev,
      [String(playerId)]: String(safeScore),
    }))
  }

  const clearScore = (playerId: string) => {
    if (!canInteract) return

    setValues((prev) => ({
      ...prev,
      [String(playerId)]: '',
    }))
  }

  const saveScores = async (overrideValues?: Record<string, string>) => {
    const valuesToSave = overrideValues ?? values

    if (loading) return
    if (isSavingRef.current) return
    if (isNavigatingRef.current) return
    if (!allPlayersHaveScores(valuesToSave)) return

    isSavingRef.current = true
    setLoading(true)

    try {
      const response = await fetch(`/api/rounds/${roundId}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holeNumber: currentHole,
          scores: players.map((player) => ({
            roundPlayerId: player.id,
            strokes: valuesToSave[String(player.id)]
              ? Number(valuesToSave[String(player.id)])
              : null,
          })),
        }),
      })

      if (!response.ok) {
        alert('Det gick inte att spara score. Prova igen.')
        return
      }

      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([20, 18, 20])
      }

      goNextHole()
    } finally {
      if (!isNavigatingRef.current) {
        setLoading(false)
        isSavingRef.current = false
      }
    }
  }

  const activePlayer = players[currentPlayerIndex] ?? players[0] ?? null
  const activePlayerId = activePlayer ? String(activePlayer.id) : null
  const activePlayerValue = activePlayerId ? values[activePlayerId] : ''
  const activeStrokes = activePlayerValue ? Number(activePlayerValue) : null

  const hasPreviousPlayer = currentPlayerIndex > 0
  const hasNextPlayer = currentPlayerIndex < players.length - 1

  const handlePrev = () => {
    if (!canInteract) return

    if (hasPreviousPlayer) {
      setCurrentPlayerIndex((prev) => Math.max(0, prev - 1))
      return
    }

    goPreviousHole()
  }

  const handleNext = () => {
    if (!canInteract || !activePlayerId) return
    if (!activePlayerValue) return

    const nextEmptyIndex = players.findIndex((player, index) => {
      if (index <= currentPlayerIndex) return false
      const value = values[String(player.id)]
      return value === '' || value == null
    })

    if (nextEmptyIndex !== -1) {
      setCurrentPlayerIndex(nextEmptyIndex)
      return
    }

    if (hasNextPlayer) {
      setCurrentPlayerIndex((prev) => Math.min(players.length - 1, prev + 1))
      return
    }

    void saveScores()
  }

  const nextLabel = (() => {
    if (loading) return 'Sparar...'
    if (!activePlayerValue) return 'Välj score först'
    if (hasNextPlayer && !allPlayersHaveScores(values)) return 'Nästa spelare →'
    if (currentHole === endHole) return 'Spara & avsluta →'
    return 'Spara & nästa hål →'
  })()

  const canSave = !!activePlayerValue && canInteract

  if (!activePlayer || !activePlayerId) {
    return null
  }

  return (
    <HolePlayFocus
      holeNumber={hole.hole_number}
      par={hole.par}
      playerName={activePlayer.display_name ?? `Spelare ${currentPlayerIndex + 1}`}
      currentPlayerNumber={currentPlayerIndex + 1}
      totalPlayers={players.length}
      strokes={activeStrokes}
      loading={loading}
      canGoPrev={hasPreviousPlayer || currentHole > startHole}
      canSave={canSave}
      nextLabel={nextLabel}
      onChange={(score) => setScore(activePlayerId, score)}
      onClear={() => clearScore(activePlayerId)}
      onPrev={handlePrev}
      onNext={handleNext}
    />
  )
}